"""Reconstruct checkpoint networks only from explicit, source-backed contracts.

State dictionaries do not record activation functions. Legacy .pt files need an
entry in model_contracts.json (see PREDICTION_MODELS.md); never guess one.
"""
from dataclasses import dataclass
from pathlib import Path
import json
import re
import numpy as np
import torch
from torch import nn


class ModelUnavailable(ValueError):
    pass


ACTIVATIONS = {"silu": nn.SiLU, "relu": nn.ReLU, "tanh": nn.Tanh, "gelu": nn.GELU}


def load_checkpoint(path: Path):
    # Some bundled shape checkpoints contain numpy arrays in raw_curves.
    # Allow only the numpy reconstruction classes, not arbitrary pickle globals.
    allowed = [np.core.multiarray._reconstruct, np.ndarray, np.dtype,
               type(np.dtype("float32")), type(np.dtype("float64"))]
    with torch.serialization.safe_globals(allowed):
        return torch.load(path, map_location="cpu", weights_only=True)


def read_contract(path: Path, filename: str, section: str, block: dict):
    contract = block.get("inference_contract")
    if contract is None and path.is_file():
        contract = json.loads(path.read_text(encoding="utf-8")).get(filename, {}).get(section)
    if not isinstance(contract, dict) or not contract.get("source"):
        raise ModelUnavailable(
            f"{filename}/{section}: missing verified inference contract. "
            "Provide the original trainer's activation, input order, and output order "
            "in backend/model_contracts.json. No prediction was made."
        )
    if contract.get("activation") not in ACTIVATIONS:
        raise ModelUnavailable("Missing or unsupported activation in inference contract.")
    return contract


def build_network(state: dict, activation: str, prefix="net", dropout=0.0):
    if activation not in ACTIVATIONS:
        raise ModelUnavailable("Unsupported activation.")
    indices = sorted(int(m.group(1)) for key in state
                     if (m := re.fullmatch(rf"{prefix}\.(\d+)\.weight", key)))
    if not indices or indices[0] != 0:
        raise ModelUnavailable("Unsupported checkpoint layer layout.")
    layers = []
    last_outputs = None
    for i, index in enumerate(indices):
        weight = state[f"{prefix}.{index}.weight"]
        if weight.ndim != 2 or (last_outputs is not None and weight.shape[1] != last_outputs):
            raise ModelUnavailable("Inconsistent checkpoint layer dimensions.")
        if i:
            gap = index - indices[i-1]
            if gap not in (2, 3):
                raise ModelUnavailable("Unsupported hidden-layer layout.")
            layers.append(ACTIVATIONS[activation]())
            if gap == 3:
                if not 0 <= dropout < 1:
                    raise ModelUnavailable("Invalid dropout metadata.")
                layers.append(nn.Dropout(dropout))
        layers.append(nn.Linear(weight.shape[1], weight.shape[0]))
        last_outputs = weight.shape[0]
    model = nn.Module()
    model.add_module(prefix, nn.Sequential(*layers))
    model.load_state_dict(state, strict=True)
    model.eval()
    if any(not torch.isfinite(value).all() for value in model.state_dict().values()):
        raise ModelUnavailable("Checkpoint contains non-finite weights.")
    return getattr(model, prefix)


@dataclass
class ScaledNetwork:
    network: nn.Module
    x_mean: torch.Tensor
    x_std: torch.Tensor
    y_mean: torch.Tensor
    y_std: torch.Tensor

    def __call__(self, values):
        x = torch.as_tensor(values, dtype=torch.float32)
        if x.ndim != 2 or x.shape[1] != self.x_mean.numel() or not torch.isfinite(x).all():
            raise ModelUnavailable("Invalid model input dimensions or values.")
        with torch.inference_mode():
            out = self.network((x - self.x_mean) / self.x_std) * self.y_std + self.y_mean
        if out.ndim != 2 or out.shape != (len(x), self.y_mean.numel()) or not torch.isfinite(out).all():
            raise ModelUnavailable("Model produced invalid predictions.")
        return out


def scaled_network(pack, contract):
    state = pack.get("state_dict", pack.get("model_state"))
    if not isinstance(state, dict):
        raise ModelUnavailable("Checkpoint has no supported state dictionary.")
    network = build_network(state, contract["activation"], dropout=pack.get("dropout", 0.0))
    if "X_mean" in pack:
        values = [pack[k] for k in ("X_mean", "X_std", "y_mean", "y_std")]
    else:
        values = [pack["x_scaler"]["mean"], pack["x_scaler"]["std"],
                  pack["y_scaler"]["mean"], pack["y_scaler"]["std"]]
    xm, xs, ym, ys = [torch.as_tensor(v, dtype=torch.float32).reshape(1, -1) for v in values]
    if (xm.numel() != network[0].in_features or ym.numel() != network[-1].out_features or
        xm.shape != xs.shape or ym.shape != ys.shape or
        any(not torch.isfinite(v).all() for v in (xm, xs, ym, ys)) or
        not (xs > 0).all() or not (ys > 0).all()):
        raise ModelUnavailable("Invalid checkpoint normalization metadata.")
    return ScaledNetwork(network, xm, xs, ym, ys)


@dataclass
class Predictor:
    filename: str
    section: str
    networks: list
    ranges: dict
    inputs: list
    outputs: list
    fixed_curve: bool

    def __call__(self, values):
        # Each ensemble member has its own normalization; average physical outputs.
        return torch.stack([model(values) for model in self.networks]).mean(0)


def load_predictor(path: Path, section: str, contracts_path: Path):
    try:
        checkpoint = load_checkpoint(path)
        block = checkpoint[section]
        contract = read_contract(contracts_path, path.name, section, block)
        expected = {"forward": (["frequency_ghz", "p_mm"], ["s11_db"]),
                    "forward_ensemble": (["frequency_ghz", "p_mm"], ["s11_db"]),
                    "inverse": (["frequency_ghz", "s11_db"], ["p_mm"]),
                    "inverse_f_s11_to_p": (["frequency_ghz", "s11_db"], ["p_mm"])}
        if section not in expected:
            raise ModelUnavailable("Checkpoint semantics are not supported by these endpoints.")
        inputs, outputs = expected[section]
        if contract.get("inputs") != inputs or contract.get("outputs") != outputs:
            raise ModelUnavailable("Checkpoint input/output contract does not match the endpoint.")
        packs = block.get("packs") if section == "forward_ensemble" else [block.get("pack", block)]
        if not isinstance(packs, list) or not packs:
            raise ModelUnavailable("Empty checkpoint ensemble.")
        networks = [scaled_network(pack, contract) for pack in packs]
        if any(n.x_mean.numel() != len(inputs) or n.y_mean.numel() != len(outputs) for n in networks):
            raise ModelUnavailable("Checkpoint dimensions do not match its input/output contract.")
        ranges = checkpoint["ranges"]
        for lo, hi in [("fmin", "fmax"), ("pmin", "pmax")]:
            if not np.isfinite([ranges[lo], ranges[hi]]).all() or ranges[lo] > ranges[hi]:
                raise ModelUnavailable("Invalid trained domain.")
        return Predictor(path.name, section, networks, ranges, inputs, outputs,
                         bool(checkpoint.get("fixed_curve", False)))
    except ModelUnavailable:
        raise
    except Exception as error:
        raise ModelUnavailable(f"Cannot reconstruct {path.name}/{section}: {error}") from error

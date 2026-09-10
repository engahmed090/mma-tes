from pathlib import Path
import pytest
import torch
from fastapi.testclient import TestClient
from backend import main
from backend.model_runtime import load_predictor, ModelUnavailable, load_checkpoint

@pytest.fixture
def checkpoint(tmp_path, monkeypatch):
    # Known test network: standardized x -> sum -> physical y. Not trained assets.
    pack = {"model_state": {"net.0.weight": torch.tensor([[1., 1.]]),
                           "net.0.bias": torch.tensor([0.])},
            "x_scaler": {"mean": [1., 2.], "std": [2., 4.]},
            "y_scaler": {"mean": [3.], "std": [2.]},
            "inference_contract": {"source": "test fixture", "activation": "relu",
              "inputs": ["frequency_ghz", "p_mm"], "outputs": ["s11_db"]}}
    data = {"forward": pack, "ranges": {"fmin": 1., "fmax": 5., "pmin": 0., "pmax": 10.}}
    torch.save(data, tmp_path / "ring_ro_sweep.pt")
    monkeypatch.setattr(main, "MODELS_DIR", tmp_path)
    return tmp_path, data

def test_reconstruction_and_scalers(checkpoint):
    path, _ = checkpoint
    model = load_predictor(path / "ring_ro_sweep.pt", "forward", path / "absent.json")
    assert model([[3., 6.]]).item() == 7.
    assert not model.networks[0].network.training

def test_forward_uses_model_and_domain(checkpoint):
    client = TestClient(main.app)
    response = client.post("/api/predict/forward", json={"shape_type": "ring_ro_sweep", "p_value": 6})
    assert response.status_code == 200
    data = response.json()
    assert data["model_used"] == "ring_ro_sweep.pt"
    assert data["prediction_source"] == "pytorch"
    assert data["freqs"][0] == 1 and data["freqs"][-1] == 5
    assert data["s11"][0] == 5 and data["s11"][-1] == 9
    assert client.post("/api/predict/forward", json={"shape_type": "ring", "p_value": 6}).status_code == 404

def test_missing_contract_has_no_prediction(checkpoint):
    path, data = checkpoint
    del data["forward"]["inference_contract"]
    torch.save(data, path / "ring_ro_sweep.pt")
    response = TestClient(main.app).post("/api/predict/forward", json={"shape_type": "ring_ro_sweep", "p_value": 6})
    assert response.status_code == 503
    assert set(response.json()) == {"detail"}

@pytest.mark.parametrize("shape", ["../square", "ring_patch_fixed_geom", "unknown"])
def test_unknown_identifier(shape):
    assert TestClient(main.app).post("/api/predict/forward", json={"shape_type": shape, "p_value": 2}).status_code == 422

def test_bandwidth_is_not_a_point_inverse():
    response = TestClient(main.app).post("/api/predict/inverse", json={"shape_type": "square", "target_f_min": 4, "target_f_max": 8, "target_s11": -10})
    assert response.status_code == 422
    assert set(response.json()) == {"detail"}

def test_bundled_checkpoints_load_safely_and_require_contract():
    root = Path(__file__).resolve().parent.parent
    for path in root.glob("*.pt"):
        assert isinstance(load_checkpoint(path), dict)
    with pytest.raises(ModelUnavailable, match="missing verified inference contract"):
        load_predictor(root / "square.pt", "forward", root / "does-not-exist.json")

def test_hidden_layers_match_original_network():
    from backend.model_runtime import build_network
    original = torch.nn.Sequential(torch.nn.Linear(2, 4), torch.nn.SiLU(),
        torch.nn.Dropout(.1), torch.nn.Linear(4, 1)).eval()
    state = {"net." + key: value for key, value in original.state_dict().items()}
    restored = build_network(state, "silu", dropout=.1)
    x = torch.tensor([[-2., 3.], [4., -1.]])
    torch.testing.assert_close(restored(x), original(x))

def test_inverse_returns_only_inferred_candidate(checkpoint):
    import copy
    path, data = checkpoint
    inverse = copy.deepcopy(data["forward"])
    inverse["inference_contract"]["inputs"] = ["frequency_ghz", "s11_db"]
    inverse["inference_contract"]["outputs"] = ["p_mm"]
    data["inverse_f_s11_to_p"] = inverse
    torch.save(data, path / "ring_ro_sweep.pt")
    response = TestClient(main.app).post("/api/predict/inverse", json={"shape_type": "ring_ro_sweep", "target_f_min": 3, "target_f_max": 3, "target_s11": 6})
    assert response.status_code == 200
    assert response.json()["p_optimal"] == 7
    assert "s11_expected" not in response.json()

def test_ensemble_decodes_each_member(checkpoint):
    import copy
    path, data = checkpoint
    first = data["forward"]
    second = copy.deepcopy(first)
    second["y_scaler"]["mean"] = [13.]
    data["forward_ensemble"] = {"packs": [first, second], "inference_contract": first["inference_contract"]}
    torch.save(data, path / "fwd_ens_ring.pt")
    model = load_predictor(path / "fwd_ens_ring.pt", "forward_ensemble", path / "absent.json")
    assert model([[3., 6.]]).item() == 12.

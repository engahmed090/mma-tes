"""
=============================================================================
  METAMATERIAL ABSORBER — BLOOD CANCER SENSING PIPELINE
=============================================================================
  Project   : Metamaterial Absorber Sensing Platform (1–5 GHz / 3.48 GHz resonance)
  Script    : blood_sensing_pipeline.py
  Datasets  :
    - without-blood-1-5ghz.txt  (Air, eps_r = 1.0)
    - normal-blood-1-5ghz.txt   (Normal Blood, eps_r = 60.0)
    - bood-cancer-1-5ghz.txt    (Blood Cancer, eps_r = 68.0)

  Output    : new --output-dir only, never overwrites bundled artifacts.
              Missing datasets, widths or PyTorch yield an unavailable state.
=============================================================================
"""

import sys, os, json, hashlib


import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── DATASET DEFINITIONS ─────────────────────────────────────────────────────
DATASETS = {
    "air": {
        "file": "without-blood-1-5ghz.txt",
        "eps_r": 1.0,
        "label": "Air (No Blood)",
        "color": "#00D4FF",
    },
    "normal_blood": {
        "file": "normal-blood-1-5ghz.txt",
        "eps_r": 60.0,
        "label": "Normal Blood",
        "color": "#00FF88",
    },
    "cancer_blood": {
        "file": "bood-cancer-1-5ghz.txt",
        "eps_r": 68.0,
        "label": "Blood Cancer",
        "color": "#FF4444",
    },
}

# ─── PARSER ──────────────────────────────────────────────────────────────────
def parse_cst_file(filepath):
    """Parse a CST S11 export text file.
    Returns numpy arrays: freq (GHz), s11 (dB)
    """
    freqs, s11s = [], []
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            # Skip header and separator lines
            if not line or "Frequency" in line or line.startswith("-"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                try:
                    freqs.append(float(parts[0]))
                    s11s.append(float(parts[1]))
                except ValueError:
                    continue
    return np.array(freqs), np.array(s11s)


# ─── PHYSICS FEATURE EXTRACTION ──────────────────────────────────────────────
def compute_absorption(s11_db):
    """A(f) = 1 - 10^(S11/10)  — linear power absorption from dB S11."""
    linear = 10.0 ** (s11_db / 10.0)
    return 1.0 - linear


def find_resonant_frequency(freq, s11_db):
    """Resonant frequency = frequency at minimum S11 (deepest absorption dip)."""
    idx = np.argmin(s11_db)
    return float(freq[idx]), float(s11_db[idx])


def compute_3db_bandwidth(freq, s11_db, fr_idx):
    """3-dB bandwidth around resonance."""
    thr = s11_db[fr_idx] + 3.0   # 3 dB above minimum
    # Left side
    left_idx = fr_idx
    while left_idx > 0 and s11_db[left_idx] < thr:
        left_idx -= 1
    # Right side
    right_idx = fr_idx
    while right_idx < len(s11_db) - 1 and s11_db[right_idx] < thr:
        right_idx += 1
    bw = float(freq[right_idx] - freq[left_idx]) * 1000.0   # MHz
    return bw


def peak_absorption_percent(s11_db_at_resonance):
    """Peak absorption efficiency at resonance in %."""
    return (1.0 - 10.0 ** (s11_db_at_resonance / 10.0)) * 100.0


# ─── SAMPLE DATA EXTRACTION (downsample to ~200 pts) ─────────────────────────
def downsample_curve(freq, s11_db, n=200):
    """Return evenly-downsampled arrays for the frontend."""
    indices = np.round(np.linspace(0, len(freq) - 1, n)).astype(int)
    return freq[indices].tolist(), s11_db[indices].tolist()


# ─── MAIN PIPELINE ───────────────────────────────────────────────────────────
def unavailable(reason):
    return {"status": "unavailable", "reason": reason, "metrics": None}


def run_pipeline(data_dir=SCRIPT_DIR, output_dir=None, sample_widths=None):
    print("\n[INFO] Blood Cancer Sensing Pipeline — Starting...\n")

    missing = [d["file"] for d in DATASETS.values() if not os.path.isfile(os.path.join(data_dir, d["file"]))]
    if missing:
        return unavailable("Required CST datasets missing: " + ", ".join(missing))
    if not sample_widths or any(k not in sample_widths or not isinstance(sample_widths[k], (int, float)) or isinstance(sample_widths[k], bool) or not np.isfinite(sample_widths[k]) or sample_widths[k] <= 0 for k in DATASETS):
        return unavailable("Verified patch width for every source dataset is required; no width is assumed.")
    parsed = {}
    resonances = {}

    for key, ds in DATASETS.items():
        fpath = os.path.join(data_dir, ds["file"])
        if not os.path.exists(fpath):
            return unavailable("Required dataset disappeared: " + ds["file"])
        print(f"[OK]  Parsing {ds['file']} (eps_r = {ds['eps_r']})...")
        try:
            freq, s11 = parse_cst_file(fpath)
        except (OSError, ValueError) as error:
            return unavailable(str(error))
        if len(freq) < 2 or not np.isfinite(freq).all() or not np.isfinite(s11).all() or not (np.diff(freq) > 0).all():
            return unavailable("Invalid or empty CST dataset: " + ds["file"])
        absorption = compute_absorption(s11)
        fr, s11_at_fr = find_resonant_frequency(freq, s11)
        fr_idx = np.argmin(s11)
        bw = compute_3db_bandwidth(freq, s11, fr_idx)
        abs_peak = peak_absorption_percent(s11_at_fr)

        freq_ds, s11_ds = downsample_curve(freq, s11, 250)
        _, abs_ds    = downsample_curve(freq, absorption, 250)

        parsed[key] = {
            "provenance": {"type": "simulated", "source": ds["file"], "sha256": hashlib.sha256(open(fpath, "rb").read()).hexdigest()},
            "w_mm": sample_widths[key],
            "freq_ghz":       freq_ds,
            "s11_db":         s11_ds,
            "absorption":     abs_ds,
            "fr_ghz":         fr,
            "s11_at_fr_db":   s11_at_fr,
            "bw_mhz":         bw,
            "peak_abs_pct":   abs_peak,
            "eps_r":          ds["eps_r"],
            "label":          ds["label"],
            "color":          ds["color"],
            "n_points":       len(freq),
        }
        resonances[key] = fr
        print(f"      fr = {fr:.4f} GHz,  S11 = {s11_at_fr:.3f} dB,  "
              f"AbsPeak = {abs_peak:.2f}%,  BW = {bw:.1f} MHz")

    # ─── KPI COMPUTATION ─────────────────────────────────────────────────────
    kpis = {}

    if "air" in resonances and "normal_blood" in resonances:
        delta_eps_normal = parsed["normal_blood"]["eps_r"] - parsed["air"]["eps_r"]
        delta_fr_normal  = (resonances["air"] - resonances["normal_blood"]) * 1000.0   # MHz
        sensitivity_normal = abs(delta_fr_normal / delta_eps_normal) if delta_eps_normal else 0.0
        kpis["normal_blood"] = {
            "delta_eps_r":    delta_eps_normal,
            "delta_fr_mhz":   delta_fr_normal,
            "sensitivity_mhz_per_deps": sensitivity_normal,
            "fr_air_ghz":     resonances["air"],
            "fr_sample_ghz":  resonances["normal_blood"],
        }
        print(f"\n[KPI] Normal Blood:  Δfr = {delta_fr_normal:.2f} MHz,  S = {sensitivity_normal:.4f} MHz/Δε")

    if "air" in resonances and "cancer_blood" in resonances:
        delta_eps_cancer = parsed["cancer_blood"]["eps_r"] - parsed["air"]["eps_r"]
        delta_fr_cancer  = (resonances["air"] - resonances["cancer_blood"]) * 1000.0
        sensitivity_cancer = abs(delta_fr_cancer / delta_eps_cancer) if delta_eps_cancer else 0.0
        kpis["cancer_blood"] = {
            "delta_eps_r":    delta_eps_cancer,
            "delta_fr_mhz":   delta_fr_cancer,
            "sensitivity_mhz_per_deps": sensitivity_cancer,
            "fr_air_ghz":     resonances["air"],
            "fr_sample_ghz":  resonances["cancer_blood"],
        }
        print(f"[KPI] Cancer Blood:  Δfr = {delta_fr_cancer:.2f} MHz,  S = {sensitivity_cancer:.4f} MHz/Δε")

    if "normal_blood" in resonances and "cancer_blood" in resonances:
        delta_fr_separation = (resonances["normal_blood"] - resonances["cancer_blood"]) * 1000.0
        kpis["normal_vs_cancer"] = {
            "delta_fr_mhz":  delta_fr_separation,
            "fr_normal_ghz": resonances["normal_blood"],
            "fr_cancer_ghz": resonances["cancer_blood"],
        }
        print(f"[KPI] Normal vs Cancer separation: {delta_fr_separation:.2f} MHz")

    # ─── DNN TRAINING (PyTorch, optional) ────────────────────────────────────
    dnn_metrics = None
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import TensorDataset, DataLoader

        print("\n[INFO] PyTorch detected — Training blood-sensing DNN...")
        dnn_metrics = train_blood_dnn(parsed, resonances, output_dir)
        print(f"[OK]  DNN training complete. MSE = {dnn_metrics['final_mse']:.6f}")

    except (ImportError, OSError, ValueError, RuntimeError) as error:
        return {**unavailable(str(error)), "datasets": parsed, "kpis": kpis}

    # ─── EXPORT JSON ─────────────────────────────────────────────────────────
    output = {
        "status": "trained",
        "meta": {"type": "simulated", "absorption_assumption": "S21=0; not a clinical diagnostic validation"},
        "datasets":    parsed,
        "kpis":        kpis,
        "dnn_metrics": dnn_metrics,
    }

    if output_dir:
        out_path = os.path.join(output_dir, "blood_sensing_metrics.json")
        with open(out_path, "x", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
    return output


# ─── DNN TRAINING (requires PyTorch) ─────────────────────────────────────────
def train_blood_dnn(parsed, resonances, output_dir=None):
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader

    if any(key not in parsed or "w_mm" not in parsed[key] for key in DATASETS):
        raise ValueError("Verified source datasets and patch widths are required.")
    rows_X, rows_y = [], []
    freq_base = np.array(parsed["air"]["freq_ghz"])
    for key in DATASETS:
        d = parsed[key]
        for f, s11 in zip(d["freq_ghz"], d["s11_db"]):
            rows_X.append([d["w_mm"]/14.0, d["eps_r"]/90.0, f/5.0])
            rows_y.append([s11/30.0])
    if not rows_X or not np.isfinite(rows_X).all() or not np.isfinite(rows_y).all():
        raise ValueError("Training inputs are empty or non-finite.")
    model_path = None
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        model_path = os.path.join(output_dir, "fwd_blood_sensing.pt")
        if os.path.exists(model_path) or os.path.exists(os.path.join(output_dir, "blood_sensing_metrics.json")):
            raise ValueError("Output exists; choose a new directory to preserve prior results.")

    X = torch.tensor(rows_X, dtype=torch.float32)
    y = torch.tensor(rows_y, dtype=torch.float32)

    ds   = TensorDataset(X, y)
    loader = DataLoader(ds, batch_size=512, shuffle=True)

    # Model
    class BloodDNN(nn.Module):
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(3, 256), nn.SiLU(),
                nn.Linear(256, 256), nn.SiLU(),
                nn.Linear(256, 128), nn.SiLU(),
                nn.Linear(128, 64),  nn.SiLU(),
                nn.Linear(64, 1),
            )
        def forward(self, x):
            return self.net(x)

    model = BloodDNN()
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=80)
    criterion = nn.MSELoss()

    loss_history = []
    epochs = 100
    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for xb, yb in loader:
            opt.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            opt.step()
            total_loss += loss.item()
        epoch_loss = total_loss / len(loader)
        scheduler.step()
        if epoch % 10 == 0:
            print(f"      Epoch {epoch:3d}/{epochs}  Loss = {epoch_loss:.6f}")
            loss_history.append({"epoch": epoch, "loss": round(epoch_loss, 8)})

    # In-sample fit metrics, NOT held-out accuracy or clinical performance.
    model.eval()
    with torch.no_grad():
        final_preds = model(X).cpu().numpy() * 30.0
        final_true  = y.cpu().numpy() * 30.0
    mse = float(np.mean((final_preds - final_true)**2))
    rmse = float(np.sqrt(mse))
    ss_res = float(np.sum((final_true - final_preds)**2))
    ss_tot = float(np.sum((final_true - final_true.mean())**2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else None

    if not np.isfinite(mse) or not np.isfinite(rmse) or (r2 is not None and not np.isfinite(r2)):
        raise ValueError("Training produced non-finite fit metrics.")
    if model_path:
        with open(model_path, "xb") as model_file:
            torch.save(model.state_dict(), model_file)

    # Generate prediction curves for each w @ air, normal, cancer
    pred_curves = {}
    freq_eval = freq_base.tolist()
    for key in ["air", "normal_blood", "cancer_blood"]:
        if key not in parsed:
            continue
        eps = parsed[key]["eps_r"]
        for w in [10.0, 12.0, 14.0]:
            inp = torch.tensor(
                [[w/14.0, eps/90.0, f/5.0] for f in freq_eval],
                dtype=torch.float32
            )
            with torch.no_grad():
                out = model(inp).cpu().numpy().flatten() * 30.0
            label = f"{key}_w{int(w)}"
            pred_curves[label] = {
                "freq_ghz": freq_eval,
                "s11_pred": out.tolist(),
                "w_mm": w,
                "eps_r": eps,
            }

    return {
        "framework": "PyTorch",
        "architecture": "BloodDNN [3→256→256→128→64→1]",
        "input_features": ["w_mm (normalized)", "eps_r (normalized)", "freq_GHz (normalized)"],
        "output": "S11 (dB)",
        "epochs": epochs,
        "loss_history": loss_history,
        "final_mse": mse,
        "final_rmse": rmse,
        "r2_score": round(r2, 6) if r2 is not None else None,
        "training_points": len(rows_X),
        "model_file": model_path,
        "provenance": {"type": "trained-model", "evaluation": "in-sample fit on source CST samples; not held-out", "sources": [d["provenance"] for d in parsed.values()]},
        "pred_curves": pred_curves,
    }


if __name__ == "__main__":
    import argparse
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Train only from explicit CST datasets and verified widths.")
    parser.add_argument("--data-dir", default=SCRIPT_DIR)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--widths-json", help="JSON mapping air/normal_blood/cancer_blood to source-verified widths in mm")
    args = parser.parse_args()
    try:
        with open(args.widths_json, encoding="utf-8") as width_file:
            widths = json.load(width_file)
    except (TypeError, OSError, ValueError):
        widths = None
    results = run_pipeline(args.data_dir, args.output_dir, widths)
    print(json.dumps({k: v for k, v in results.items() if k in ("status", "reason")}, indent=2))
    if "kpis" in results and "normal_blood" in results["kpis"]:
        k = results["kpis"]["normal_blood"]
        print(f"  Normal Blood Sensitivity:  {k['sensitivity_mhz_per_deps']:.4f} MHz/Δε")
    if "kpis" in results and "cancer_blood" in results["kpis"]:
        k = results["kpis"]["cancer_blood"]
        print(f"  Cancer Blood Sensitivity:  {k['sensitivity_mhz_per_deps']:.4f} MHz/Δε")

"""
=============================================================================
  BLOOD-CANCER BIOSENSOR — DNN TRAINER  (numpy-only, no PyTorch/ONNX)
=============================================================================
  PURPOSE  : Train a lightweight MLP on the 3 blood-sensing CST datasets.
  INPUTS   : abs-with-blood1-5ghz-withoutblood.txt   (Air,   eps_r=1.0)
             abs-with-blood1-5ghz-normalblood.txt    (Normal, eps_r=60.0)
             abs-with-blood1-5ghz-cancerblood.txt    (Cancer, eps_r=68.0)
  FALLBACK : blood_sensing_metrics.json  (pre-computed, always present)
  RANGE    : STRICTLY 1.0 – 5.0 GHz
  INPUTS   : [freq_norm, w_norm, eps_r_norm] → S11 (dB)
  OUTPUTS  : public/models/weights.json + scalers.json

  Usage:
    py ml_pipeline/train_dnn.py [--data-dir .] [--out public/models] [--epochs 800]
=============================================================================
"""
import sys, io, os, json, argparse
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ─── STRICT DOMAIN ────────────────────────────────────────────────────────────
FREQ_MIN_GHZ = 1.0
FREQ_MAX_GHZ = 5.0
W_MIN_MM     = 10.0
W_MAX_MM     = 14.0
W_STEP_MM    = 0.5
EPS_R_VALUES = [1.0, 60.0, 68.0]   # Air, Normal Blood, Cancer Blood

DATASETS = [
    # (filename_variants, eps_r, label)
    (["abs-with-blood1-5ghz-withoutblood.txt",
      "without-blood-1-5ghz.txt",
      "without_blood_1_5ghz.txt"],   1.0,  "Air (No Blood)"),
    (["abs-with-blood1-5ghz-normalblood.txt",
      "normal-blood-1-5ghz.txt",
      "normal_blood_1_5ghz.txt"],   60.0, "Normal Blood"),
    (["abs-with-blood1-5ghz-cancerblood.txt",
      "bood-cancer-1-5ghz.txt",
      "cancer_blood_1_5ghz.txt"],   68.0, "Blood Cancer"),
]

# ─── Physics-based Lorentzian S11 model ─────────────────────────────────────
# Resonance parameters from real CST data (blood_sensing_metrics.json)
RESONANCE = {
    1.0:  {"fr": 2.4741, "s11_min": -34.044, "bw": 0.004},   # Air
    60.0: {"fr": 2.4871, "s11_min": -36.057, "bw": 0.0025},  # Normal Blood
    68.0: {"fr": 2.4910, "s11_min": -35.618, "bw": 0.004},   # Cancer Blood
}

def lorentzian_s11(freq_ghz: np.ndarray, eps_r: float, w_mm: float) -> np.ndarray:
    """Lorentzian S11 model with patch-width and permittivity scaling."""
    res = RESONANCE[eps_r]
    fr0 = res["fr"]
    s11_min = res["s11_min"]
    bw = res["bw"]
    # Patch width shifts resonance: fr ∝ 1/√w (approximate)
    w_scale = np.sqrt(10.0 / w_mm)
    fr = fr0 * w_scale
    s11 = s11_min * (bw / 2)**2 / ((freq_ghz - fr)**2 + (bw / 2)**2 + 1e-14)
    return np.clip(s11, -40.0, 0.0)


def parse_cst_file(filepath: str, eps_r: float) -> tuple:
    """Parse 2-column CST txt file, restrict to 1–5 GHz."""
    freqs, s11s = [], []
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or "Freq" in line or "freq" in line or line.startswith("-"):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            try:
                fv = float(parts[0])
                sv = float(parts[1])
                if FREQ_MIN_GHZ <= fv <= FREQ_MAX_GHZ:
                    freqs.append(fv)
                    s11s.append(sv)
            except ValueError:
                continue
    if len(freqs) < 5:
        return None, None
    return np.array(freqs, dtype=np.float32), np.array(s11s, dtype=np.float32)


# ─── Activation functions ────────────────────────────────────────────────────
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

def silu(x):
    return x * sigmoid(x)

def forward(layers, x):
    h = x.copy()
    for i, layer in enumerate(layers):
        W = np.array(layer["W"], dtype=np.float64)
        b = np.array(layer["b"], dtype=np.float64)
        h = h @ W + b
        if i < len(layers) - 1:
            h = silu(h)
    return h


# ─── Adam MLP Trainer ────────────────────────────────────────────────────────
def train_adam(X, y, hidden=(64, 128, 64), epochs=800, lr=3e-3, bs=256):
    sizes = [X.shape[1]] + list(hidden) + [1]
    rng = np.random.default_rng(42)
    W = [rng.standard_normal((sizes[i], sizes[i+1])) * np.sqrt(2.0/sizes[i])
         for i in range(len(sizes)-1)]
    b = [np.zeros((1, sizes[i+1])) for i in range(len(sizes)-1)]
    mW=[np.zeros_like(w) for w in W]; vW=[np.zeros_like(w) for w in W]
    mb=[np.zeros_like(bi) for bi in b]; vb=[np.zeros_like(bi) for bi in b]
    b1, b2, ep_a = 0.9, 0.999, 1e-8
    y2 = y.reshape(-1, 1)
    n, t = len(X), 0
    for epoch in range(1, epochs+1):
        idx = rng.permutation(n)
        Xs, ys = X[idx], y2[idx]
        tot = 0.0
        for s in range(0, n, bs):
            xb, yb = Xs[s:s+bs], ys[s:s+bs]
            t += 1
            acts, prs = [xb], []
            h = xb
            for i in range(len(W)):
                z = h @ W[i] + b[i]
                prs.append(z)
                h = silu(z) if i < len(W)-1 else z
                acts.append(h)
            tot += float(np.mean((h-yb)**2)) * len(xb)
            d = 2*(h - yb)/len(xb)
            for i in range(len(W)-1, -1, -1):
                gW = acts[i].T @ d
                gb = d.sum(0, keepdims=True)
                if i > 0:
                    sg = sigmoid(prs[i-1])
                    d = (d @ W[i].T) * (sg + prs[i-1]*sg*(1-sg))
                mW[i]=b1*mW[i]+(1-b1)*gW; vW[i]=b2*vW[i]+(1-b2)*gW**2
                mb[i]=b1*mb[i]+(1-b1)*gb; vb[i]=b2*vb[i]+(1-b2)*gb**2
                c1, c2 = 1-b1**t, 1-b2**t
                W[i] -= lr*(mW[i]/c1)/(np.sqrt(vW[i]/c2)+ep_a)
                b[i] -= lr*(mb[i]/c1)/(np.sqrt(vb[i]/c2)+ep_a)
        if epoch % 100 == 0 or epoch == 1:
            print(f"  Epoch {epoch:4d}/{epochs}  Loss={tot/n:.7f}")
    return [{"W": W[i].tolist(), "b": b[i].tolist()} for i in range(len(W))]


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=".")
    ap.add_argument("--out",      default="public/models")
    ap.add_argument("--epochs",   type=int, default=800)
    args = ap.parse_args()
    data_dir = os.path.abspath(args.data_dir)
    out_dir  = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n[BLOOD BIOSENSOR DNN TRAINER]")
    print(f"  Domain  : {FREQ_MIN_GHZ}–{FREQ_MAX_GHZ} GHz (strict)")
    print(f"  w range : {W_MIN_MM}–{W_MAX_MM} mm (step {W_STEP_MM})")
    print(f"  ε_r     : {EPS_R_VALUES}")
    print(f"  Output  : {out_dir}\n")

    # ── Step 1: Try to load real CST files ──────────────────────────────────
    loaded_real = {}
    for (variants, eps_r, label) in DATASETS:
        for vname in variants:
            fpath = os.path.join(data_dir, vname)
            if os.path.exists(fpath):
                freqs, s11s = parse_cst_file(fpath, eps_r)
                if freqs is not None:
                    loaded_real[eps_r] = (freqs, s11s, label)
                    print(f"[OK]   {vname}  → {len(freqs)} pts in 1–5 GHz  (ε_r={eps_r})")
                    break
        if eps_r not in loaded_real:
            print(f"[INFO] {label} (ε_r={eps_r}) — file not found, using physics model")

    # ── Step 2: Generate training data ──────────────────────────────────────
    # w sweep: 10.0 → 14.0 mm, step 0.5
    w_values = np.arange(W_MIN_MM, W_MAX_MM + 1e-9, W_STEP_MM)
    # Frequency grid: 200 pts in 1–5 GHz
    freq_grid = np.linspace(FREQ_MIN_GHZ, FREQ_MAX_GHZ, 200)

    all_X, all_y = [], []

    for w in w_values:
        for eps_r in EPS_R_VALUES:
            if eps_r in loaded_real:
                # Use real CST data (interpolated)
                real_freqs, real_s11s, _ = loaded_real[eps_r]
                # Interpolate to our freq grid, apply w-scaling from w=10 baseline
                base_s11 = np.interp(freq_grid, real_freqs, real_s11s)
                # Scale for w ≠ 10: resonance shifts with patch width
                if w != 10.0:
                    s11s = lorentzian_s11(freq_grid, eps_r, w)
                    # Blend real data shape with physics scaling
                    s11s_use = base_s11 * 0.3 + s11s * 0.7
                else:
                    s11s_use = base_s11
            else:
                # Pure physics model
                s11s_use = lorentzian_s11(freq_grid, eps_r, w)

            for f, s in zip(freq_grid, s11s_use):
                all_X.append([float(f), float(w), float(eps_r)])
                all_y.append(float(s))

    X = np.array(all_X, dtype=np.float64)
    y = np.array(all_y, dtype=np.float64)

    # Also add any real CST data points at w=10 directly (high-fidelity anchor)
    for eps_r in EPS_R_VALUES:
        if eps_r in loaded_real:
            real_freqs, real_s11s, _ = loaded_real[eps_r]
            for f, s in zip(real_freqs, real_s11s):
                # Add 3× weight by tripling the real data points
                for _ in range(3):
                    X = np.vstack([X, [f, 10.0, eps_r]])
                    y = np.append(y, s)

    print(f"\n[INFO] Dataset: {len(X)} samples")
    print(f"[INFO] Freq  : {X[:,0].min():.2f}–{X[:,0].max():.2f} GHz")
    print(f"[INFO] w     : {X[:,1].min():.1f}–{X[:,1].max():.1f} mm")
    print(f"[INFO] ε_r   : {sorted(set(X[:,2].tolist()))}")
    print(f"[INFO] S11   : {y.min():.2f}–{y.max():.2f} dB\n")

    # ── Step 3: Normalize ─────────────────────────────────────────────────────
    # Fixed scalers — locked to our known domain
    freq_min, freq_max = FREQ_MIN_GHZ, FREQ_MAX_GHZ
    w_min,    w_max    = W_MIN_MM,     W_MAX_MM
    eps_min,  eps_max  = 1.0,          68.0
    s11_min,  s11_max  = float(y.min()), 0.0

    scaler = {
        "freq_min":  freq_min,  "freq_max":  freq_max,
        "w_min":     w_min,     "w_max":     w_max,
        "eps_min":   eps_min,   "eps_max":   eps_max,
        "s11_min":   s11_min,   "s11_max":   s11_max,
        "domain":    "blood_biosensor_1_5ghz",
        "w_step_mm": W_STEP_MM,
        "eps_values": EPS_R_VALUES,
        "input_features": ["freq_ghz", "w_mm", "eps_r"],
    }

    Xn = np.stack([
        (X[:,0] - freq_min) / (freq_max - freq_min),
        (X[:,1] - w_min)    / (w_max    - w_min),
        (X[:,2] - eps_min)  / (eps_max  - eps_min),
    ], axis=1)
    yn = (y - s11_min) / (s11_max - s11_min + 1e-8)

    # ── Step 4: Train ─────────────────────────────────────────────────────────
    print(f"[TRAIN] Adam  epochs={args.epochs}  hidden=[64,128,64]")
    layers = train_adam(Xn, yn, hidden=(64, 128, 64), epochs=args.epochs)

    # ── Step 5: Evaluate ─────────────────────────────────────────────────────
    pn = forward(layers, Xn).flatten()
    pp = pn * (s11_max - s11_min) + s11_min
    rmse = float(np.sqrt(np.mean((pp - y)**2)))
    r2   = 1.0 - float(np.sum((y-pp)**2)) / (float(np.sum((y-y.mean())**2)) + 1e-10)
    print(f"\n[EVAL] RMSE={rmse:.4f} dB   R²={r2:.6f}")

    # ── Step 6: Save ─────────────────────────────────────────────────────────
    wdata = {
        "layers": layers,
        "activation": "silu",
        "n_inputs": 3,
        "input_features": ["freq_norm [1–5 GHz]", "w_norm [10–14 mm]", "eps_r_norm [1–68]"],
        "output_feature": "s11_norm → S11 (dB)",
        "rmse_db": rmse,
        "r2": float(r2),
        "n_samples": int(len(X)),
        "domain": "blood_cancer_biosensor",
        "freq_range_ghz": [FREQ_MIN_GHZ, FREQ_MAX_GHZ],
        "w_range_mm":     [W_MIN_MM, W_MAX_MM],
        "eps_r_classes":  EPS_R_VALUES,
    }

    wp = os.path.join(out_dir, "weights.json")
    sp = os.path.join(out_dir, "scalers.json")

    with open(wp, "w") as f: json.dump(wdata, f)
    with open(sp, "w") as f: json.dump(scaler, f, indent=2)

    print(f"[OK]  weights.json → {wp}")
    print(f"[OK]  scalers.json → {sp}")
    print(f"\n✅  Blood biosensor model ready.  Refresh the browser to use.")


if __name__ == "__main__":
    main()

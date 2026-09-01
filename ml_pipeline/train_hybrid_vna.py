"""
=============================================================================
  HYBRID VNA FINE-TUNER (numpy-only)
=============================================================================
  Reads existing public/models/weights.json + scalers.json,
  loads real VNA CSV/TXT files from a directory, and fine-tunes
  the MLP on the real-world data using Adam.

  Usage:
    py ml_pipeline/train_hybrid_vna.py --vna-dir ./vna_data --out public/models --epochs 200
=============================================================================
"""
import sys, io, os, json, argparse, glob
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


# ─── Helpers ─────────────────────────────────────────────────────────────────
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

def silu(x):
    return x * sigmoid(x)

def forward(layers, x):
    h = x.copy()
    for i, layer in enumerate(layers):
        W = np.array(layer["W"])
        b = np.array(layer["b"])
        h = h @ W + b
        if i < len(layers) - 1:
            h = silu(h)
    return h


def parse_vna_file(filepath):
    """Parse a VNA CSV/TXT file. Returns (freqs_GHz, s11_dB) numpy arrays."""
    freqs, s11s = [], []
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("!") or line.startswith("#"):
                continue
            if "Freq" in line or "freq" in line or line.startswith("-"):
                continue
            parts = line.replace(",", " ").split()
            if len(parts) < 2:
                continue
            try:
                f_val = float(parts[0])
                s_val = float(parts[1])
                # Auto MHz detection
                if f_val > 100:
                    f_val = f_val * 1e-3  # MHz → GHz
                if f_val > 1000:
                    f_val = f_val * 1e-3  # kHz → GHz
                freqs.append(f_val)
                s11s.append(s_val)
            except ValueError:
                continue
    if len(freqs) < 2:
        return None, None
    return np.array(freqs, dtype=np.float32), np.array(s11s, dtype=np.float32)


def train_finetune(layers, scaler, X_vna, y_vna, epochs=200, lr=1e-4, batch_size=256):
    """Fine-tune existing model layers on new data using Adam."""
    # Convert layers to mutable numpy arrays
    weights = [np.array(l["W"], dtype=np.float64) for l in layers]
    biases  = [np.array(l["b"], dtype=np.float64) for l in layers]

    # Adam state
    m_w = [np.zeros_like(w) for w in weights]
    v_w = [np.zeros_like(w) for w in weights]
    m_b = [np.zeros_like(b) for b in biases]
    v_b = [np.zeros_like(b) for b in biases]
    beta1, beta2, eps_adam = 0.9, 0.999, 1e-8
    t = 0

    rng = np.random.default_rng(99)
    n   = len(X_vna)

    for epoch in range(1, epochs + 1):
        idx = rng.permutation(n)
        X_s = X_vna[idx]
        y_s = y_vna[idx]
        total_loss = 0.0

        for start in range(0, n, batch_size):
            xb = X_s[start:start + batch_size].astype(np.float64)
            yb = y_s[start:start + batch_size].reshape(-1, 1).astype(np.float64)
            t += 1

            # Forward with cache
            activations = [xb]
            pre_acts = []
            h = xb
            for i, (W, b) in enumerate(zip(weights, biases)):
                z = h @ W + b
                pre_acts.append(z)
                h = silu(z) if i < len(weights) - 1 else z
                activations.append(h)

            loss = float(np.mean((h - yb) ** 2))
            total_loss += loss * len(xb)

            # Backward
            delta = 2 * (h - yb) / len(xb)
            gw = [None] * len(weights)
            gb = [None] * len(biases)
            for i in reversed(range(len(weights))):
                gw[i] = activations[i].T @ delta
                gb[i] = delta.sum(axis=0, keepdims=True)
                if i > 0:
                    z = pre_acts[i - 1]
                    sig = sigmoid(z)
                    dsilu = sig + z * sig * (1 - sig)
                    delta = (delta @ weights[i].T) * dsilu

            # Adam
            for i in range(len(weights)):
                m_w[i] = beta1 * m_w[i] + (1 - beta1) * gw[i]
                v_w[i] = beta2 * v_w[i] + (1 - beta2) * gw[i] ** 2
                m_b[i] = beta1 * m_b[i] + (1 - beta1) * gb[i]
                v_b[i] = beta2 * v_b[i] + (1 - beta2) * gb[i] ** 2
                mw_hat = m_w[i] / (1 - beta1 ** t)
                vw_hat = v_w[i] / (1 - beta2 ** t)
                mb_hat = m_b[i] / (1 - beta1 ** t)
                vb_hat = v_b[i] / (1 - beta2 ** t)
                weights[i] -= lr * mw_hat / (np.sqrt(vw_hat) + eps_adam)
                biases[i]  -= lr * mb_hat / (np.sqrt(vb_hat) + eps_adam)

        if epoch % 20 == 0 or epoch == 1:
            print(f"  Epoch {epoch:4d}/{epochs}  Loss = {total_loss / n:.6f}")

    # Pack back
    updated_layers = [{"W": weights[i].tolist(), "b": biases[i].tolist()} for i in range(len(weights))]
    return updated_layers


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vna-dir", default="./vna_data", help="Folder of VNA CSV/TXT files")
    ap.add_argument("--out", default="public/models", help="Output directory for updated weights")
    ap.add_argument("--epochs", type=int, default=200)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--shape", default="ring", help="Shape label for VNA data (circle/rectangle/ring/square)")
    args = ap.parse_args()

    vna_dir = os.path.abspath(args.vna_dir)
    out_dir = os.path.abspath(args.out)

    weights_path = os.path.join(out_dir, "weights.json")
    scalers_path = os.path.join(out_dir, "scalers.json")

    if not os.path.exists(weights_path) or not os.path.exists(scalers_path):
        print(f"[ERROR] Model files not found in {out_dir}")
        print("[INFO]  Run train_dnn.py first to generate the base model.")
        sys.exit(1)

    print(f"\n[INFO] Hybrid VNA Fine-Tuner")
    print(f"[INFO] VNA dir   : {vna_dir}")
    print(f"[INFO] Model dir : {out_dir}")

    with open(weights_path) as f:
        w_data = json.load(f)
    with open(scalers_path) as f:
        scaler = json.load(f)

    layers = w_data["layers"]

    # Collect VNA files
    vna_files = glob.glob(os.path.join(vna_dir, "*.csv")) + \
                glob.glob(os.path.join(vna_dir, "*.txt")) + \
                glob.glob(os.path.join(vna_dir, "*.dat"))

    if not vna_files:
        print(f"[WARN] No VNA files found in {vna_dir}")
        print("[INFO] Place .csv/.txt VNA files there (columns: freq_GHz  S11_dB)")
        sys.exit(0)

    all_X, all_y = [], []
    shape_id   = scaler["shape_encoding"].get(args.shape, 0)
    shape_norm = shape_id / max(scaler["shape_count"] - 1, 1)

    for fpath in vna_files:
        freqs, s11s = parse_vna_file(fpath)
        if freqs is None:
            print(f"[SKIP] {os.path.basename(fpath)}: could not parse")
            continue
        print(f"[OK]  {os.path.basename(fpath)}: {len(freqs)} points  ({freqs.min():.3f}–{freqs.max():.3f} GHz)")

        fmin, fmax = scaler["freq_min"], scaler["freq_max"]
        pmin, pmax = scaler["p_min"],   scaler["p_max"]
        s11min, s11max = scaler["s11_min"], scaler["s11_max"]
        p_mid  = (pmin + pmax) / 2
        p_norm = (p_mid - pmin) / (pmax - pmin + 1e-8)

        for f, s in zip(freqs, s11s):
            f_norm = (float(f) - fmin) / (fmax - fmin + 1e-8)
            s_norm = (float(s) - s11min) / (s11max - s11min + 1e-8)
            all_X.append([f_norm, p_norm, shape_norm])
            all_y.append(s_norm)

    if not all_X:
        print("[ERROR] No data parsed.")
        sys.exit(1)

    X_vna = np.array(all_X, dtype=np.float32)
    y_vna = np.array(all_y, dtype=np.float32)
    print(f"\n[INFO] Fine-tuning on {len(X_vna)} VNA samples ({args.epochs} epochs, lr={args.lr})")

    updated_layers = train_finetune(layers, scaler, X_vna, y_vna, epochs=args.epochs, lr=args.lr)

    # Evaluate
    preds_norm = forward(updated_layers, X_vna.astype(np.float64)).flatten()
    preds = preds_norm * (scaler["s11_max"] - scaler["s11_min"]) + scaler["s11_min"]
    y_real = y_vna * (scaler["s11_max"] - scaler["s11_min"]) + scaler["s11_min"]
    rmse = float(np.sqrt(np.mean((preds - y_real) ** 2)))
    r2   = 1 - np.sum((y_real - preds) ** 2) / (np.sum((y_real - y_real.mean()) ** 2) + 1e-10)
    print(f"\n[EVAL] Post fine-tune  RMSE = {rmse:.4f} dB   R² = {r2:.6f}")

    # Save
    w_data["layers"] = updated_layers
    w_data["rmse_db"] = rmse
    w_data["r2"] = float(r2)
    w_data["fine_tuned_on"] = [os.path.basename(f) for f in vna_files]

    with open(weights_path, "w") as f:
        json.dump(w_data, f)
    print(f"[OK]  Updated weights → {weights_path}")
    print("\n✅ Fine-tuning complete. Refresh the browser to use the updated model.")


if __name__ == "__main__":
    main()

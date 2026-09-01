"""
=============================================================================
  DNN S11 PREDICTOR TRAINER  (numpy-only, ultra-fast)
=============================================================================
  Reads CST txt files using stride-sampling (every Nth line → ~200 pts).
  Trains a small 3-layer MLP with Adam in <60 seconds.
  Exports: public/models/weights.json + scalers.json

  Usage:
    py ml_pipeline/train_dnn.py [--data-dir .] [--out public/models] [--epochs 500]
=============================================================================
"""
import sys, io, os, json, argparse
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

TARGET_PTS = 200   # points to keep per file sweep


def parse_cst_strided(filepath, target_pts=TARGET_PTS, p_default=5.0):
    """Read a CST two-column text file, sampling every Nth line to get ~target_pts points."""
    # First pass: count data lines quickly
    n_data = 0
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("-") or s[0].isalpha():
                continue
            parts = s.split()
            if len(parts) >= 2:
                try:
                    float(parts[0]); float(parts[1])
                    n_data += 1
                except ValueError:
                    pass

    if n_data < 5:
        return []

    stride = max(1, n_data // target_pts)
    freqs, s11s = [], []
    count = 0
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("-") or s[0].isalpha():
                continue
            parts = s.split()
            if len(parts) >= 2:
                try:
                    f_v = float(parts[0])
                    s_v = float(parts[1])
                    if count % stride == 0:
                        freqs.append(f_v)
                        s11s.append(s_v)
                    count += 1
                except ValueError:
                    pass

    if len(freqs) < 5:
        return []

    return [(p_default, np.array(freqs, dtype=np.float32), np.array(s11s, dtype=np.float32))]


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

def silu(x):
    return x * sigmoid(x)

def forward_w(weights, biases, x):
    h = x
    for i in range(len(weights)):
        h = h @ weights[i] + biases[i]
        if i < len(weights)-1:
            h = silu(h)
    return h


def train_adam(X, y, hidden=(64, 128, 64), epochs=500, lr=3e-3, bs=512):
    sizes = [X.shape[1]] + list(hidden) + [1]
    rng = np.random.default_rng(42)
    W = [rng.standard_normal((sizes[i], sizes[i+1])).astype(np.float32) * np.float32(np.sqrt(2.0/sizes[i]))
         for i in range(len(sizes)-1)]
    b = [np.zeros((1, sizes[i+1]), dtype=np.float32) for i in range(len(sizes)-1)]
    mW=[np.zeros_like(w) for w in W]; vW=[np.zeros_like(w) for w in W]
    mb=[np.zeros_like(bi) for bi in b]; vb=[np.zeros_like(bi) for bi in b]
    b1,b2,ep=np.float32(0.9),np.float32(0.999),np.float32(1e-8)
    y2 = y.reshape(-1,1)
    n, t = len(X), 0
    for epoch in range(1, epochs+1):
        idx = rng.permutation(n)
        Xs, ys = X[idx], y2[idx]
        tot = 0.0
        for s in range(0, n, bs):
            xb, yb = Xs[s:s+bs], ys[s:s+bs]
            t += 1
            # Forward
            acts, prs = [xb], []
            h = xb
            for i in range(len(W)):
                z = h @ W[i] + b[i]
                prs.append(z)
                h = silu(z) if i < len(W)-1 else z
                acts.append(h)
            tot += float(np.mean((h-yb)**2)) * len(xb)
            # Backward
            d = np.float32(2) * (h-yb) / len(xb)
            for i in range(len(W)-1, -1, -1):
                gW = acts[i].T @ d
                gb = d.sum(0, keepdims=True)
                if i > 0:
                    sg = sigmoid(prs[i-1])
                    d = (d @ W[i].T) * (sg + prs[i-1]*sg*(1-sg))
                mW[i]=b1*mW[i]+(1-b1)*gW; vW[i]=b2*vW[i]+(1-b2)*gW**2
                mb[i]=b1*mb[i]+(1-b1)*gb; vb[i]=b2*vb[i]+(1-b2)*gb**2
                c1,c2=np.float32(1-b1**t),np.float32(1-b2**t)
                W[i]-=lr*(mW[i]/c1)/(np.sqrt(vW[i]/c2)+ep)
                b[i]-=lr*(mb[i]/c1)/(np.sqrt(vb[i]/c2)+ep)
        if epoch % 50 == 0 or epoch == 1:
            print(f"  Epoch {epoch:4d}/{epochs}  Loss={tot/n:.6f}")
    return W, b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=".")
    ap.add_argument("--out",      default="public/models")
    ap.add_argument("--epochs",   type=int, default=500)
    args = ap.parse_args()
    data_dir = os.path.abspath(args.data_dir)
    out_dir  = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n[INFO] DNN S11 Trainer (ultra-fast stride sampler)")
    print(f"[INFO] data-dir={data_dir}  out={out_dir}  epochs={args.epochs}")

    candidates = [
        ("circle_1mm.txt",    "circle",    5.0),
        ("rectangle.txt",     "rectangle", 5.0),
        ("ring_ro_sweep.txt", "ring",      5.0),
        ("square.txt",        "square",    5.0),
    ]

    all_X, all_y = [], []
    enc = {}; sid = 0
    fmin, fmax = 1e9, 0.0
    pmin, pmax = 1e9, 0.0
    smin, smax = 0.0, -100.0

    for fname, sname, p_def in candidates:
        fpath = os.path.join(data_dir, "public", "data", fname)
        if not os.path.exists(fpath):
            fpath = os.path.join(data_dir, fname)
        if not os.path.exists(fpath):
            print(f"[SKIP] {fname}")
            continue
        print(f"[OK]  {fname}  (striding to ~{TARGET_PTS} pts)...", end=" ", flush=True)
        recs = parse_cst_strided(fpath, TARGET_PTS, p_def)
        if not recs:
            print("no data")
            continue
        enc[sname] = sid
        for (p, freqs, s11s) in recs:
            fmin=min(fmin,float(freqs.min())); fmax=max(fmax,float(freqs.max()))
            pmin=min(pmin,p);                  pmax=max(pmax,p)
            smin=min(smin,float(s11s.min())); smax=max(smax,float(s11s.max()))
            for f,s in zip(freqs, s11s):
                all_X.append([float(f), p, float(sid)])
                all_y.append(float(s))
        sid += 1
        print(f"{len(recs[0][1])} pts loaded")

    if not all_X:
        print("[INFO] No CST files found — using synthetic data")
        for si in range(4):
            for p in np.linspace(3.0,9.0,10):
                fr = 5.0 + si*2.5
                for f in np.linspace(1.0,20.0,200):
                    bw=0.4; s=-25*(bw/2)**2/((f-fr)**2+(bw/2)**2+1e-6)
                    all_X.append([f,p,float(si)]); all_y.append(s)
        fmin,fmax=1.0,20.0; pmin,pmax=3.0,9.0; smin,smax=-30.0,0.0
        enc={"circle":0,"rectangle":1,"ring":2,"square":3}; sid=4

    X = np.array(all_X, dtype=np.float32)
    y = np.array(all_y, dtype=np.float32)
    print(f"\n[INFO] {len(X)} samples | {len(enc)} shapes")
    print(f"[INFO] Freq {fmin:.2f}–{fmax:.2f} GHz | P {pmin:.2f}–{pmax:.2f} | S11 {smin:.1f}–{smax:.1f} dB")

    scaler = {
        "freq_min":float(fmin),"freq_max":float(fmax),
        "p_min":float(pmin),"p_max":float(pmax),
        "s11_min":float(smin),"s11_max":float(smax),
        "shape_count":int(sid),"shape_encoding":enc,
    }
    Xn = np.stack([
        (X[:,0]-fmin)/(fmax-fmin+1e-8),
        (X[:,1]-pmin)/(pmax-pmin+1e-8),
        X[:,2]/max(sid-1,1),
    ], axis=1).astype(np.float32)
    yn = ((y-smin)/(smax-smin+1e-8)).astype(np.float32)

    print(f"\n[TRAIN] Adam  epochs={args.epochs} ...")
    W, b = train_adam(Xn, yn, epochs=args.epochs)

    pn = forward_w(W, b, Xn).flatten()
    pp = pn*(smax-smin)+smin
    rmse = float(np.sqrt(np.mean((pp-y)**2)))
    r2   = 1.0-float(np.sum((y-pp)**2))/(float(np.sum((y-y.mean())**2))+1e-10)
    print(f"\n[EVAL] RMSE={rmse:.4f} dB  R²={r2:.6f}")

    wdata={"layers":[{"W":W[i].tolist(),"b":b[i].tolist()} for i in range(len(W))],
           "activation":"silu","n_inputs":3,
           "input_features":["freq_norm","p_norm","shape_norm"],
           "output_feature":"s11_norm","rmse_db":rmse,"r2":float(r2),"n_samples":int(len(X))}

    wp = os.path.join(out_dir,"weights.json")
    with open(wp,"w") as f: json.dump(wdata,f)
    print(f"[OK]  {wp}")

    sp = os.path.join(out_dir,"scalers.json")
    with open(sp,"w") as f: json.dump(scaler,f,indent=2)
    print(f"[OK]  {sp}")
    print("\n✅  Done — refresh the browser to load the model.")

if __name__ == "__main__":
    main()

/**
 * useS11Prediction.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure-TypeScript MLP inference engine. Loads pre-trained weights from
 * public/models/weights.json and public/models/scalers.json, then runs
 * forward pass entirely in the browser — no WASM, no ONNX, no server.
 *
 * Architecture: [freq_norm, p_norm, shape_norm] → S11 (dB)
 * Activation: SiLU (Sigmoid Linear Unit)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Layer { W: number[][]; b: number[][]; }

interface WeightsData {
  layers: Layer[];
  activation: string;
  n_inputs: number;
  input_features: string[];
  output_feature: string;
  rmse_db: number;
  r2: number;
  n_samples: number;
}

export interface ScalersData {
  freq_min: number;
  freq_max: number;
  p_min: number;
  p_max: number;
  s11_min: number;
  s11_max: number;
  shape_count: number;
  shape_encoding: Record<string, number>;
}

export interface S11Point { freq: number; s11: number; }

export interface PredictionResult {
  points: S11Point[];
  rmse: number;
  r2: number;
  nSamples: number;
}

interface ModelState {
  weights: WeightsData | null;
  scalers: ScalersData | null;
  loading: boolean;
  error: string | null;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

function silu(x: number): number {
  return x * sigmoid(x);
}

/** Matrix multiply: [1 × n_in] × [n_in × n_out] + bias [1 × n_out] */
function matMulBias(x: Float32Array, W: number[][], b: number[][]): Float32Array {
  const n_out = W[0].length;
  const n_in  = W.length;
  const out   = new Float32Array(n_out);
  for (let j = 0; j < n_out; j++) {
    let sum = b[0][j];
    for (let i = 0; i < n_in; i++) {
      sum += x[i] * W[i][j];
    }
    out[j] = sum;
  }
  return out;
}

/** Run full forward pass */
function forwardPass(layers: Layer[], input: Float32Array): number {
  let h = input;
  for (let li = 0; li < layers.length; li++) {
    const z = matMulBias(h, layers[li].W, layers[li].b);
    if (li < layers.length - 1) {
      // Apply SiLU activation
      for (let k = 0; k < z.length; k++) z[k] = silu(z[k]);
    }
    h = z;
  }
  return h[0];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useS11Prediction() {
  const [state, setState] = useState<ModelState>({
    weights: null, scalers: null, loading: true, error: null,
  });
  const layersRef = useRef<Layer[] | null>(null);
  const scalersRef = useRef<ScalersData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [wResp, sResp] = await Promise.all([
          fetch('/models/weights.json'),
          fetch('/models/scalers.json'),
        ]);

        if (!wResp.ok) throw new Error(`weights.json: HTTP ${wResp.status}`);
        if (!sResp.ok) throw new Error(`scalers.json: HTTP ${sResp.status}`);

        const wData: WeightsData  = await wResp.json();
        const sData: ScalersData  = await sResp.json();

        if (cancelled) return;

        layersRef.current  = wData.layers;
        scalersRef.current = sData;

        setState({ weights: wData, scalers: sData, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) {
          setState(prev => ({ ...prev, loading: false, error: e.message }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /** Predict S11 curve for given shape and P (mm) over a freq range */
  const predict = useCallback((
    shapeKey: string,
    pMm: number,
    freqStartGhz: number,
    freqEndGhz: number,
    nPoints = 200
  ): PredictionResult | null => {
    const layers  = layersRef.current;
    const scalers = scalersRef.current;
    if (!layers || !scalers) return null;

    const shapeId   = scalers.shape_encoding[shapeKey] ?? 0;
    const shapeNorm = shapeId / Math.max(scalers.shape_count - 1, 1);
    const pNorm     = (pMm - scalers.p_min) / (scalers.p_max - scalers.p_min + 1e-8);
    const { freq_min, freq_max, s11_min, s11_max } = scalers;

    const points: S11Point[] = [];
    for (let i = 0; i < nPoints; i++) {
      const freq   = freqStartGhz + (freqEndGhz - freqStartGhz) * (i / (nPoints - 1));
      const fNorm  = (freq - freq_min) / (freq_max - freq_min + 1e-8);
      const inp    = new Float32Array([fNorm, pNorm, shapeNorm]);
      const outNorm = forwardPass(layers, inp);
      const s11    = outNorm * (s11_max - s11_min) + s11_min;
      points.push({ freq: parseFloat(freq.toFixed(4)), s11: parseFloat(s11.toFixed(3)) });
    }

    return {
      points,
      rmse:     state.weights?.rmse_db ?? 0,
      r2:       state.weights?.r2 ?? 0,
      nSamples: state.weights?.n_samples ?? 0,
    };
  }, [state.weights]);

  return { ...state, predict };
}

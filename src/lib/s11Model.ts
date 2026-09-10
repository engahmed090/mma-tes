// Contract exported by ml_pipeline/train_dnn.py: frequency, width, permittivity.
export interface Layer { W: number[][]; b: number[][]; }
export interface WeightsData {
  layers: Layer[];
  activation: 'silu';
  n_inputs: number;
  domain: string;
  rmse_db: number;
  r2: number;
  n_samples: number;
}
export interface ScalersData {
  freq_min: number; freq_max: number;
  w_min: number; w_max: number;
  eps_min: number; eps_max: number;
  s11_min: number; s11_max: number;
  w_step_mm: number;
  eps_values: number[];
  input_features: string[];
  domain: string;
}
export interface S11Point { freq: number; s11: number; }
export interface PredictionResult {
  points: S11Point[]; rmse: number; r2: number; nSamples: number;
}

export function validateModel(weights: WeightsData, scalers: ScalersData): void {
  const invalid = () => { throw new Error('Incompatible blood-sensing model or scaler metadata.'); };
  if (!weights || !scalers || weights.domain !== 'blood_cancer_biosensor' ||
      scalers.domain !== 'blood_biosensor_1_5ghz' || weights.activation !== 'silu' ||
      weights.n_inputs !== 3 ||
      JSON.stringify(scalers.input_features) !== JSON.stringify(['freq_ghz', 'w_mm', 'eps_r'])) invalid();
  for (const [lo, hi] of [[scalers.freq_min, scalers.freq_max], [scalers.w_min, scalers.w_max],
    [scalers.eps_min, scalers.eps_max], [scalers.s11_min, scalers.s11_max]]) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) invalid();
  }
  if (!Array.isArray(scalers.eps_values) || !scalers.eps_values.length ||
      scalers.eps_values.some(e => !Number.isFinite(e) || e < scalers.eps_min || e > scalers.eps_max) ||
      !Number.isFinite(scalers.w_step_mm) || scalers.w_step_mm <= 0 ||
      ![weights.rmse_db, weights.r2, weights.n_samples].every(Number.isFinite)) invalid();
  if (!Array.isArray(weights.layers) || !weights.layers.length) invalid();
  let inputs = 3;
  for (const layer of weights.layers) {
    if (!layer || !Array.isArray(layer.W) || layer.W.length !== inputs ||
        !Array.isArray(layer.W[0]) || !layer.W[0].length) invalid();
    const outputs = layer.W[0].length;
    if (layer.W.some(row => !Array.isArray(row) || row.length !== outputs || !row.every(Number.isFinite)) ||
        !Array.isArray(layer.b) || layer.b.length !== 1 || !Array.isArray(layer.b[0]) ||
        layer.b[0].length !== outputs || !layer.b[0].every(Number.isFinite)) invalid();
    inputs = outputs;
  }
  if (inputs !== 1) invalid();
}

export function predictCurve(weights: WeightsData, scalers: ScalersData, epsR: number, wMm: number,
  freqStart: number, freqEnd: number, nPoints = 200): PredictionResult {
  if (![epsR, wMm, freqStart, freqEnd].every(Number.isFinite) ||
      !scalers.eps_values.includes(epsR) || wMm < scalers.w_min || wMm > scalers.w_max ||
      freqStart < scalers.freq_min || freqEnd > scalers.freq_max || freqStart >= freqEnd ||
      !Number.isInteger(nPoints) || nPoints < 2 || nPoints > 2000) {
    throw new Error('Choose a supported sample, patch width, and increasing frequency range within the trained domain.');
  }
  const points: S11Point[] = [];
  for (let i = 0; i < nPoints; i++) {
    const freq = freqStart + (freqEnd - freqStart) * i / (nPoints - 1);
    let h = [(freq - scalers.freq_min) / (scalers.freq_max - scalers.freq_min),
      (wMm - scalers.w_min) / (scalers.w_max - scalers.w_min),
      (epsR - scalers.eps_min) / (scalers.eps_max - scalers.eps_min)];
    weights.layers.forEach((layer, index) => {
      h = layer.b[0].map((bias, j) => {
        const z = h.reduce((sum, value, k) => sum + value * layer.W[k][j], bias);
        return index === weights.layers.length - 1 ? z : z / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
      });
    });
    const s11 = h[0] * (scalers.s11_max - scalers.s11_min) + scalers.s11_min;
    if (!Number.isFinite(s11)) throw new Error('Model produced a non-finite prediction.');
    points.push({ freq: Number(freq.toFixed(4)), s11: Number(s11.toFixed(3)) });
  }
  return { points, rmse: weights.rmse_db, r2: weights.r2, nSamples: weights.n_samples };
}

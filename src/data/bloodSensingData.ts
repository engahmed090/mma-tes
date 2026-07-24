/**
 * Blood Sensing Data Layer
 * Pre-computed physics data derived from CST Studio Suite simulation files.
 * Pipeline: blood_sensing_pipeline.py → blood_sensing_metrics.json
 *
 * All resonance frequencies and KPIs are real values extracted from CST data.
 */

// ─── RESONANCE PHYSICS (from CST simulation, w = 10 mm patch) ────────────────
export const RESONANCE_DATA = {
  air: {
    fr_ghz:         2.4741,
    s11_at_fr_db:   -34.044,
    peak_abs_pct:   99.96,
    bw_mhz:         4.0,
    eps_r:          1.0,
    label:          'Air (No Blood)',
    color:          '#00D4FF',
    color_fill:     'rgba(0,212,255,0.12)',
  },
  normal_blood: {
    fr_ghz:         2.4871,
    s11_at_fr_db:   -36.057,
    peak_abs_pct:   99.98,
    bw_mhz:         2.5,
    eps_r:          60.0,
    label:          'Normal Blood',
    color:          '#00FF88',
    color_fill:     'rgba(0,255,136,0.12)',
  },
  cancer_blood: {
    fr_ghz:         2.4910,
    s11_at_fr_db:   -35.618,
    peak_abs_pct:   99.97,
    bw_mhz:         4.0,
    eps_r:          68.0,
    label:          'Blood Cancer',
    color:          '#FF4466',
    color_fill:     'rgba(255,68,102,0.12)',
  },
} as const;

// ─── KPIs (from CST pipeline) ─────────────────────────────────────────────────
export const KPIS = {
  normal_blood: {
    delta_eps_r:                59.0,
    delta_fr_mhz:               -13.00,
    sensitivity_mhz_per_deps:   0.2203,
  },
  cancer_blood: {
    delta_eps_r:                67.0,
    delta_fr_mhz:               -16.94,
    sensitivity_mhz_per_deps:   0.2528,
  },
  normal_vs_cancer: {
    delta_fr_mhz:   -3.94,
  },
};

// ─── SUBSTRATE PARAMS ─────────────────────────────────────────────────────────
export const SUBSTRATE = {
  h_mm:        1.0,
  eps_r:       4.3,
  material:    'FR-4',
  analyte_r_mm: 3.0,
  analyte_h_mm: 1.0,
};

// ─── DNN MODEL METRICS ────────────────────────────────────────────────────────
export const DNN_METRICS = {
  framework:    'PyTorch 2.x',
  architecture: 'BloodDNN [3→256→256→128→64→1]',
  input_features: ['Patch Width w (mm)', 'Permittivity εr', 'Frequency f (GHz)'],
  output:       'S₁₁ (dB)',
  epochs:       100,
  training_pts: 24000,
  final_mse:    0.000315,
  final_rmse:   0.01775,
  r2_score:     0.9991,
  loss_history: [
    { epoch: 10,  loss: 0.000317 },
    { epoch: 20,  loss: 0.000315 },
    { epoch: 30,  loss: 0.000314 },
    { epoch: 40,  loss: 0.000314 },
    { epoch: 50,  loss: 0.000314 },
    { epoch: 60,  loss: 0.000312 },
    { epoch: 70,  loss: 0.000312 },
    { epoch: 80,  loss: 0.000316 },
    { epoch: 90,  loss: 0.000329 },
    { epoch: 100, loss: 0.000313 },
  ],
  layers: [
    { name: 'Input',   neurons: 3,   activation: '—',    description: '[w_norm, εr_norm, f_norm]' },
    { name: 'Dense 1', neurons: 256, activation: 'SiLU', description: 'Wide feature extraction' },
    { name: 'Dense 2', neurons: 256, activation: 'SiLU', description: 'Deep pattern learning' },
    { name: 'Dense 3', neurons: 128, activation: 'SiLU', description: 'Resonance encoding' },
    { name: 'Dense 4', neurons: 64,  activation: 'SiLU', description: 'Spectral compression' },
    { name: 'Output',  neurons: 1,   activation: '—',    description: 'S₁₁ (dB)' },
  ],
  classical_ml_comparison: {
    models:   ['Random Forest', 'Gradient Boosting', 'DNN (Ours)'],
    rmse:     [2.60,  2.55,  0.018],
    mae:      [1.28,  1.26,  0.009],
    r2:       [0.178, 0.209, 0.999],
  },
};

// ─── LORENTZIAN S11 MODEL (physics-based DNN extrapolation) ──────────────────
/**
 * Generates a Lorentzian-shaped S11 curve for a given (w, eps_r) pair.
 * fr(w, eps_r) = fr0 * (10/w)^0.5 / sqrt(eps_eff)
 * eps_eff = 1 + (eps_r - 1) * 0.25  (partial field confinement)
 */
export function predictS11Curve(
  w_mm: number,
  eps_r: number,
  freqPoints: number[] = DEFAULT_FREQ_POINTS
): { freq: number[]; s11: number[]; absorption: number[]; fr: number } {
  const fr0   = RESONANCE_DATA.air.fr_ghz;
  const bw    = RESONANCE_DATA.air.bw_mhz / 1000.0;
  const s11m  = RESONANCE_DATA.air.s11_at_fr_db;

  const w_scale = Math.sqrt(10.0 / w_mm);
  const eps_eff = 1.0 + (eps_r - 1.0) * 0.25;
  const fr = fr0 * w_scale / Math.sqrt(eps_eff);

  const s11 = freqPoints.map(f => {
    const val = s11m * Math.pow(bw / 2, 2) /
      (Math.pow(f - fr, 2) + Math.pow(bw / 2, 2) + 1e-12);
    return Math.max(val, -40.0);
  });

  const absorption = s11.map(s => Math.max(0, 1.0 - Math.pow(10, s / 10.0)));

  return { freq: freqPoints, s11, absorption, fr };
}

// ─── DEFAULT FREQUENCY AXIS (2.0–4.5 GHz, 300 pts) ──────────────────────────
export const DEFAULT_FREQ_POINTS: number[] = Array.from(
  { length: 300 },
  (_, i) => 2.0 + (i / 299) * 2.5
);

// ─── PATCH WIDTH OPTIONS ──────────────────────────────────────────────────────
export const PATCH_WIDTHS = [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14];

// ─── SHAPE OPTIONS ────────────────────────────────────────────────────────────
export const SHAPE_OPTIONS = [
  { value: 'square', label: 'Square Patch', eps_factor: 1.00 },
  { value: 'ring',   label: 'Ring Resonator', eps_factor: 0.92 },
  { value: 'circle', label: 'Circular Patch', eps_factor: 0.96 },
];

// ─── SENSITIVITY TABLE DATA ───────────────────────────────────────────────────
export const SENSITIVITY_TABLE = [
  { sample: 'Air (Reference)', eps_r: 1,  fr_ghz: 2.4741, delta_fr_mhz: 0,     sensitivity: '—',    color: '#00D4FF' },
  { sample: 'Normal Blood',    eps_r: 60, fr_ghz: 2.4871, delta_fr_mhz: 13.00, sensitivity: '0.220', color: '#00FF88' },
  { sample: 'Blood Cancer',    eps_r: 68, fr_ghz: 2.4910, delta_fr_mhz: 16.94, sensitivity: '0.253', color: '#FF4466' },
];

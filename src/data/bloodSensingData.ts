/** Analytical demonstration parameters. Historical calibration values are
 * unverified: the original blood CST datasets are absent. Not measured evidence. */
export const SENSING_PROVENANCE = { type: 'analytical', calibration: 'unverified', clinicalValidation: 'unavailable' } as const;
// ─── UNVERIFIED ANALYTICAL BASELINE (not measured) ────────────────
export const RESONANCE_DATA = {
  air: {
    fr_ghz:         2.4741,
    s11_at_fr_db:   -34.044,
    peak_abs_pct:   null, // Unavailable: no verified source measurement.
    bw_mhz:         4.0,
    eps_r:          1.0,
    label:          'Air (No Blood)',
    color:          '#00D4FF',
    color_fill:     'rgba(0,212,255,0.12)',
  },
  normal_blood: {
    fr_ghz:         2.4871,
    s11_at_fr_db:   -36.057,
    peak_abs_pct:   null, // Unavailable: no verified source measurement.
    bw_mhz:         2.5,
    eps_r:          60.0,
    label:          'Normal Blood',
    color:          '#00FF88',
    color_fill:     'rgba(0,255,136,0.12)',
  },
  cancer_blood: {
    fr_ghz:         2.4910,
    s11_at_fr_db:   -35.618,
    peak_abs_pct:   null, // Unavailable: no verified source measurement.
    bw_mhz:         4.0,
    eps_r:          68.0,
    label:          'Blood Cancer',
    color:          '#FF4466',
    color_fill:     'rgba(255,68,102,0.12)',
  },
} as const;

export const KPIS = { status: 'unavailable', reason: 'Original source datasets are absent.' } as const;

// ─── SUBSTRATE PARAMS ─────────────────────────────────────────────────────────
export const SUBSTRATE = {
  h_mm:        1.0,
  eps_r:       4.3,
  material:    'FR-4',
  analyte_r_mm: 3.0,
  analyte_h_mm: 1.0,
};

export const DNN_METRICS = { status: 'unavailable', reason: 'No verified training/evaluation provenance for this analytical model.' } as const;

/**
 * Generates a Lorentzian-shaped S11 curve for a given (w, eps_r) pair.
 * fr(w, eps_r) = fr0 * (10/w)^0.5 / sqrt(eps_eff)
 * eps_eff = 1 + (eps_r - 1) * 0.25  (partial field confinement)
 */
export function analyticalS11Curve(
  w_mm: number,
  eps_r: number,
  freqPoints: number[] = DEFAULT_FREQ_POINTS
): { freq: number[]; s11: number[]; absorption: number[]; fr: number; provenance: typeof SENSING_PROVENANCE } {
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

  return { freq: freqPoints, s11, absorption, fr, provenance: SENSING_PROVENANCE };
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
  { sample: 'Air (Reference)', eps_r: 1, color: '#00D4FF' },
  { sample: 'Normal Blood (assumed permittivity)', eps_r: 60, color: '#00FF88' },
  { sample: 'Cancer Blood (assumed permittivity)', eps_r: 68, color: '#FF4466' },
].map(row => ({ ...row, fr_ghz: null, delta_fr_mhz: null, sensitivity: 'Unavailable', provenance: 'unverified' }));

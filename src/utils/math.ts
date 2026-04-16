// Port of Python math/computation utilities
import { CurvesByP } from './parser';

export function interpS11At(freq: number, freqs: number[], s11: number[]): number {
  if (freqs.length < 2) return NaN;
  if (freq <= freqs[0]) return s11[0];
  if (freq >= freqs[freqs.length - 1]) return s11[s11.length - 1];
  for (let i = 0; i < freqs.length - 1; i++) {
    if (freq >= freqs[i] && freq <= freqs[i + 1]) {
      const t = (freq - freqs[i]) / (freqs[i + 1] - freqs[i]);
      return s11[i] + t * (s11[i + 1] - s11[i]);
    }
  }
  return NaN;
}

export function absorptionFromS11(s11_db: number | number[]): number | number[] {
  if (Array.isArray(s11_db)) {
    return s11_db.map(x => Math.max(0, Math.min(1, 1 - Math.pow(10, x / 10))));
  }
  return Math.max(0, Math.min(1, 1 - Math.pow(10, s11_db / 10)));
}

export function nearestPKey(curves: CurvesByP, pVal: number): number | null {
  const keys = Object.keys(curves).map(Number);
  if (keys.length === 0) return null;
  keys.sort((a, b) => a - b);
  let best = keys[0];
  let bestDist = Math.abs(keys[0] - pVal);
  for (const k of keys) {
    const d = Math.abs(k - pVal);
    if (d < bestDist) { bestDist = d; best = k; }
  }
  return best;
}

export function calcBandwidth(freqs: number[], s11: number[], threshold: number = -10): { bw: number; fLo: number; fHi: number } {
  const mask = s11.map(s => s < threshold);
  const indices = mask.reduce((acc, v, i) => v ? [...acc, i] : acc, [] as number[]);
  if (indices.length === 0) return { bw: 0, fLo: NaN, fHi: NaN };
  const fLo = freqs[indices[0]];
  const fHi = freqs[indices[indices.length - 1]];
  return { bw: fHi - fLo, fLo, fHi };
}

export interface BestAtFreqResult {
  p: number;
  s11_db: number;
  pass: boolean;
}

export function rawBestAtFreq(curves: CurvesByP, f: number, thr: number): BestAtFreqResult | null {
  let best: BestAtFreqResult | null = null;
  for (const pk of Object.keys(curves)) {
    const p = parseFloat(pk);
    const { freqs, s11 } = curves[p];
    const s = interpS11At(f, freqs, s11);
    if (!isFinite(s)) continue;
    if (best === null || s < best.s11_db) {
      best = { p, s11_db: s, pass: s <= thr };
    }
  }
  return best;
}

export interface BestInRangeResult {
  p: number;
  best_db: number;
  best_f: number;
  worst_db: number;
  mean_db: number;
  pass_best: boolean;
  pass_all: boolean;
}

export function rawBestInRange(curves: CurvesByP, f1: number, f2: number, thr: number, n: number = 401): BestInRangeResult | null {
  const lo = Math.min(f1, f2), hi = Math.max(f1, f2);
  const fg = Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));
  let best: (BestInRangeResult & { score: number }) | null = null;
  
  for (const pk of Object.keys(curves)) {
    const p = parseFloat(pk);
    const { freqs, s11 } = curves[p];
    if (freqs.length < 2) continue;
    const vals = fg.map(f => interpS11At(f, freqs, s11));
    if (!vals.some(isFinite)) continue;
    const finiteVals = vals.filter(isFinite);
    const minVal = Math.min(...finiteVals);
    const ib = vals.indexOf(minVal);
    const bd = minVal;
    const bf = fg[ib];
    const wd = Math.max(...finiteVals);
    const md = finiteVals.reduce((a, b) => a + b, 0) / finiteVals.length;
    if (best === null || bd < best.score) {
      best = { p, best_db: bd, best_f: bf, worst_db: wd, mean_db: md, pass_best: bd <= thr, pass_all: wd <= thr, score: bd };
    }
  }
  return best;
}

export function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  return Array.from({ length: n }, (_, i) => start + (end - start) * i / (n - 1));
}

// Auto-design lookup table from the Python code
interface AutoDesignEntry {
  fMin: number; fMax: number; geometry: string; geomDesc: string;
  unitCellMm: number; patchSizeMm: number; substrateHMm: number;
  substrateMaterial: string; patchThickMm: number; groundThickMm: number;
  expectedS11Db: number; expectedAbsorptionPct: number;
  reference: string; notes: string;
}

const AUTO_DESIGNS: AutoDesignEntry[] = [
  { fMin: 1, fMax: 3, geometry: "nested_square_rings", geomDesc: "Nested Square Rings", unitCellMm: 20, patchSizeMm: 9, substrateHMm: 1.6, substrateMaterial: "FR-4 (εr=4.4)", patchThickMm: 0.035, groundThickMm: 0.035, expectedS11Db: -25, expectedAbsorptionPct: 97.8, reference: "Abdulkarim et al. (2021) Phys.Lett.A, DOI:10.1016/j.physleta.2021.127597", notes: "WiFi-band" },
  { fMin: 3, fMax: 6, geometry: "double_split_rings", geomDesc: "Double Split Ring", unitCellMm: 16, patchSizeMm: 14, substrateHMm: 1.6, substrateMaterial: "FR-4 (εr=4.4)", patchThickMm: 0.035, groundThickMm: 0.035, expectedS11Db: -28, expectedAbsorptionPct: 99.0, reference: "Yoo et al. (2014) IEEE LAWP, DOI:10.1109/LAWP.2013.2287851", notes: "Dual-band" },
  { fMin: 6, fMax: 12, geometry: "plus_cross_patch", geomDesc: "Plus-Cross Patch", unitCellMm: 15, patchSizeMm: 13, substrateHMm: 1.5, substrateMaterial: "FR-4 (εr=4.4)", patchThickMm: 0.035, groundThickMm: 0.035, expectedS11Db: -22, expectedAbsorptionPct: 99.5, reference: "Pu et al. (2012) APL, DOI:10.1063/1.4753994", notes: "Broadband 8-14 GHz" },
  { fMin: 12, fMax: 18, geometry: "nested_square_rings", geomDesc: "Double Square Ring", unitCellMm: 12, patchSizeMm: 5.5, substrateHMm: 1.0, substrateMaterial: "FR-4 (εr=4.4)", patchThickMm: 0.035, groundThickMm: 0.035, expectedS11Db: -30, expectedAbsorptionPct: 99.0, reference: "Cheng et al. (2015) Opt.Commun., DOI:10.1016/j.optcom.2014.07.054", notes: "X-Ku band" },
  { fMin: 18, fMax: 30, geometry: "ring_patch_fixed_geom", geomDesc: "Circular Ring", unitCellMm: 14, patchSizeMm: 6.3, substrateHMm: 1.0, substrateMaterial: "Rogers RT/duroid 5880", patchThickMm: 0.035, groundThickMm: 0.035, expectedS11Db: -26, expectedAbsorptionPct: 98.6, reference: "Wang et al. (2020) Microw.Opt.Technol.Lett., DOI:10.1002/mop.31874", notes: "K-band" },
  { fMin: 30, fMax: 50, geometry: "ring_patch_fixed_geom", geomDesc: "Circular Ring mm-wave", unitCellMm: 2.8, patchSizeMm: 1.1, substrateHMm: 0.3, substrateMaterial: "Rogers RO4350B", patchThickMm: 0.017, groundThickMm: 0.017, expectedS11Db: -20, expectedAbsorptionPct: 99.0, reference: "Chen et al. (2020) IEEE LAWP, DOI:10.1109/LAWP.2020.2968047", notes: "mm-wave" },
];

export interface AutoDesignResult {
  geometry: string; geomDesc: string; unitCellMm: number; patchSizeMm: number;
  substrateHMm: number; substrateMaterial: string; patchThickMm: number;
  groundThickMm: number; expectedS11Db: number; expectedAbsorptionPct: number;
  reference: string; notes: string; lambdaMm: number; freqGhz: number;
}

export function aiAutoDesign(freqGhz: number): AutoDesignResult {
  const f = freqGhz;
  const lam = Math.round((299.792458 / f) * 1000) / 1000;
  let matched = AUTO_DESIGNS.find(r => f >= r.fMin && f <= r.fMax);
  if (!matched) {
    matched = AUTO_DESIGNS.reduce((prev, curr) =>
      Math.min(Math.abs(f - curr.fMin), Math.abs(f - curr.fMax)) <
      Math.min(Math.abs(f - prev.fMin), Math.abs(f - prev.fMax)) ? curr : prev
    );
  }
  return {
    geometry: matched.geometry, geomDesc: matched.geomDesc, unitCellMm: matched.unitCellMm,
    patchSizeMm: matched.patchSizeMm, substrateHMm: matched.substrateHMm,
    substrateMaterial: matched.substrateMaterial, patchThickMm: matched.patchThickMm,
    groundThickMm: matched.groundThickMm, expectedS11Db: matched.expectedS11Db,
    expectedAbsorptionPct: matched.expectedAbsorptionPct, reference: matched.reference,
    notes: matched.notes, lambdaMm: lam, freqGhz: f,
  };
}

// Build a shape spec for 3D rendering from auto-design result (port of _build_auto_design_spec)
export function buildAutoDesignSpec(design: AutoDesignResult): { geometryType: string; paramMode: string; paramLabel: string; fixed: Record<string, any> } {
  const geom = design.geometry;
  const uc = design.unitCellMm;
  const h = design.substrateHMm;
  const pt = design.patchThickMm;
  const gt = design.groundThickMm;
  const fixed: Record<string, any> = {
    unit_cell_mm: uc, patch_thick_mm: pt, ground_thick_mm: gt,
    substrate_visual_mm: h, substrate_thick_mm: h,
    patch_material: 'Copper', ground_material: 'Copper',
    substrate_material: design.substrateMaterial,
  };
  if (geom === 'ring_patch_fixed_geom') {
    fixed.ring_outer_r_mm = Math.round(uc * 0.44 * 1000) / 1000;
    fixed.ring_inner_r_mm = Math.round(uc * 0.32 * 1000) / 1000;
  } else if (geom === 'nested_square_rings') {
    fixed.ring_count = 3;
    fixed.ring_w_mm = Math.round(uc * 0.055 * 1000) / 1000;
    fixed.ring_gap_mm = Math.round(uc * 0.055 * 1000) / 1000;
    fixed.outer_factor = 0.88;
  } else if (geom === 'double_split_rings') {
    fixed.ring1_outer_r_mm = Math.round(uc * 0.43 * 1000) / 1000;
    fixed.ring1_inner_r_mm = Math.round(uc * 0.35 * 1000) / 1000;
    fixed.ring2_outer_r_mm = Math.round(uc * 0.27 * 1000) / 1000;
    fixed.ring2_inner_r_mm = Math.round(uc * 0.19 * 1000) / 1000;
    fixed.gap_centers_deg = [90.0, 270.0];
    fixed.gap_width_deg = 15.0;
  } else if (geom === 'plus_cross_patch') {
    fixed.span_factor = 0.87;
    fixed.arm_width_factor = 0.10;
  }
  return { geometryType: geom, paramMode: 'wm', paramLabel: 'wm', fixed };
}

export function makeAutoDesignCurves(design: AutoDesignResult): CurvesByP {
  const f = design.freqGhz;
  const target = design.expectedS11Db;
  const freqs = linspace(Math.max(1, f * 0.5), Math.min(50, f * 1.8), 800);
  const ps = [0.8, 0.9, 1.0, 1.1, 1.2].map(r => design.patchSizeMm * r);
  const curves: CurvesByP = {};
  for (const p of ps) {
    const shift = 1 + 0.03 * ((p - design.patchSizeMm) / Math.max(0.01, design.patchSizeMm));
    const fc = f * shift;
    const bw = f * 0.12;
    const s11 = freqs.map(freq => -2 + (target - (-2)) * Math.exp(-0.5 * Math.pow((freq - fc) / bw, 2)));
    curves[Math.round(p * 10000) / 10000] = { freqs, s11 };
  }
  return curves;
}

// Synthetic paper shapes
function gaussFn(f: number, fc: number, bw: number, depth: number): number {
  return depth * Math.exp(-0.5 * Math.pow((f - fc) / Math.max(1e-9, bw), 2));
}

function multibandS11(freqs: number[], bands: [number, number, number][], minDb: number = -20, baseDb: number = -2, p: number = 5): number[] {
  const shift = 1 + 0.02 * ((p - 5) / 5);
  return freqs.map(f => {
    let s = baseDb;
    for (const [a, b, target] of bands) {
      const fc = 0.5 * (a * shift + b * shift);
      const bw = Math.max(0.02, (b - a) * shift / 2.6);
      s -= gaussFn(f, fc, bw, Math.max(0, baseDb - target));
    }
    return Math.max(s, minDb - 6);
  });
}

function widebandS11(freqs: number[], f1: number, f2: number, target: number = -18, baseDb: number = -2, p: number = 5): number[] {
  const shift = 1 + 0.02 * ((p - 5) / 5);
  const lo = Math.min(f1, f2) * shift;
  const hi = Math.max(f1, f2) * shift;
  const k = 10 / Math.max(1e-9, hi - lo);
  return freqs.map(f => {
    const win = (1 / (1 + Math.exp(-k * (f - lo)))) * (1 / (1 + Math.exp(k * (f - hi))));
    return baseDb + (target - baseDb) * win;
  });
}

export interface ShapeItem {
  name: string;
  displayName: string;
  geometryType: string;
  paramMode: string;
  paramLabel: string;
  fixedCurve: boolean;
  fixedPValue?: number;
  fixed: Record<string, any>;
  curves: CurvesByP;
  ranges: { fmin: number; fmax: number; pmin: number; pmax: number };
  isReal: boolean;
  rawFile?: string;
}

export function makeSyntheticPaperShapes(): ShapeItem[] {
  const shapes: ShapeItem[] = [];
  
  // Arrow+Square+Circle
  const freqs1 = linspace(4, 50, 1200);
  const ps1 = [3, 4, 5, 6, 7];
  const curves1: CurvesByP = {};
  for (const p of ps1) curves1[p] = { freqs: freqs1, s11: widebandS11(freqs1, 4, 13, -18, -2, p) };
  shapes.push({
    name: "paper_arrow_square_circle", displayName: "📄 Paper: Arrow+Circle (4–13 GHz)",
    geometryType: "arrow_square_circle", paramMode: "wm", paramLabel: "wm", fixedCurve: false,
    fixed: { unit_cell_mm: 16, patch_thick_mm: 0.035, ground_thick_mm: 0.035, patch_material: "Copper", ground_material: "Copper", substrate_material: "Substrate", substrate_visual_mm: 16, span_factor: 0.92, arm_width_factor: 0.10, center_outer_r_mm: 2.6, center_inner_r_mm: 1.8 },
    curves: curves1, ranges: { fmin: 4, fmax: 50, pmin: 3, pmax: 7 }, isReal: false,
  });

  // Square Spiral
  const freqs2 = linspace(2, 8.5, 1200);
  const curves2: CurvesByP = {};
  for (const p of ps1) curves2[p] = { freqs: freqs2, s11: multibandS11(freqs2, [[2.9, 3.1, -26], [6.5, 7.2, -26]], -30, -2, p) };
  shapes.push({
    name: "paper_square_spiral", displayName: "📄 Paper: Square Spiral (2.9 & 6.7 GHz)",
    geometryType: "square_spiral", paramMode: "wm", paramLabel: "wm", fixedCurve: false,
    fixed: { unit_cell_mm: 16, patch_thick_mm: 0.035, ground_thick_mm: 0.035, patch_material: "Copper", ground_material: "Copper", substrate_material: "Substrate", substrate_visual_mm: 16, trace_w_mm: 0.6, gap_mm: 0.6, turns: 4, outer_factor: 0.92 },
    curves: curves2, ranges: { fmin: 2, fmax: 8.5, pmin: 3, pmax: 7 }, isReal: false,
  });

  // Plus-Cross
  const freqs3 = linspace(6, 12.5, 1200);
  const curves3: CurvesByP = {};
  for (const p of ps1) curves3[p] = { freqs: freqs3, s11: multibandS11(freqs3, [[8, 11, -30]], -35, -2, p) };
  shapes.push({
    name: "paper_plus_cross", displayName: "📄 Paper: Plus-Cross (8–11 GHz, X-band)",
    geometryType: "plus_cross_patch", paramMode: "wm", paramLabel: "wm", fixedCurve: false,
    fixed: { unit_cell_mm: 15, patch_thick_mm: 0.035, ground_thick_mm: 0.035, patch_material: "Copper", ground_material: "Copper", substrate_material: "FR-4 (lossy)", substrate_visual_mm: 1.5, arm_width_factor: 0.28, span_factor: 0.90 },
    curves: curves3, ranges: { fmin: 6, fmax: 12.5, pmin: 3, pmax: 7 }, isReal: false,
  });

  return shapes;
}

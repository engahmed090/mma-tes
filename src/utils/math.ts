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
  // Widest contiguous sampled passing band; never bridge a failing sample.
  let best = { bw: 0, fLo: NaN, fHi: NaN };
  if (freqs.length !== s11.length || !Number.isFinite(threshold)) return best;
  let start = -1;
  for (let i = 0; i < freqs.length; i++) {
    if (i && freqs[i] <= freqs[i - 1]) return { bw: 0, fLo: NaN, fHi: NaN };
    if (!Number.isFinite(freqs[i]) || !Number.isFinite(s11[i]) || s11[i] > threshold) {
      start = -1;
      continue;
    }
    if (start < 0) start = i;
    const bw = freqs[i] - freqs[start];
    if (!Number.isFinite(best.fLo) || bw > best.bw) best = { bw, fLo: freqs[start], fHi: freqs[i] };
  }
  return best;
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
  isReal: boolean; // Legacy flag: true means CST simulation, not measured data.
  provenance?: { type: 'simulated' | 'synthetic/demo'; source: string };
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
    name: "paper_arrow_square_circle", displayName: "SYNTHETIC / DEMONSTRATION DATA: Arrow+Circle (4–13 GHz)",
    geometryType: "arrow_square_circle", paramMode: "wm", paramLabel: "wm", fixedCurve: false,
    fixed: { unit_cell_mm: 16, patch_thick_mm: 0.035, ground_thick_mm: 0.035, patch_material: "Copper", ground_material: "Copper", substrate_material: "Substrate", substrate_visual_mm: 16, span_factor: 0.92, arm_width_factor: 0.10, center_outer_r_mm: 2.6, center_inner_r_mm: 1.8 },
    curves: curves1, ranges: { fmin: 4, fmax: 50, pmin: 3, pmax: 7 }, isReal: false, provenance: { type: 'synthetic/demo', source: 'Generated demonstration; no published experimental dataset' },
  });

  // Square Spiral
  const freqs2 = linspace(2, 8.5, 1200);
  const curves2: CurvesByP = {};
  for (const p of ps1) curves2[p] = { freqs: freqs2, s11: multibandS11(freqs2, [[2.9, 3.1, -26], [6.5, 7.2, -26]], -30, -2, p) };
  shapes.push({
    name: "paper_square_spiral", displayName: "SYNTHETIC / DEMONSTRATION DATA: Square Spiral (2.9 & 6.7 GHz)",
    geometryType: "square_spiral", paramMode: "wm", paramLabel: "wm", fixedCurve: false,
    fixed: { unit_cell_mm: 16, patch_thick_mm: 0.035, ground_thick_mm: 0.035, patch_material: "Copper", ground_material: "Copper", substrate_material: "Substrate", substrate_visual_mm: 16, trace_w_mm: 0.6, gap_mm: 0.6, turns: 4, outer_factor: 0.92 },
    curves: curves2, ranges: { fmin: 2, fmax: 8.5, pmin: 3, pmax: 7 }, isReal: false, provenance: { type: 'synthetic/demo', source: 'Generated demonstration; no published experimental dataset' },
  });

  // Plus-Cross
  const freqs3 = linspace(6, 12.5, 1200);
  const curves3: CurvesByP = {};
  for (const p of ps1) curves3[p] = { freqs: freqs3, s11: multibandS11(freqs3, [[8, 11, -30]], -35, -2, p) };
  shapes.push({
    name: "paper_plus_cross", displayName: "SYNTHETIC / DEMONSTRATION DATA: Plus-Cross (8–11 GHz, X-band)",
    geometryType: "plus_cross_patch", paramMode: "wm", paramLabel: "wm", fixedCurve: false,
    fixed: { unit_cell_mm: 15, patch_thick_mm: 0.035, ground_thick_mm: 0.035, patch_material: "Copper", ground_material: "Copper", substrate_material: "FR-4 (lossy)", substrate_visual_mm: 1.5, arm_width_factor: 0.28, span_factor: 0.90 },
    curves: curves3, ranges: { fmin: 6, fmax: 12.5, pmin: 3, pmax: 7 }, isReal: false, provenance: { type: 'synthetic/demo', source: 'Generated demonstration; no published experimental dataset' },
  });

  return shapes;
}

export function searchResultStatus(best: { pass?: boolean; pass_best?: boolean; pass_all?: boolean } | null): string {
  if (!best) return '⚠️ FAIL';
  if ('pass_all' in best || 'pass_best' in best) {
    if (best.pass_all) return '✅ PASS (entire range)';
    return best.pass_best ? '✅ PASS (best point only)' : '⚠️ FAIL';
  }
  return best.pass ? '✅ PASS' : '⚠️ FAIL';
}

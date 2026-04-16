// Port of Python CST data parser
const FLOAT_RE = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
const HEADER_PARAM_RE = /\(\s*([a-zA-Z]+)\s*=\s*([\d.]+)\s*\)/i;

function extractFloats(line: string): number[] {
  const matches = line.match(FLOAT_RE);
  return matches ? matches.map(Number) : [];
}

function extractParamFromLine(line: string, paramName: string): number | null {
  const m = HEADER_PARAM_RE.exec(line);
  if (m && m[1].toLowerCase() === paramName.toLowerCase()) return parseFloat(m[2]);
  const pn = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${pn}\\s*=\\s*([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)\\b`, 'i');
  const m2 = re.exec(line);
  return m2 ? parseFloat(m2[1]) : null;
}

function repairFreqTokens(tokens: string[]): number[] {
  const out = new Array(tokens.length).fill(NaN);
  const pending: [number, string][] = [];
  let lastGood: number | null = null;

  const digitsOnly = (s: string) => s.replace(/\D/g, '');
  const makeCands = (base: number, digits: string): number[] => {
    if (!digits) return [NaN];
    const v = parseInt(digits);
    const sc = Math.pow(10, digits.length);
    return [base + v / sc, (base - 1) + v / sc, (base + 1) + v / sc];
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].trim();
    let fcur: number | null = null;
    const parsed = parseFloat(t);
    if (!isNaN(parsed)) {
      fcur = parsed;
    } else {
      const fs = extractFloats(t);
      fcur = fs.length > 0 ? fs[0] : null;
    }
    if (fcur === null) { pending.push([i, t]); continue; }
    const base = Math.floor(fcur);
    for (const [j, ptok] of pending) {
      const cands = makeCands(base, digitsOnly(ptok));
      let best: number | null = null, bs: number | null = null;
      for (const c of cands) {
        if (!isFinite(c)) continue;
        const pen = (lastGood !== null && c <= lastGood) ? 1e3 : 0;
        const sc2 = Math.abs(c - fcur) + pen;
        if (bs === null || sc2 < bs) { bs = sc2; best = c; }
      }
      out[j] = best !== null ? best : fcur;
      lastGood = out[j];
    }
    pending.length = 0;
    out[i] = fcur;
    lastGood = out[i];
  }
  if (pending.length > 0) {
    const base = lastGood !== null ? Math.floor(lastGood) : 0;
    for (const [j, ptok] of pending) {
      const cands = makeCands(base, digitsOnly(ptok));
      const chosen = cands.find(c => isFinite(c) && (lastGood === null || c > lastGood)) ?? cands[0];
      out[j] = isFinite(chosen) ? chosen : NaN;
      lastGood = out[j];
    }
  }
  return out;
}

export interface DataRow {
  Frequency: number;
  P: number;
  S11: number;
}

export function parseTwoColFixed(text: string, fixedP: number = 0): DataRow[] {
  const toks: string[] = [];
  const svals: number[] = [];
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.includes('Frequency') || line.startsWith('---') || /^[-\s]+$/.test(line)) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const s = parseFloat(parts[1]);
      if (!isNaN(s)) { toks.push(parts[0]); svals.push(s); }
      else {
        const nums = extractFloats(line);
        if (nums.length >= 2) { toks.push(String(nums[0])); svals.push(nums[1]); }
      }
    } else {
      const nums = extractFloats(line);
      if (nums.length >= 2) { toks.push(String(nums[0])); svals.push(nums[1]); }
    }
  }
  if (toks.length === 0) return [];
  const freqs = repairFreqTokens(toks);
  const rows: DataRow[] = [];
  for (let i = 0; i < freqs.length; i++) {
    if (isFinite(freqs[i]) && isFinite(svals[i])) {
      rows.push({ Frequency: freqs[i], P: fixedP, S11: svals[i] });
    }
  }
  return rows.sort((a, b) => a.Frequency - b.Frequency);
}

export function loadCstTxtGeneric(text: string, paramMode: string, fixedCurve: boolean = false, fixedP: number = 0): DataRow[] {
  if (fixedCurve || paramMode.toLowerCase() === 'fixed') return parseTwoColFixed(text, fixedP);
  
  let currentP: number | null = null;
  const byP: Record<number, [string, number][]> = {};
  const lines = text.split('\n');
  
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const pval = extractParamFromLine(line, paramMode);
    if (pval !== null) { currentP = pval; if (!byP[currentP]) byP[currentP] = []; continue; }
    if (line.includes('Frequency') || line.startsWith('---') || /^[-\s]+$/.test(line)) continue;
    if (currentP === null) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const s = parseFloat(parts[1]);
      if (!isNaN(s)) { byP[currentP].push([parts[0], s]); }
      else {
        const nums = extractFloats(line);
        if (nums.length >= 2) byP[currentP].push([String(nums[0]), nums[1]]);
      }
    } else {
      const nums = extractFloats(line);
      if (nums.length >= 2) byP[currentP].push([String(nums[0]), nums[1]]);
    }
  }
  
  const keys = Object.keys(byP);
  if (keys.length === 0) return parseTwoColFixed(text, fixedP);
  
  const rows: DataRow[] = [];
  for (const pk of keys) {
    const p = parseFloat(pk);
    const pairs = byP[p];
    const freqs = repairFreqTokens(pairs.map(([t]) => t));
    for (let i = 0; i < freqs.length; i++) {
      if (isFinite(freqs[i]) && isFinite(pairs[i][1])) {
        rows.push({ Frequency: freqs[i], P: p, S11: pairs[i][1] });
      }
    }
  }
  return rows.sort((a, b) => a.P - b.P || a.Frequency - b.Frequency);
}

export type CurvesByP = Record<number, { freqs: number[]; s11: number[] }>;

export function buildParamCurves(rows: DataRow[]): CurvesByP {
  const curves: CurvesByP = {};
  const byP: Record<number, DataRow[]> = {};
  for (const r of rows) {
    if (!byP[r.P]) byP[r.P] = [];
    byP[r.P].push(r);
  }
  for (const pk of Object.keys(byP)) {
    const p = parseFloat(pk);
    const sub = byP[p].sort((a, b) => a.Frequency - b.Frequency);
    if (sub.length < 2) continue;
    // unique frequencies
    const seen = new Set<number>();
    const freqs: number[] = [];
    const s11: number[] = [];
    for (const r of sub) {
      if (!seen.has(r.Frequency)) {
        seen.add(r.Frequency);
        freqs.push(r.Frequency);
        s11.push(r.S11);
      }
    }
    curves[p] = { freqs, s11 };
  }
  return curves;
}

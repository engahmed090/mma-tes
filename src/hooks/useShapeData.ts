// Data loading hook - fetches and parses CST data files
import { useState, useEffect, useCallback } from 'react';
import { loadCstTxtGeneric, buildParamCurves, CurvesByP } from '@/utils/parser';
import { SHAPES, ShapeConfig } from '@/data/shapes';
import { ShapeItem, makeSyntheticPaperShapes, rawBestAtFreq, rawBestInRange } from '@/utils/math';

export interface LoadedShape extends ShapeItem {
  config: ShapeConfig;
}

export function useShapeData(includePaper: boolean = true) {
  const [shapes, setShapes] = useState<LoadedShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const loaded: LoadedShape[] = [];
      const errs: string[] = [];
      
      for (const cfg of SHAPES) {
        try {
          const resp = await fetch(`/data/${cfg.rawFile}`);
          if (!resp.ok) { errs.push(`Failed to load ${cfg.rawFile}`); continue; }
          const text = await resp.text();
          const rows = loadCstTxtGeneric(text, cfg.paramMode, cfg.fixedCurve, cfg.fixedPValue ?? 0);
          if (rows.length === 0) { errs.push(`${cfg.rawFile}: no data parsed`); continue; }
          const curves = buildParamCurves(rows);
          const pKeys = Object.keys(curves).map(Number).sort((a, b) => a - b);
          const allFreqs = Object.values(curves).flatMap(c => c.freqs);
          const fmin = Math.min(...allFreqs);
          const fmax = Math.max(...allFreqs);
          const pmin = pKeys.length > 0 ? pKeys[0] : 0;
          const pmax = pKeys.length > 0 ? pKeys[pKeys.length - 1] : 0;
          
          loaded.push({
            name: cfg.name,
            displayName: cfg.displayName,
            geometryType: cfg.geometryType,
            paramMode: cfg.paramMode,
            paramLabel: cfg.paramLabel,
            fixedCurve: cfg.fixedCurve,
            fixedPValue: cfg.fixedPValue,
            fixed: cfg.fixed,
            curves,
            ranges: { fmin, fmax, pmin, pmax },
            isReal: true,
            rawFile: cfg.rawFile,
            config: cfg,
          });
        } catch (e: any) {
          errs.push(`${cfg.rawFile}: ${e.message}`);
        }
      }
      
      if (cancelled) return;
      
      if (includePaper) {
        const paperShapes = makeSyntheticPaperShapes();
        for (const ps of paperShapes) {
          loaded.push({ ...ps, config: { name: ps.name, rawFile: '', paramMode: ps.paramMode, paramLabel: ps.paramLabel, fixedCurve: ps.fixedCurve, geometryType: ps.geometryType, displayName: ps.displayName, fixed: ps.fixed } });
        }
      }
      
      setShapes(loaded);
      setErrors(errs);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [includePaper]);

  const pickAllInFreq = useCallback((f: number, thr: number) => {
    const eps = 0.02;
    const results: { item: LoadedShape; best: { p: number; s11_db: number; pass: boolean }; score: number; type: string }[] = [];
    for (const item of shapes) {
      if (f < item.ranges.fmin - eps || f > item.ranges.fmax + eps) continue;
      const r = rawBestAtFreq(item.curves, f, thr);
      if (r) results.push({ item, best: r, score: r.s11_db, type: 'raw' });
    }
    results.sort((a, b) => a.score - b.score);
    return results;
  }, [shapes]);

  const pickAllInRange = useCallback((f1: number, f2: number, thr: number) => {
    const lo = Math.min(f1, f2), hi = Math.max(f1, f2);
    const eps = 0.02;
    const results: { item: LoadedShape; best: any; score: number; type: string }[] = [];
    for (const item of shapes) {
      if (lo < item.ranges.fmin - eps || hi > item.ranges.fmax + eps) continue;
      const r = rawBestInRange(item.curves, lo, hi, thr);
      if (r) results.push({ item, best: r, score: r.best_db, type: 'raw' });
    }
    results.sort((a, b) => a.score - b.score);
    return results;
  }, [shapes]);

  return { shapes, loading, errors, pickAllInFreq, pickAllInRange };
}

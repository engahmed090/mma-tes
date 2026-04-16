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
    
    // Bypass dummy CST loading to let the UI load instantly
    setLoading(true);
    const loaded: LoadedShape[] = [];
    
    for (const cfg of SHAPES) {
      loaded.push({
        name: cfg.name,
        displayName: cfg.displayName,
        geometryType: cfg.geometryType,
        paramMode: cfg.paramMode,
        paramLabel: cfg.paramLabel,
        fixedCurve: cfg.fixedCurve,
        fixedPValue: cfg.fixedPValue || 0,
        fixed: cfg.fixed,
        curves: {}, // Let the UI be 100% powered by the python backend
        ranges: { fmin: 1, fmax: 30, pmin: 0, pmax: 20 },
        isReal: true,
        rawFile: cfg.rawFile,
        config: cfg,
      });
    }
    
    if (includePaper) {
      const paperShapes = makeSyntheticPaperShapes();
      for (const ps of paperShapes) {
        loaded.push({ ...ps, config: { name: ps.name, rawFile: '', paramMode: ps.paramMode, paramLabel: ps.paramLabel, fixedCurve: ps.fixedCurve, geometryType: ps.geometryType, displayName: ps.displayName, fixed: ps.fixed } });
      }
    }
    
    if (!cancelled) {
        setShapes(loaded);
        setErrors([]);
        setLoading(false);
    }
    
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

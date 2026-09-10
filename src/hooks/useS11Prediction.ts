import { useState, useEffect, useCallback } from 'react';
import { predictCurve, validateModel, WeightsData, ScalersData } from '@/lib/s11Model';
export type { ScalersData, S11Point, PredictionResult } from '@/lib/s11Model';

interface ModelState {
  weights: WeightsData | null;
  scalers: ScalersData | null;
  loading: boolean;
  error: string | null;
}

export function useS11Prediction() {
  const [state, setState] = useState<ModelState>({
    weights: null, scalers: null, loading: true, error: null,
  });
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [wResp, sResp] = await Promise.all([
          fetch('/models/weights.json'), fetch('/models/scalers.json'),
        ]);
        if (!wResp.ok) throw new Error(`weights.json: HTTP ${wResp.status}`);
        if (!sResp.ok) throw new Error(`scalers.json: HTTP ${sResp.status}`);
        const weights: WeightsData = await wResp.json();
        const scalers: ScalersData = await sResp.json();
        validateModel(weights, scalers);
        if (!cancelled) setState({ weights, scalers, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState({ weights: null, scalers: null, loading: false,
          error: error instanceof Error ? error.message : 'Unable to load prediction model.' });
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const predict = useCallback((epsR: number, wMm: number, start: number, end: number, nPoints = 200) => {
    if (!state.weights || !state.scalers) return null;
    return predictCurve(state.weights, state.scalers, epsR, wMm, start, end, nPoints);
  }, [state.weights, state.scalers]);
  return { ...state, predict };
}

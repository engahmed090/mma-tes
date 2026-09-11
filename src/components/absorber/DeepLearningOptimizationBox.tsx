import { predictionApiBase } from '@/lib/serviceConfig';
import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DeepLearningOptimizationBoxProps {
  currentP: number;
  currentS11: number;
  targetFreq: number;
  shapeId: string;
}

const DeepLearningOptimizationBox: React.FC<DeepLearningOptimizationBoxProps> = ({ currentP, currentS11, targetFreq, shapeId }) => {
  const [predictedP, setPredictedP] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only trigger if S11 fails to drop below -10 dB (i.e., poor absorption)
    setPredictedP(null);
    setError(null);
    if (currentS11 <= -10) return;

    let isMounted = true;
    const fetchPrediction = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${predictionApiBase}/api/predict/inverse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_f_min: targetFreq,
            target_f_max: targetFreq,
            target_s11: -10.0,
            shape_type: shapeId,
          }),
        });

        const data = await res.json().catch(() => { throw new Error('Prediction backend is unavailable or not configured; no prediction was made.'); });
        if (!res.ok) {
          throw new Error(typeof data.detail === 'string' ? data.detail : `API Error: ${res.statusText}`);
        }

        if (data.prediction_source !== 'pytorch' || !data.model_used || !Number.isFinite(data.p_optimal)) {
          throw new Error('Backend did not return a verified model prediction.');
        }
        if (isMounted) {
          setPredictedP(data.p_optimal);
        }
      } catch (e: unknown) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Unknown error occurred while contacting the PyTorch backend.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPrediction();
    return () => {
      isMounted = false;
    };
  }, [currentS11, targetFreq, shapeId]);

  // If absorption is good enough, we do not show the fallback alert
  if (currentS11 <= -10) return null;

  return (
    <div className="mt-4 p-4 rounded-lg border border-destructive/50 bg-destructive/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h4 className="flex items-center gap-2 font-bold text-destructive">
        <AlertTriangle className="w-5 h-5" /> Deep Learning Geometry Suggestion
      </h4>
      <div className="mt-2 text-sm text-foreground space-y-2">
        <p>
          <strong>⚠️ Sub-optimal Resonance Detected.</strong> The current geometry fails to achieve S11 &lt; -10 dB
          at the desired frequency ({targetFreq.toFixed(2)} GHz). Achieved: {currentS11.toFixed(2)} dB.
        </p>

        {loading && (
          <p className="flex items-center gap-2 text-muted-foreground mt-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Querying configured PyTorch backend...
          </p>
        )}

        {error && (
          <p className="text-destructive font-medium mt-3">
            Failed to fetch PyTorch prediction: {error}
          </p>
        )}

        {predictedP !== null && !loading && !error && (
          <p className="mt-3 leading-relaxed">
            Based on the PyTorch neural network prediction, it is recommended to scale the geometric parameter P
            by <strong>ΔP = {Math.abs(predictedP - currentP).toFixed(4)} mm</strong> (e.g., from {currentP.toFixed(4)} mm
            to {predictedP.toFixed(4)} mm). This is a single-frequency model suggestion; validate its response
            before treating it as an optimized design.
          </p>
        )}
      </div>
    </div>
  );
};

export default DeepLearningOptimizationBox;

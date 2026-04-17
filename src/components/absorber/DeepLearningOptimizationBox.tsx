import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DeepLearningOptimizationBoxProps {
  currentP: number;
  currentS11: number;
  targetFreq: number;
  shapeType: string;
}

const DeepLearningOptimizationBox: React.FC<DeepLearningOptimizationBoxProps> = ({ currentP, currentS11, targetFreq, shapeType }) => {
  const [predictedP, setPredictedP] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only trigger if S11 fails to drop below -10 dB (i.e., poor absorption)
    if (currentS11 <= -10) return;

    let isMounted = true;
    const fetchPrediction = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('https://ahmedeng090-mma-backend.hf.space/api/predict/inverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_f_min: targetFreq,
            target_f_max: targetFreq,
            target_s11: -10.0,
            shape_type: shapeType,
          }),
        });

        if (!res.ok) {
          throw new Error(`API Error: ${res.statusText}`);
        }

        const data = await res.json();
        if (isMounted) {
          setPredictedP(data.p_optimal);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e.message || 'Unknown error occurred while contacting the PyTorch backend.');
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
  }, [currentS11, targetFreq, shapeType]);

  // If absorption is good enough, we do not show the fallback alert
  if (currentS11 <= -10) return null;

  return (
    <div className="mt-4 p-4 rounded-lg border border-destructive/50 bg-destructive/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h4 className="flex items-center gap-2 font-bold text-destructive">
        <AlertTriangle className="w-5 h-5" /> Deep Learning Geometric Optimization Fallback
      </h4>
      <div className="mt-2 text-sm text-foreground space-y-2">
        <p>
          <strong>⚠️ Sub-optimal Resonance Detected.</strong> The current geometry fails to achieve S11 &lt; -10 dB
          at the desired frequency ({targetFreq.toFixed(2)} GHz). Achieved: {currentS11.toFixed(2)} dB.
        </p>

        {loading && (
          <p className="flex items-center gap-2 text-muted-foreground mt-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Querying Hugging Face PyTorch backend...
          </p>
        )}

        {error && (
          <p className="text-destructive font-medium mt-3">
            Failed to fetch PyTorch prediction: {error}
          </p>
        )}

        {predictedP !== null && !loading && (
          <p className="mt-3 leading-relaxed">
            Based on the PyTorch neural network prediction, it is recommended to scale the geometric parameter P
            by <strong>ΔP = {Math.abs(predictedP - currentP).toFixed(4)} mm</strong> (e.g., from {currentP.toFixed(4)} mm
            to {predictedP.toFixed(4)} mm). This predicted tuning will shift the resonance frequency to satisfy
            the broadband absorption constraints.
          </p>
        )}
      </div>
    </div>
  );
};

export default DeepLearningOptimizationBox;

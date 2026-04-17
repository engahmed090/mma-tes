import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CombinedPlot from './CombinedPlot';
import DimTable from './DimTable';
import Absorber3D from './Absorber3D';
import AIWorkingPanel, { useAIStages, AIWorkingInput } from './AIWorkingPanel';
import { LoadedShape } from '@/hooks/useShapeData';
import { RefreshCw } from 'lucide-react';

interface InverseDesignTabProps {
  shapes: LoadedShape[];
  thrDb: number;
}

const InverseDesignTab: React.FC<InverseDesignTabProps> = ({ shapes, thrDb }) => {
  const validShapes = useMemo(() => shapes.filter(s => s.isReal), [shapes]);
  const [selectedShapeName, setSelectedShapeName] = useState(validShapes[0]?.name || '');
  const [invF, setInvF] = useState(10.0);
  const [invS11, setInvS11] = useState(-20.0);
  const [result, setResult] = useState<any | null>(null);

  const { stage, elapsed, runWithStages } = useAIStages();
  const [aiInputs, setAiInputs] = useState<AIWorkingInput[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AIWorkingInput[]>([]);

  const selectedShape = useMemo(() => validShapes.find(s => s.name === selectedShapeName) || validShapes[0], [validShapes, selectedShapeName]);

  const handleRunTandem = async () => {
    if (!selectedShape) return;

    setAiInputs([
      { label: 'Mode', value: 'Tandem Inverse Design' },
      { label: 'Geometry', value: selectedShape.geometryType },
      { label: 'Target Freq', value: `${invF.toFixed(2)} GHz` },
      { label: 'Target S11', value: `${invS11.toFixed(1)} dB` },
    ]);
    setAiOutputs([]);

    try {
      const res = await runWithStages(async () => {
        const response = await fetch('http://127.0.0.1:8000/api/predict/inverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shape_type: selectedShape.geometryType,
            target_f_min: invF,
            target_f_max: invF,
            target_s11: invS11
          }),
        });
        if (!response.ok) throw new Error("Inverse Backend Error");
        return await response.json();
      });

      // Tandem response: { p_optimal, s11_expected, model_used, freqs, s11 }
      const p = res.p_optimal;
      const syntheticCurves = {
        [p]: {
          freqs: res.freqs,
          s11: res.s11
        }
      };

      setResult({
        item: selectedShape,
        p: p,
        curves: syntheticCurves,
      });

      setAiOutputs([
        { label: 'Status', value: 'Tandem Success' },
        { label: 'Optimal P', value: `${p.toFixed(4)} mm` },
        { label: 'Model', value: res.model_used }
      ]);
    } catch (e: any) {
      setAiOutputs([{ label: 'Error', value: e.message || 'API Failed' }]);
    }
  };

  if (!validShapes.length) return <div>No valid shapes loaded.</div>;

  return (
    <div className="space-y-6 tab-content-enter">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-primary" /> Tandem Network (Freq + S11 → P → S11 Curve)
      </h2>
      
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Geometry</label>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            value={selectedShapeName}
            onChange={e => setSelectedShapeName(e.target.value)}
          >
            {validShapes.map(s => (
              <option key={s.name} value={s.name}>{s.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Target Frequency (GHz)</label>
          <Input type="number" value={invF} onChange={e => setInvF(Number(e.target.value))} min={1} max={50} step={0.1} className="w-40 font-mono" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Target S11 (dB)</label>
          <Input type="number" value={invS11} onChange={e => setInvS11(Number(e.target.value))} min={-60} max={0} step={0.5} className="w-40 font-mono" />
        </div>
        <Button onClick={handleRunTandem} disabled={stage !== 'idle' && stage !== 'complete'}>
          <RefreshCw className="w-4 h-4 mr-1" /> Run Tandem Predict
        </Button>
      </div>

      <AIWorkingPanel stage={stage} inputs={aiInputs} outputs={aiOutputs} elapsed={elapsed} title="Tandem Inverse Neural Processing" />

      {result && (
        <div className="rounded-lg border border-border bg-card overflow-hidden mt-6">
          <div className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30">
            <span className="font-semibold text-foreground text-sm">
              ✨ Tandem AI Predicted | {result.item.displayName} | P={result.p.toFixed(4)} mm
            </span>
          </div>
          <div className="px-4 pb-4 space-y-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Optimal Predicted P" value={`${result.p.toFixed(4)} mm`} />
              <MetricCard label="Target Freq" value={`${invF.toFixed(2)} GHz`} />
              <MetricCard label="Target S11" value={`${invS11.toFixed(1)} dB`} />
              <MetricCard label="Model Pipeline" value="PyTorch Tandem" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DimTable spec={{ fixed: result.item.fixed, paramLabel: result.item.paramLabel, paramMode: result.item.paramMode, geometryType: result.item.geometryType }} pBest={result.p} />
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">🧊 3D Structure</h4>
                <Absorber3D
                  shapeSpec={{ geometryType: result.item.geometryType, paramMode: result.item.paramMode, paramLabel: result.item.paramLabel, fixed: result.item.fixed }}
                  pValueMm={result.p}
                  height={320}
                />
              </div>
            </div>
            <CombinedPlot curves={result.curves} pValue={result.p} thrDb={thrDb} vline={invF} />
          </div>
        </div>
      )}
    </div>
  );
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-mono font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}

export default InverseDesignTab;

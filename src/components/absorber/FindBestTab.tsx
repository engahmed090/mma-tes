import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CombinedPlot from './CombinedPlot';
import DimTable from './DimTable';
import Absorber3D from './Absorber3D';
import AIWorkingPanel, { useAIStages, AIWorkingInput } from './AIWorkingPanel';
import { LoadedShape } from '@/hooks/useShapeData';
import { BrainCircuit } from 'lucide-react';

interface FindBestTabProps {
  shapes: LoadedShape[];
  thrDb: number;
}

const FindBestTab: React.FC<FindBestTabProps> = ({ shapes, thrDb }) => {
  // To avoid breaking layout, we extract unique shapes
  const validShapes = useMemo(() => shapes.filter(s => s.isReal), [shapes]);
  const [selectedShapeName, setSelectedShapeName] = useState(validShapes[0]?.name || '');
  const [pValue, setPValue] = useState(5.0);
  const [result, setResult] = useState<any | null>(null);

  const { stage, elapsed, runWithStages } = useAIStages();
  const [aiInputs, setAiInputs] = useState<AIWorkingInput[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AIWorkingInput[]>([]);

  const selectedShape = useMemo(() => validShapes.find(s => s.name === selectedShapeName) || validShapes[0], [validShapes, selectedShapeName]);

  const handleRunFPN = async () => {
    if (!selectedShape) return;

    setAiInputs([
      { label: 'Mode', value: 'Forward Prediction (FPN)' },
      { label: 'Geometry', value: selectedShape.geometryType },
      { label: 'P Value', value: `${pValue.toFixed(2)} mm` },
    ]);
    setAiOutputs([]);

    try {
      const res = await runWithStages(async () => {
        const response = await fetch('http://127.0.0.1:8000/api/predict/forward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shape_type: selectedShape.geometryType,
            p_value: pValue
          }),
        });
        if (!response.ok) throw new Error("FPN Backend Error");
        return await response.json();
      });

      // res contains { freqs, s11, model_used }
      const syntheticCurves = {
        [pValue]: {
          freqs: res.freqs,
          s11: res.s11
        }
      };

      setResult({
        item: selectedShape,
        p: pValue,
        curves: syntheticCurves,
      });

      setAiOutputs([
        { label: 'Status', value: 'Success' },
        { label: 'Model', value: res.model_used },
        { label: 'Freq Points', value: res.freqs.length.toString() }
      ]);
    } catch (e: any) {
      setAiOutputs([{ label: 'Error', value: e.message || 'API Failed' }]);
    }
  };

  if (!validShapes.length) return <div>No valid shapes loaded.</div>;

  return (
    <div className="space-y-6 tab-content-enter">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <BrainCircuit className="w-5 h-5 text-primary" /> Forward Prediction Network (FPN)
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
          <label className="text-sm text-muted-foreground mb-1 block">Parameter P (mm)</label>
          <Input type="number" value={pValue} onChange={e => setPValue(Number(e.target.value))} min={0.1} max={50} step={0.1} className="w-40 font-mono" />
        </div>
        <Button onClick={handleRunFPN} disabled={stage !== 'idle' && stage !== 'complete'}>
          <BrainCircuit className="w-4 h-4 mr-1" /> Run PyTorch FPN
        </Button>
      </div>

      <AIWorkingPanel stage={stage} inputs={aiInputs} outputs={aiOutputs} elapsed={elapsed} title="FPN Processing" />

      {result && (
        <div className="rounded-lg border border-border bg-card overflow-hidden mt-6">
          <div className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30">
            <span className="font-semibold text-foreground text-sm">
              ✨ AI Predicted | {result.item.displayName} | P={result.p.toFixed(4)} mm
            </span>
          </div>
          <div className="px-4 pb-4 space-y-4 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DimTable spec={{ fixed: result.item.fixed, paramLabel: result.item.paramLabel, paramMode: result.item.paramMode, geometryType: result.item.geometryType }} pBest={result.p} />
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">🧊 3D Structure</h4>
                <Absorber3D
                  shapeSpec={{ geometryType: result.item.geometryType, paramMode: result.item.paramMode, paramLabel: result.item.paramLabel, fixed: result.item.fixed }}
                  pValueMm={result.p}
                  height={340}
                />
              </div>
            </div>
            <CombinedPlot curves={result.curves} pValue={result.p} thrDb={thrDb} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FindBestTab;

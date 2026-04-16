import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CombinedPlot from './CombinedPlot';
import DimTable from './DimTable';
import Absorber3D from './Absorber3D';
import AutoDesignCard from './AutoDesignCard';
import AIWorkingPanel, { useAIStages, AIWorkingInput } from './AIWorkingPanel';
import { LoadedShape } from '@/hooks/useShapeData';
import { interpS11At, nearestPKey, absorptionFromS11, aiAutoDesign } from '@/utils/math';
import { RefreshCw } from 'lucide-react';

interface InverseDesignTabProps {
  shapes: LoadedShape[];
  thrDb: number;
}

const InverseDesignTab: React.FC<InverseDesignTabProps> = ({ shapes, thrDb }) => {
  const [invF, setInvF] = useState(10);
  const [invS11, setInvS11] = useState(-20);
  const [candidates, setCandidates] = useState<any[] | null>(null);
  const [showAuto, setShowAuto] = useState(false);

  const { stage, elapsed, runWithStages } = useAIStages();
  const [aiInputs, setAiInputs] = useState<AIWorkingInput[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AIWorkingInput[]>([]);

  const handleRun = async () => {
    setShowAuto(false);

    setAiInputs([
      { label: 'Target Freq', value: `${invF.toFixed(2)} GHz` },
      { label: 'Target S11', value: `${invS11.toFixed(1)} dB` },
      { label: 'Shapes', value: `${shapes.filter(s => s.isReal).length} CST` },
      { label: 'Mode', value: 'Inverse Design' },
    ]);
    setAiOutputs([]);

    const cands = await runWithStages(async () => {
      const results: { item: LoadedShape; p: number; s11_db: number; err: number }[] = [];
      
      for (const item of shapes) {
        if (!item.isReal) continue;
        const { fmin, fmax } = item.ranges;
        if (invF < fmin - 0.05 || invF > fmax + 0.05) continue;
        
        try {
          // 1. Inverse Generation
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/predict/inverse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target_f: invF, target_s11: invS11, shape_type: item.name })
          });
          if (!res.ok) continue;
          const data = await res.json();
          
          // 2. Forward Validation
          const fwdRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/predict/forward`, {
              method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ shape_type: item.name, p_value: data.p_optimal })
          });
          if (!fwdRes.ok) continue;
          const fwdData = await fwdRes.json();
          
          // Inject new curve natively so the chart visualizes it perfectly
          item.curves = {
             [data.p_optimal]: { freqs: fwdData.freqs, s11: fwdData.s11 }
          };
          
          results.push({ 
             item, 
             p: data.p_optimal, 
             s11_db: data.s11_expected, 
             err: Math.abs(data.s11_expected - invS11) 
          });
        } catch(e) {
          console.error(`Error processing generative pipeline for ${item.name}:`, e);
        }
      }
      
      results.sort((a, b) => a.err - b.err);
      return results;
    });

    if (cands.length === 0) {
      setShowAuto(true);
      setCandidates(null);
      setAiOutputs([
        { label: 'Result', value: 'No match' },
        { label: 'Fallback', value: 'AI Auto-Design' },
      ]);
    } else {
      const top = cands.slice(0, 3);
      setCandidates(top);
      setAiOutputs([
        { label: 'Best Shape', value: top[0].item.displayName.slice(0, 20) },
        { label: 'Optimal P', value: `${top[0].p.toFixed(4)} mm` },
        { label: 'Achieved S11', value: `${top[0].s11_db.toFixed(2)} dB` },
        { label: 'Error', value: `${top[0].err.toFixed(3)} dB` },
      ]);
    }
  };

  return (
    <div className="space-y-6 tab-content-enter">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-primary" /> Inverse Design — (Frequency + S11 target) → Optimal P
      </h2>
      
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Target Frequency (GHz)</label>
          <Input type="number" value={invF} onChange={e => setInvF(Number(e.target.value))} min={1} max={50} step={0.1} className="w-40 font-mono" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Target S11 (dB)</label>
          <Input type="number" value={invS11} onChange={e => setInvS11(Number(e.target.value))} min={-60} max={0} step={0.5} className="w-40 font-mono" />
        </div>
        <Button onClick={handleRun} disabled={stage !== 'idle' && stage !== 'complete'}>
          <RefreshCw className="w-4 h-4 mr-1" /> Run Inverse Design
        </Button>
      </div>

      {/* AI Working Panel */}
      <AIWorkingPanel
        stage={stage}
        inputs={aiInputs}
        outputs={aiOutputs}
        elapsed={elapsed}
        title="Inverse Design — Neural Processing"
      />

      {showAuto && <AutoDesignCard freqGhz={invF} thrDb={thrDb} />}

      {candidates && candidates.map((cand, ci) => {
        const medals = ['🥇', '🥈', '🥉'];
        return (
          <details key={ci} open={ci === 0} className="rounded-lg border border-border bg-card overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer hover:bg-secondary/30 font-semibold text-sm text-foreground">
              {medals[ci]} {cand.item.displayName} | P={cand.p.toFixed(4)} mm | S11={cand.s11_db.toFixed(2)} dB | Err={cand.err.toFixed(3)} dB
            </summary>
            <div className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Optimal P" value={`${cand.p.toFixed(4)} mm`} />
                <MetricCard label="Achieved S11" value={`${cand.s11_db.toFixed(3)} dB`} />
                <MetricCard label="Target S11" value={`${invS11.toFixed(1)} dB`} />
                <MetricCard label="Error |ΔS11|" value={`${cand.err.toFixed(3)} dB`} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DimTable spec={{ fixed: cand.item.fixed, paramLabel: cand.item.paramLabel, paramMode: cand.item.paramMode, geometryType: cand.item.geometryType }} pBest={cand.p} />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">🧊 3D Structure</h4>
                  <Absorber3D
                    shapeSpec={{ geometryType: cand.item.geometryType, paramMode: cand.item.paramMode, paramLabel: cand.item.paramLabel, fixed: cand.item.fixed }}
                    pValueMm={cand.p}
                    height={320}
                  />
                </div>
              </div>
              <CombinedPlot curves={cand.item.curves} pValue={cand.p} thrDb={thrDb} vline={invF} />
            </div>
          </details>
        );
      })}
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

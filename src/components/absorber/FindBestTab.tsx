import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import CombinedPlot from './CombinedPlot';
import HeatmapPlot from './HeatmapPlot';
import DimTable from './DimTable';
import Absorber3D from './Absorber3D';
import AutoDesignCard from './AutoDesignCard';
import DeepLearningOptimizationBox from './DeepLearningOptimizationBox';
import AIWorkingPanel, { useAIStages, AIWorkingInput } from './AIWorkingPanel';
import { LoadedShape } from '@/hooks/useShapeData';
import { absorptionFromS11, calcBandwidth, nearestPKey, aiAutoDesign } from '@/utils/math';
import { Search } from 'lucide-react';

interface FindBestTabProps {
  shapes: LoadedShape[];
  pickAllInFreq: (f: number, thr: number) => any[];
  pickAllInRange: (f1: number, f2: number, thr: number) => any[];
  thrDb: number;
}

const FindBestTab: React.FC<FindBestTabProps> = ({ shapes, pickAllInFreq, pickAllInRange, thrDb }) => {
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [freqTarget, setFreqTarget] = useState(10);
  const [f1, setF1] = useState(8);
  const [f2, setF2] = useState(12);
  const [results, setResults] = useState<any[] | null>(null);
  const [showAutoDesign, setShowAutoDesign] = useState(false);
  const [autoDesignFreq, setAutoDesignFreq] = useState(10);

  const { stage, elapsed, runWithStages } = useAIStages();
  const [aiInputs, setAiInputs] = useState<AIWorkingInput[]>([]);
  const [aiOutputs, setAiOutputs] = useState<AIWorkingInput[]>([]);

  const handleSearch = async () => {
    setShowAutoDesign(false);

    // Set real inputs
    const inputs: AIWorkingInput[] = mode === 'single'
      ? [
          { label: 'Mode', value: 'Single Freq' },
          { label: 'Target Freq', value: `${freqTarget.toFixed(2)} GHz` },
          { label: 'Threshold', value: `${thrDb} dB` },
          { label: 'Shapes', value: `${shapes.filter(s => s.isReal).length} CST` },
        ]
      : [
          { label: 'Mode', value: 'Range' },
          { label: 'From', value: `${f1.toFixed(1)} GHz` },
          { label: 'To', value: `${f2.toFixed(1)} GHz` },
          { label: 'Threshold', value: `${thrDb} dB` },
        ];
    setAiInputs(inputs);
    setAiOutputs([]);

    const r = await runWithStages(() => {
      if (mode === 'single') {
        return pickAllInFreq(freqTarget, thrDb);
      } else {
        return pickAllInRange(f1, f2, thrDb);
      }
    });

    if (r.length === 0) {
      setShowAutoDesign(true);
      setAutoDesignFreq(mode === 'single' ? freqTarget : (f1 + f2) / 2);
      setResults(null);
      setAiOutputs([
        { label: 'Result', value: 'No match found' },
        { label: 'Fallback', value: 'AI Auto-Design' },
      ]);
    } else {
      setResults(r);
      const best = r[0];
      const s11Val = best.best?.s11_db ?? best.best?.best_db ?? NaN;
      const absPct = (absorptionFromS11(s11Val) as number) * 100;
      setAiOutputs([
        { label: 'Best Shape', value: best.item.displayName.slice(0, 20) },
        { label: 'Best P', value: `${best.best?.p?.toFixed(4)} mm` },
        { label: 'S11', value: `${s11Val.toFixed(2)} dB` },
        { label: 'Absorption', value: `${absPct.toFixed(1)}%` },
      ]);
    }
  };

  return (
    <div className="space-y-6 tab-content-enter">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Search className="w-5 h-5 text-primary" /> Find Best Absorber
      </h2>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button variant={mode === 'single' ? 'default' : 'outline'} size="sm" onClick={() => setMode('single')}>
          Single frequency
        </Button>
        <Button variant={mode === 'range' ? 'default' : 'outline'} size="sm" onClick={() => setMode('range')}>
          Frequency range
        </Button>
      </div>

      {mode === 'single' ? (
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Target Frequency (GHz)</label>
            <div className="flex items-center gap-3">
              <Slider
                value={[freqTarget]}
                onValueChange={([v]) => setFreqTarget(v)}
                min={1} max={50} step={0.01}
                className="flex-1"
              />
              <span className="text-foreground font-mono text-sm w-20 text-right">{freqTarget.toFixed(2)} GHz</span>
            </div>
          </div>
          <Button onClick={handleSearch} className="mt-5" disabled={stage !== 'idle' && stage !== 'complete'}>
            <Search className="w-4 h-4 mr-1" /> Search
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">From (GHz)</label>
            <Input type="number" value={f1} onChange={e => setF1(Number(e.target.value))} min={1} max={50} step={0.1} className="w-32 font-mono" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">To (GHz)</label>
            <Input type="number" value={f2} onChange={e => setF2(Number(e.target.value))} min={1} max={50} step={0.1} className="w-32 font-mono" />
          </div>
          <Button onClick={handleSearch} disabled={stage !== 'idle' && stage !== 'complete'}>
            <Search className="w-4 h-4 mr-1" /> Search Range
          </Button>
        </div>
      )}

      {/* AI Working Panel */}
      <AIWorkingPanel
        stage={stage}
        inputs={aiInputs}
        outputs={aiOutputs}
        elapsed={elapsed}
        title="Absorber Search — Neural Processing"
      />

      {showAutoDesign && <AutoDesignCard freqGhz={autoDesignFreq} thrDb={thrDb} />}

      {results && results.length > 0 && (
        <>
          {/* Summary table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <h3 className="text-base font-semibold text-foreground px-4 py-3 bg-secondary/30">📊 Comparison Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="bg-secondary/50 text-muted-foreground">
                    <th className="py-2 px-3 text-left">Rank</th>
                    <th className="py-2 px-3 text-left">Shape</th>
                    <th className="py-2 px-3 text-left">Source</th>
                    <th className="py-2 px-3 text-right">P (mm)</th>
                    <th className="py-2 px-3 text-right">S11 (dB)</th>
                    <th className="py-2 px-3 text-right">Absorption</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const s11Val = r.best?.s11_db ?? r.best?.best_db ?? NaN;
                    const absPct = (absorptionFromS11(s11Val) as number) * 100;
                    return (
                      <tr key={i} className="border-t border-border/50 hover:bg-secondary/20">
                        <td className="py-2 px-3">{i < 3 ? medals[i] : `#${i + 1}`}</td>
                        <td className="py-2 px-3 text-foreground">{r.item.displayName.slice(0, 40)}</td>
                        <td className="py-2 px-3">{r.item.isReal ? 'CST Raw' : 'Literature'}</td>
                        <td className="py-2 px-3 text-right">{r.best?.p?.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right">{s11Val.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{absPct.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-center">{r.best?.pass ? '✅ PASS' : '⚠️ FAIL'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed results */}
          <h3 className="text-base font-semibold text-foreground">🔬 Detailed Results</h3>
          {results.map((r, idx) => (
            <ShapeResultCard
              key={idx}
              result={r}
              idx={idx}
              thrDb={thrDb}
              vline={mode === 'single' ? freqTarget : undefined}
              vspan={mode === 'range' ? [f1, f2] : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
};

function ShapeResultCard({ result, idx, thrDb, vline, vspan }: { result: any; idx: number; thrDb: number; vline?: number; vspan?: [number, number] }) {
  const [expanded, setExpanded] = useState(idx === 0);
  const medals = ['🥇', '🥈', '🥉'];
  const s11Val = result.best?.s11_db ?? result.best?.best_db ?? NaN;
  const absPct = (absorptionFromS11(s11Val) as number) * 100;
  const pBest = result.best?.p ?? 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <span className="font-semibold text-foreground text-sm">
          {idx < 3 ? medals[idx] : `#${idx + 1}`} {result.item.displayName} | P={pBest.toFixed(4)} mm | S11={s11Val.toFixed(2)} dB | A={absPct.toFixed(1)}%
        </span>
        <span className="text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DimTable spec={{ fixed: result.item.fixed, paramLabel: result.item.paramLabel, paramMode: result.item.paramMode, geometryType: result.item.geometryType }} pBest={pBest} />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">🧊 3D Structure</h4>
              <Absorber3D
                shapeSpec={{ geometryType: result.item.geometryType, paramMode: result.item.paramMode, paramLabel: result.item.paramLabel, fixed: result.item.fixed }}
                pValueMm={pBest}
                height={340}
              />
            </div>
          </div>
          <CombinedPlot curves={result.item.curves} pValue={pBest} thrDb={thrDb} vline={vline} vspan={vspan} />
          {idx === 0 && (
            <DeepLearningOptimizationBox
              currentP={pBest}
              currentS11={s11Val}
              targetFreq={vline ?? (vspan ? (vspan[0] + vspan[1]) / 2 : 10)}
              shapeType={result.item.geometryType}
            />
          )}
          {Object.keys(result.item.curves).length > 1 && (
            <HeatmapPlot curves={result.item.curves} freqTarget={vline} />
          )}
        </div>
      )}
    </div>
  );
}

export default FindBestTab;

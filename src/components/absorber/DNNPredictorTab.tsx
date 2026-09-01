import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useS11Prediction, ScalersData } from '@/hooks/useS11Prediction';
import { Button } from '@/components/ui/button';
import { Upload, Brain, RefreshCw, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── VNA Data Types ────────────────────────────────────────────────────────
interface VNAPoint { freq: number; s11: number; }

const VNA_STORAGE_KEY = 'vna_real_data_v1';

// ─── VNA Parser ───────────────────────────────────────────────────────────────
function parseVNAFile(text: string): VNAPoint[] | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const points: VNAPoint[] = [];
  let freqScale = 1.0; // assume GHz by default

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Detect MHz header hint
    if (/MHz/i.test(trimmed)) { freqScale = 1e-3; continue; }
    if (/GHz/i.test(trimmed) || /Freq/i.test(trimmed) || trimmed.startsWith('!') || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/[\s,;]+/);
    if (parts.length < 2) continue;
    const f = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    if (isNaN(f) || isNaN(s)) continue;

    // Auto-detect MHz (frequency > 1000 likely means MHz)
    const freqGhz = f > 100 ? f * 1e-3 : f > 1000 ? f * 1e-6 : f * freqScale;
    points.push({ freq: parseFloat(freqGhz.toFixed(4)), s11: parseFloat(s.toFixed(3)) });
  }
  return points.length >= 2 ? points : null;
}

// ─── Colour palette ───────────────────────────────────────────────────────────
const SHAPE_COLORS: Record<string, string> = {
  circle: '#60a5fa', rectangle: '#34d399', ring: '#f472b6', square: '#a78bfa',
};

// ─── Component ────────────────────────────────────────────────────────────────
const DNNPredictorTab: React.FC = () => {
  const { weights, scalers, loading, error, predict } = useS11Prediction();

  const [selectedShape, setSelectedShape] = useState<string>('');
  const [pMm, setPMm] = useState<number>(5.0);
  const [freqStart, setFreqStart] = useState<number>(1);
  const [freqEnd, setFreqEnd] = useState<number>(20);
  const [nPoints, setNPoints] = useState<number>(200);
  const [prediction, setPrediction] = useState<{ freq: number; s11: number }[] | null>(null);
  const [modelMeta, setModelMeta] = useState<{ rmse: number; r2: number; n: number } | null>(null);

  // VNA real data state
  const [vnaData, setVnaData] = useState<VNAPoint[] | null>(null);
  const [vnaFilename, setVnaFilename] = useState<string>('');
  const [vnaError, setVnaError] = useState<string>('');
  const [showVna, setShowVna] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Init shape from scalers
  useEffect(() => {
    if (scalers && !selectedShape) {
      const shapes = Object.keys(scalers.shape_encoding);
      if (shapes.length) {
        setSelectedShape(shapes[0]);
        const s = scalers;
        setPMm(parseFloat(((s.p_min + s.p_max) / 2).toFixed(2)));
        setFreqStart(parseFloat(s.freq_min.toFixed(1)));
        setFreqEnd(parseFloat(s.freq_max.toFixed(1)));
      }
    }
  }, [scalers, selectedShape]);

  // Load VNA data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VNA_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.points && parsed?.filename) {
          setVnaData(parsed.points);
          setVnaFilename(parsed.filename);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Run prediction
  const runPrediction = useCallback(() => {
    if (!selectedShape || !scalers) return;
    const result = predict(selectedShape, pMm, freqStart, freqEnd, nPoints);
    if (result) {
      setPrediction(result.points);
      setModelMeta({ rmse: result.rmse, r2: result.r2, n: result.nSamples });
    }
  }, [selectedShape, pMm, freqStart, freqEnd, nPoints, scalers, predict]);

  useEffect(() => {
    if (!loading && !error && selectedShape) runPrediction();
  }, [loading, error, selectedShape, pMm, freqStart, freqEnd, nPoints, runPrediction]);

  // VNA upload handler
  const handleVNAUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVnaError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const pts = parseVNAFile(text);
      if (!pts) {
        setVnaError('Could not parse file. Expected two columns: frequency and S11 (dB).');
        return;
      }
      setVnaData(pts);
      setVnaFilename(file.name);
      localStorage.setItem(VNA_STORAGE_KEY, JSON.stringify({ points: pts, filename: file.name }));
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const clearVNA = () => {
    setVnaData(null);
    setVnaFilename('');
    localStorage.removeItem(VNA_STORAGE_KEY);
  };

  // Merge chart data
  const chartData = React.useMemo(() => {
    if (!prediction) return [];
    const map = new Map<number, any>();
    for (const pt of prediction) {
      map.set(pt.freq, { freq: pt.freq, dnn: parseFloat(pt.s11.toFixed(2)) });
    }
    if (vnaData && showVna) {
      for (const pt of vnaData) {
        const existing = map.get(pt.freq) ?? { freq: pt.freq };
        existing.vna = pt.s11;
        map.set(pt.freq, existing);
      }
      // Fill VNA points not in prediction map
      if (vnaData.length) {
        for (const pt of vnaData) {
          if (!map.has(pt.freq)) map.set(pt.freq, { freq: pt.freq, vna: pt.s11 });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.freq - b.freq);
  }, [prediction, vnaData, showVna]);

  const shapes = scalers ? Object.keys(scalers.shape_encoding) : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 tab-content-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Brain className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">DNN S11 Predictor</h2>
          <p className="text-xs text-muted-foreground">Pure-JS neural network · No WASM · Instant inference</p>
        </div>
        {modelMeta && (
          <div className="ml-auto flex gap-3 text-xs font-mono text-muted-foreground">
            <span className="badge badge-blue">RMSE {modelMeta.rmse.toFixed(3)} dB</span>
            <span className="badge badge-green">R² {modelMeta.r2.toFixed(4)}</span>
            <span className="badge badge-amber">{(modelMeta.n / 1000).toFixed(1)}k pts</span>
          </div>
        )}
      </div>

      {/* Model status */}
      {loading && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border text-sm text-muted-foreground animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          Loading model weights from /models/weights.json…
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Model not loaded</p>
            <p className="text-muted-foreground mt-0.5">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run <code className="bg-muted px-1 rounded">py ml_pipeline/train_dnn.py --data-dir . --out public/models --epochs 500</code> to generate model files.
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      {!loading && !error && scalers && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-secondary/20 border border-border">
          {/* Shape */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Shape</label>
            <select
              id="dnn-shape-select"
              value={selectedShape}
              onChange={e => setSelectedShape(e.target.value)}
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {shapes.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* P slider */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              P (patch) = <span className="text-primary font-mono">{pMm.toFixed(2)} mm</span>
            </label>
            <input
              id="dnn-p-slider"
              type="range"
              min={scalers.p_min} max={scalers.p_max}
              step={(scalers.p_max - scalers.p_min) / 100}
              value={pMm}
              onChange={e => setPMm(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{scalers.p_min.toFixed(1)}</span><span>{scalers.p_max.toFixed(1)}</span>
            </div>
          </div>

          {/* Freq range */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Freq Start (GHz)</label>
            <input
              id="dnn-freq-start"
              type="number" value={freqStart} step={0.5} min={scalers.freq_min}
              onChange={e => setFreqStart(parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Freq End (GHz)</label>
            <input
              id="dnn-freq-end"
              type="number" value={freqEnd} step={0.5} max={scalers.freq_max}
              onChange={e => setFreqEnd(parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-secondary/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              S11 Prediction — {selectedShape} · P={pMm.toFixed(2)} mm
            </h3>
            {vnaData && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showVna} onChange={e => setShowVna(e.target.checked)}
                  className="accent-yellow-400" />
                Show VNA overlay
              </label>
            )}
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="freq" type="number" domain={['dataMin', 'dataMax']}
                tickFormatter={v => `${v.toFixed(1)}`}
                label={{ value: 'Freq (GHz)', position: 'insideBottom', offset: -2, fill: '#888', fontSize: 11 }}
                tick={{ fill: '#888', fontSize: 11 }} tickCount={10}
              />
              <YAxis
                domain={['auto', 0]}
                label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
                tick={{ fill: '#888', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelFormatter={v => `${Number(v).toFixed(3)} GHz`}
                formatter={(val: number, name: string) => [
                  `${Number(val).toFixed(2)} dB`,
                  name === 'dnn' ? 'DNN Prediction' : '📡 VNA Real Data'
                ]}
              />
              <Legend formatter={v => v === 'dnn' ? 'DNN Prediction' : '📡 VNA Real Data'} />
              <ReferenceLine y={-10} stroke="#ef444466" strokeDasharray="4 4" label={{ value: '-10 dB', fill: '#ef4444', fontSize: 10 }} />

              {/* DNN prediction line */}
              <Line
                type="monotone" dataKey="dnn" dot={false} strokeWidth={2.5}
                stroke={SHAPE_COLORS[selectedShape] ?? '#60a5fa'}
                isAnimationActive={false}
              />

              {/* VNA real data — dotted yellow */}
              {vnaData && showVna && (
                <Line
                  type="monotone" dataKey="vna" dot={false} strokeWidth={2}
                  stroke="#facc15" strokeDasharray="6 3"
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── VNA Real Data Upload ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-secondary/10 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">VNA Real Data Upload</h3>
          <span className="text-xs text-muted-foreground ml-1">CSV / TXT · Frequency + S11 columns · auto-persisted</span>
        </div>

        {/* Active data badge */}
        {vnaData && vnaFilename && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-300 truncate">📡 {vnaFilename}</p>
              <p className="text-xs text-muted-foreground">{vnaData.length} points · {vnaData[0]?.freq.toFixed(3)}–{vnaData[vnaData.length - 1]?.freq.toFixed(3)} GHz · saved to localStorage</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearVNA} className="text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        )}

        {/* Format hint */}
        <div className="text-xs text-muted-foreground space-y-1 font-mono bg-muted/30 rounded-lg p-3">
          <p className="font-semibold text-foreground mb-1">Accepted formats:</p>
          <p>• Two-column CSV: <span className="text-primary">freq_GHz, S11_dB</span></p>
          <p>• Tab-separated TXT: <span className="text-primary">freq  S11</span></p>
          <p>• Touchstone .s1p (re-save as .txt first)</p>
          <p>• Auto-detects MHz (values &gt; 100 are treated as MHz → converted to GHz)</p>
        </div>

        {/* Upload button */}
        <div className="flex items-center gap-3">
          <input ref={fileRef} id="vna-file-input" type="file" accept=".csv,.txt,.s1p,.dat"
            onChange={handleVNAUpload} className="hidden" />
          <Button
            id="vna-upload-btn"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="border-primary/40 text-primary hover:bg-primary/10"
          >
            <Upload className="w-4 h-4 mr-2" />
            {vnaData ? 'Replace VNA File' : 'Upload VNA File'}
          </Button>
          {vnaError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {vnaError}
            </p>
          )}
        </div>

        {/* Mini VNA data preview */}
        {vnaData && vnaData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="text-xs font-mono text-muted-foreground w-full max-w-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1 pr-4 text-left">Freq (GHz)</th>
                  <th className="py-1 text-left">S11 (dB)</th>
                </tr>
              </thead>
              <tbody>
                {vnaData.slice(0, 6).map((pt, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-0.5 pr-4">{pt.freq.toFixed(4)}</td>
                    <td className={pt.s11 < -10 ? 'text-green-400' : ''}>{pt.s11.toFixed(3)}</td>
                  </tr>
                ))}
                {vnaData.length > 6 && (
                  <tr><td colSpan={2} className="py-1 text-center text-muted-foreground/50">…{vnaData.length - 6} more rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Training hint */}
      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/20 border border-border font-mono space-y-1">
        <p className="font-semibold text-foreground">🧪 Re-train / Fine-tune on real VNA data:</p>
        <p># Train on CST data only:</p>
        <p className="text-primary">py ml_pipeline/train_dnn.py --data-dir . --out public/models --epochs 500</p>
        <p className="mt-1"># Fine-tune on real VNA measurements:</p>
        <p className="text-yellow-400">py ml_pipeline/train_hybrid_vna.py --vna-dir ./vna_data --out public/models</p>
      </div>
    </div>
  );
};

export default DNNPredictorTab;

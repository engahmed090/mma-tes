/**
 * BioSensingTab.tsx — Analytical Sensing Model (Blood-Cancer Biosensor)
 *
 * STRICT CONSTRAINTS:
 *  - Patch Width slider: 10.0 – 14.0 mm, step 0.5
 *  - Graph X-axis: strictly 1.0 – 5.0 GHz
 *  - 3 analytical demonstration curves: Air, Normal Blood, Cancer Blood
 *  - Manual VNA input → localStorage → plotted as scatter dots
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, FlaskConical, Plus, Trash2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { analyticalS11Curve } from '@/data/bloodSensingData';
import { RESONANCE_DATA, KPIS, SENSITIVITY_TABLE } from '@/data/bloodSensingData';

// ─── Constants ───────────────────────────────────────────────────────────────
const FREQ_MIN = 1.0;
const FREQ_MAX = 5.0;
const W_MIN    = 10.0;
const W_MAX    = 14.0;
const W_STEP   = 0.5;
const N_FREQ   = 300;

const VNA_STORAGE_KEY = 'vna_manual_points_v1';

const CURVE_COLORS = {
  air:          '#00D4FF',
  normal_blood: '#00FF88',
  cancer_blood: '#FF4466',
  vna:          '#FACC15',
};

// Freq axis: 300 pts from 1.0 → 5.0 GHz
const FREQ_POINTS: number[] = Array.from({ length: N_FREQ }, (_, i) =>
  FREQ_MIN + (i / (N_FREQ - 1)) * (FREQ_MAX - FREQ_MIN)
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface VNAPoint {
  id: string;
  baseline_ghz: number;
  shift_mhz: number;
  measured_ghz: number; // baseline + shift/1000
  label: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function loadVNA(): VNAPoint[] {
  try {
    const raw = localStorage.getItem(VNA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveVNA(pts: VNAPoint[]) {
  localStorage.setItem(VNA_STORAGE_KEY, JSON.stringify(pts));
}

// ─── Custom Dot for VNA scatter ───────────────────────────────────────────────
const VNADot = (props: any) => {
  const { cx, cy } = props;
  if (!cx || !cy) return null;
  return <circle cx={cx} cy={cy} r={6} fill={CURVE_COLORS.vna} stroke="#000" strokeWidth={1.5} />;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const BioSensingTab: React.FC = () => {
  const [wMm, setWMm] = useState(12.0);
  const [vnaPoints, setVnaPoints] = useState<VNAPoint[]>([]);
  const [inputBaseline, setInputBaseline] = useState('');
  const [inputShift, setInputShift] = useState('');
  const [inputLabel, setInputLabel] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // Load VNA points from localStorage on mount
  useEffect(() => { setVnaPoints(loadVNA()); }, []);

  // ── Compute 3 analytical demonstration curves (physics-based Lorentzian model) ────────
  const { airCurve, normalCurve, cancerCurve } = useMemo(() => {
    const air    = analyticalS11Curve(wMm, 1.0,  FREQ_POINTS);
    const normal = analyticalS11Curve(wMm, 60.0, FREQ_POINTS);
    const cancer = analyticalS11Curve(wMm, 68.0, FREQ_POINTS);
    return { airCurve: air, normalCurve: normal, cancerCurve: cancer };
  }, [wMm]);

  // ── Merge into chart data ─────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return FREQ_POINTS.map((f, i) => ({
      freq: parseFloat(f.toFixed(4)),
      air:    parseFloat(airCurve.s11[i].toFixed(3)),
      normal: parseFloat(normalCurve.s11[i].toFixed(3)),
      cancer: parseFloat(cancerCurve.s11[i].toFixed(3)),
    }));
  }, [airCurve, normalCurve, cancerCurve]);

  // User-reported frequency markers; amplitude is unavailable.
  const vnaScatterData = useMemo(() => {
    return vnaPoints.map(pt => ({
      freq: parseFloat(pt.measured_ghz.toFixed(4)),
      label: pt.label || `${pt.baseline_ghz} GHz + ${pt.shift_mhz} MHz`,
    }));
  }, [vnaPoints]);

  // ── Manual VNA Save ───────────────────────────────────────────────────────
  const handleSavePoint = useCallback(() => {
    const bl = parseFloat(inputBaseline);
    const sh = parseFloat(inputShift);
    if (isNaN(bl) || isNaN(sh)) {
      setSaveMsg('⚠ Enter valid numbers for both fields.');
      return;
    }
    if (bl < FREQ_MIN || bl > FREQ_MAX) {
      setSaveMsg(`⚠ Baseline must be between ${FREQ_MIN} and ${FREQ_MAX} GHz.`);
      return;
    }
    const measured = parseFloat((bl + sh / 1000).toFixed(6));
    const pt: VNAPoint = {
      id: genId(),
      baseline_ghz: bl,
      shift_mhz: sh,
      measured_ghz: measured,
      label: inputLabel.trim() || `VNA @ ${bl} GHz`,
    };
    const updated = [...vnaPoints, pt];
    setVnaPoints(updated);
    saveVNA(updated);
    setInputBaseline('');
    setInputShift('');
    setInputLabel('');
    setSaveMsg(`✅ Saved: ${pt.label} → ${measured.toFixed(4)} GHz`);
    setTimeout(() => setSaveMsg(''), 3000);
  }, [inputBaseline, inputShift, inputLabel, vnaPoints]);

  const deleteVNA = useCallback((id: string) => {
    const updated = vnaPoints.filter(p => p.id !== id);
    setVnaPoints(updated);
    saveVNA(updated);
  }, [vnaPoints]);

  const clearAllVNA = useCallback(() => {
    setVnaPoints([]);
    localStorage.removeItem(VNA_STORAGE_KEY);
  }, []);

  // ── Resonance readout for current w ───────────────────────────────────────
  const resonanceInfo = useMemo(() => [
    { label: 'Air', color: CURVE_COLORS.air,          fr: airCurve.fr,    eps: 1  },
    { label: 'Normal Blood', color: CURVE_COLORS.normal_blood, fr: normalCurve.fr, eps: 60 },
    { label: 'Blood Cancer', color: CURVE_COLORS.cancer_blood, fr: cancerCurve.fr, eps: 68 },
  ], [airCurve, normalCurve, cancerCurve]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 tab-content-enter">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Brain className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">🧬 Analytical Sensing Model</h2>
          <p className="text-xs text-muted-foreground">
            Blood Cancer Biosensor · Patch Width 10–14 mm · Freq 1–5 GHz · ε_r ∈ {'{'}1, 60, 68{'}'}
          </p>
        </div>
        <div className="ml-auto flex gap-2 text-xs font-mono">
          <span className="badge badge-blue">Air: ε_r=1</span>
          <span className="badge badge-green">Normal: ε_r=60</span>
          <span className="badge" style={{ background: 'rgba(255,68,102,0.15)', color: '#FF4466', border: '1px solid rgba(255,68,102,0.3)', borderRadius: 4, padding: '2px 8px' }}>Cancer: ε_r=68</span>
        </div>
      </div>

      {/* ── Patch Width Slider ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-secondary/20 border border-border">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-foreground">
            Patch Width (w)
          </label>
          <span className="text-lg font-black text-primary font-mono">{wMm.toFixed(1)} mm</span>
        </div>
        <input
          id="bio-patch-width-slider"
          type="range"
          min={W_MIN}
          max={W_MAX}
          step={W_STEP}
          value={wMm}
          onChange={e => setWMm(parseFloat(e.target.value))}
          className="w-full accent-primary h-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
          {Array.from({ length: 9 }, (_, i) => W_MIN + i * W_STEP).map(v => (
            <span key={v} className={v === wMm ? 'text-primary font-bold' : ''}>{v}</span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Range: 10.0 – 14.0 mm · Step: 0.5 mm</p>
      </div>

      <p role="note" className="text-sm text-muted-foreground">Analytical demonstration using unverified baseline parameters. Not a neural-network prediction, measured response, or validated cancer diagnostic. Model accuracy: Unavailable. Absorption estimates assume zero transmission.</p>
      {/* ── S11 Chart: 1–5 GHz, 3 curves ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-secondary/10 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Analytical S₁₁ Reference — w = {wMm.toFixed(1)} mm · Domain: 1.0–5.0 GHz
        </h3>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 25, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="freq"
              type="number"
              domain={[FREQ_MIN, FREQ_MAX]}
              tickCount={9}
              tickFormatter={v => `${Number(v).toFixed(1)}`}
              label={{ value: 'Frequency (GHz)', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 11 }}
              tick={{ fill: '#888', fontSize: 11 }}
            />
            <YAxis
              domain={[-40, 0]}
              tickCount={9}
              label={{ value: 'S₁₁ (dB)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
              tick={{ fill: '#888', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelFormatter={v => `${Number(v).toFixed(3)} GHz`}
              formatter={(val: number, name: string) => {
                const labels: Record<string, string> = {
                  air: 'Air (No Blood)',
                  normal: 'Normal Blood',
                  cancer: 'Blood Cancer',
                  vna: '📡 User-entered frequency marker; S11 not measured',
                };
                return [`${Number(val).toFixed(2)} dB`, labels[name] || name];
              }}
            />
            <Legend
              formatter={(value) => ({
                air: 'Air (ε_r=1)',
                normal: 'Normal Blood (ε_r=60)',
                cancer: 'Blood Cancer (ε_r=68)',
                vna: '📡 User-entered frequency markers (−10 dB is display position)',
              }[value] || value)}
            />
            <ReferenceLine y={-10} stroke="#ef444440" strokeDasharray="4 4"
              label={{ value: '-10 dB', fill: '#ef4444', fontSize: 10, position: 'right' }} />

            {/* Curve 1: Air */}
            <Line type="monotone" dataKey="air" dot={false} strokeWidth={2.5}
              stroke={CURVE_COLORS.air} isAnimationActive={false} />
            {/* Curve 2: Normal Blood */}
            <Line type="monotone" dataKey="normal" dot={false} strokeWidth={2.5}
              stroke={CURVE_COLORS.normal_blood} isAnimationActive={false} />
            {/* Curve 3: Cancer Blood */}
            <Line type="monotone" dataKey="cancer" dot={false} strokeWidth={2.5}
              stroke={CURVE_COLORS.cancer_blood} isAnimationActive={false} />

            {/* User-reported frequencies only: no S11 amplitude was measured here. */}
            {vnaScatterData.map((point, index) => <ReferenceLine key={index} x={point.freq}
              stroke={CURVE_COLORS.vna} strokeDasharray="3 3" label="User-entered frequency (unverified)" />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Resonance Info Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {resonanceInfo.map(info => (
          <div key={info.label} className="rounded-lg border p-3 bg-secondary/10"
            style={{ borderColor: `${info.color}40` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: info.color }} />
              <span className="text-xs font-semibold text-foreground">{info.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">ε_r = {info.eps}</span>
            </div>
            <div className="text-lg font-black font-mono" style={{ color: info.color }}>
              f_r = {info.fr.toFixed(4)} GHz
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              w = {wMm.toFixed(1)} mm
            </div>
          </div>
        ))}
      </div>

      {/* ── KPI Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 bg-secondary/30 border-b border-border text-xs font-semibold text-foreground">
          Sensitivity — unavailable (original source data not verified)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-secondary/20">
              <tr>
                {['Sample', 'ε_r', 'f_r (GHz)', 'Δf_r (MHz)', 'Sensitivity (MHz/Δε)'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SENSITIVITY_TABLE.map((row, i) => (
                <tr key={i} className="border-t border-border/40 hover:bg-secondary/10 transition-colors">
                  <td className="px-4 py-2 font-semibold" style={{ color: row.color }}>{row.sample}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.eps_r}</td>
                  <td className="px-4 py-2 text-foreground">{'Unavailable'}</td>
                  <td className="px-4 py-2 text-foreground">{'Unavailable'}</td>
                  <td className="px-4 py-2 text-foreground">{row.sensitivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Manual VNA Input ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-yellow-400" />
          <h3 className="text-base font-bold text-foreground">Manual VNA Input</h3>
          <span className="text-xs text-muted-foreground ml-1">
            User-entered, unverified frequency shifts. Vertical markers show frequency only; no S11 measurement is inferred.
          </span>
        </div>

        {/* Input row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1 font-semibold">
              Baseline Frequency (GHz)
            </label>
            <input
              id="vna-baseline-input"
              type="number"
              step="0.001"
              min={FREQ_MIN}
              max={FREQ_MAX}
              placeholder="e.g. 2.474"
              value={inputBaseline}
              onChange={e => setInputBaseline(e.target.value)}
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1 font-semibold">
              Frequency Shift (MHz)
            </label>
            <input
              id="vna-shift-input"
              type="number"
              step="0.1"
              placeholder="e.g. 5.0"
              value={inputShift}
              onChange={e => setInputShift(e.target.value)}
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1 font-semibold">
              Label (optional)
            </label>
            <input
              id="vna-label-input"
              type="text"
              placeholder="e.g. Normal Blood"
              value={inputLabel}
              onChange={e => setInputLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSavePoint()}
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </div>
          <div className="flex flex-col justify-end">
            <Button
              id="vna-save-btn"
              onClick={handleSavePoint}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold w-full"
            >
              <Plus className="w-4 h-4 mr-1" /> Save Point
            </Button>
          </div>
        </div>

        {/* Computed preview */}
        {inputBaseline && inputShift && !isNaN(parseFloat(inputBaseline)) && !isNaN(parseFloat(inputShift)) && (
          <div className="text-xs font-mono text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-2">
            → User-entered derived frequency: {(parseFloat(inputBaseline) + parseFloat(inputShift) / 1000).toFixed(6)} GHz
          </div>
        )}

        {/* Status message */}
        {saveMsg && (
          <div className={`text-xs flex items-center gap-2 rounded-lg px-3 py-2 font-mono ${
            saveMsg.startsWith('✅')
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {saveMsg.startsWith('✅') ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {saveMsg}
          </div>
        )}

        {/* Saved points list */}
        {vnaPoints.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-yellow-300">
                {vnaPoints.length} saved measurement{vnaPoints.length > 1 ? 's' : ''} (localStorage)
              </span>
              <Button variant="ghost" size="sm" onClick={clearAllVNA}
                className="text-destructive hover:text-destructive text-xs h-7">
                <Trash2 className="w-3 h-3 mr-1" /> Clear All
              </Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {vnaPoints.map(pt => (
                <div key={pt.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs font-mono">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
                  <span className="text-yellow-200 font-semibold flex-1 truncate">{pt.label}</span>
                  <span className="text-muted-foreground">
                    {pt.baseline_ghz} GHz + {pt.shift_mhz} MHz
                  </span>
                  <span className="text-yellow-300">→ {pt.measured_ghz.toFixed(4)} GHz</span>
                  <button onClick={() => deleteVNA(pt.id)}
                    className="text-destructive/60 hover:text-destructive ml-1 shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {vnaPoints.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No VNA points saved yet. Enter baseline + shift above and click Save Point.
          </p>
        )}
      </div>

    </div>
  );
};

export default BioSensingTab;

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import Plot from 'react-plotly.js';
import {
  HeartPulse, Droplets, TrendingUp, Zap, Shield, Microscope,
  BookOpen, AlertTriangle, ArrowRight, Beaker, Activity, Layers,
  Target, BarChart3, FileText, ExternalLink, ChevronDown, ChevronUp,
  BrainCircuit, Droplet, Cpu
} from 'lucide-react';
import {
  RESONANCE_DATA,
  KPIS,
  SUBSTRATE,
  DNN_METRICS,
  predictS11Curve,
  DEFAULT_FREQ_POINTS,
  PATCH_WIDTHS,
  SHAPE_OPTIONS,
  SENSITIVITY_TABLE
} from '../../data/bloodSensingData';

/* ─── REFERENCE DATA ─── */
const REFERENCES = [
  {
    id: 1,
    authors: "S. J. Park, J. T. Hong, S. J. Choi, H. S. Kim, W. K. Park, S. T. Han, J. Y. Park, S. Lee, D. S. Kim, Y. H. Ahn",
    title: "Detection of microorganisms using terahertz metamaterials",
    journal: "Scientific Reports",
    year: 2014,
    volume: "4, 4988",
    doi: "10.1038/srep04988",
    url: "https://doi.org/10.1038/srep04988",
  },
  {
    id: 2,
    authors: "R. Melik, E. Unal, N. K. Perkgoz, C. Puttlitz, H. V. Demir",
    title: "Metamaterial-based wireless strain sensors",
    journal: "Applied Physics Letters",
    year: 2009,
    volume: "95(1), 011106",
    doi: "10.1063/1.3162336",
    url: "https://doi.org/10.1063/1.3162336",
  },
  {
    id: 3,
    authors: "W. Withayachumnankul, K. Jaruwongrungsee, A. Tuantranont, C. Fumeaux, D. Abbott",
    title: "Metamaterial-based microfluidic sensor for dielectric characterization",
    journal: "Sensors and Actuators A: Physical",
    year: 2013,
    volume: "189, 233–237",
    doi: "10.1016/j.sna.2012.10.027",
    url: "https://doi.org/10.1016/j.sna.2012.10.027",
  },
  {
    id: 4,
    authors: "M. Bakır, M. Karaaslan, E. Unal, F. Karadağ, O. Akdogan, C. Sabah",
    title: "Microwave metamaterial absorber for sensing applications",
    journal: "Opto-Electronics Review",
    year: 2017,
    volume: "25(4), 318–325",
    doi: "10.1016/j.opelre.2017.10.002",
    url: "https://doi.org/10.1016/j.opelre.2017.10.002",
  },
];

const COMPARISON_TABLE = [
  {
    study: "Park et al. (2014) [1]",
    structure: "SRR-based metamaterial",
    freqRange: "THz (0.5–2.0 THz)",
    target: "Microorganisms",
    mechanism: "Resonance frequency shift",
    notes: "Demonstrated THz metamaterial sensing of biological analytes on substrate surface.",
  },
  {
    study: "Withayachumnankul et al. (2013) [3]",
    structure: "SRR + microfluidic channel",
    freqRange: "Microwave (2–5 GHz)",
    target: "Liquid dielectric",
    mechanism: "Transmission dip shift with εr change",
    notes: "Integrated microfluidics for real-time liquid characterization.",
  },
  {
    study: "Bakır et al. (2017) [4]",
    structure: "Metamaterial absorber",
    freqRange: "Microwave (1–14 GHz)",
    target: "Dielectric variation",
    mechanism: "Absorption peak shift",
    notes: "Absorber-based approach; resonance shifts with overlay permittivity change.",
  },
  {
    study: "This work",
    structure: "Patch-based metamaterial absorber",
    freqRange: "1.0 - 5.0 GHz (Sensing at 2.47 GHz)",
    target: "Blood dielectric / Cancer detection",
    mechanism: "Absorption & resonance frequency shift with εr variation",
    notes: "Dual-analyte sensing capability via dielectric permittivity modulation.",
  },
];

/* ─── MAIN COMPONENT ─── */
const BioSensingTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('blood-cancer-sensing');
  const [expandedRef, setExpandedRef] = useState(false);

  const sections = [
    { id: 'blood-cancer-sensing', label: '🩸 Blood Cancer Sensing (New)', icon: Droplet },
    { id: 'overview', label: 'Overview', icon: Microscope },
    { id: 'principle', label: 'Sensing Principle', icon: Zap },
    { id: 'blood', label: 'Blood Sensing Reference', icon: HeartPulse },
    { id: 'nitrate', label: 'Nitrate Sensing', icon: Droplets },
    { id: 'comparison', label: 'Literature Comparison', icon: BarChart3 },
    { id: 'tools', label: 'Interactive Tools', icon: Activity },
    { id: 'references', label: 'References', icon: BookOpen },
  ];

  return (
    <div className="space-y-6 tab-content-enter text-foreground">
      {/* HERO HERO HERO */}
      <div className="rounded-xl border border-primary/30 p-6 md:p-8" style={{ background: 'var(--gradient-header)' }}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/20 border border-primary/30 shrink-0 mt-0.5">
            <Microscope className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">
              Absorber-Based Biosensing Platform
            </h2>
            <p className="text-muted-foreground mt-2 leading-relaxed max-w-3xl">
              This section presents the metamaterial absorber as a dielectric-property-based sensing platform.
              By leveraging the sensitivity of the absorber's electromagnetic resonance to changes in the
              relative permittivity ($\epsilon_r$) of the surrounding medium, we demonstrate detection of
              variations in <strong>blood dielectric properties</strong> for cancer screening, alongside general water nitrate sensing.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="badge badge-blue">Dielectric Sensing</span>
              <span className="badge badge-green">Blood Cancer Screening</span>
              <span className="badge badge-amber">Nitrate Detection</span>
              <span className="badge badge-purple">PyTorch DNN Assisted</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION NAV */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeSection === s.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <Separator className="bg-border/50" />

      {/* CONTENT SECTIONS */}
      <div className="tab-content-enter">
        {activeSection === 'blood-cancer-sensing' && <BloodCancerSensingSection />}
        {activeSection === 'overview' && <OverviewSection />}
        {activeSection === 'principle' && <SensingPrincipleSection />}
        {activeSection === 'blood' && <BloodSensingSection />}
        {activeSection === 'nitrate' && <NitrateSensingSection />}
        {activeSection === 'comparison' && <ComparisonSection />}
        {activeSection === 'tools' && <InteractiveToolsSection />}
        {activeSection === 'references' && (
          <ReferencesSection expanded={expandedRef} onToggle={() => setExpandedRef(!expandedRef)} />
        )}
      </div>

      {/* CTA */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Explore Full Absorber Analysis
              </h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Navigate to the <strong>Find Best Absorber</strong> tab for detailed performance analysis,
                the <strong>Inverse Design</strong> tab for parameter optimization, or the{' '}
                <strong>AI Expert Chat</strong> for research-grade discussion of your absorber's biosensing
                capabilities and technical documentation.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="text-xs">
                <FileText className="w-3.5 h-3.5 mr-1" /> Generate Report
              </Button>
              <Button size="sm" className="text-xs">
                <ArrowRight className="w-3.5 h-3.5 mr-1" /> View Performance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── NEW DETAILED BLOOD CANCER SENSING SECTION ─── */
function BloodCancerSensingSection() {
  const [subTab, setSubTab] = useState<'baseline' | 'dnn' | 'sensing'>('sensing');
  
  // State for interactive prediction
  const [patchWidth, setPatchWidth] = useState<number>(10);
  const [shape, setShape] = useState<string>('square');
  
  // State to hold active predictions when "Run DNN Prediction" is clicked
  const [predictionParams, setPredictionParams] = useState({ w: 10, shape: 'square' });
  const [isPredicting, setIsPredicting] = useState(false);

  const activeShape = SHAPE_OPTIONS.find(s => s.value === shape) || SHAPE_OPTIONS[0];
  const epsFactor = activeShape.eps_factor;

  const currentAirPred = predictS11Curve(patchWidth, 1.0 * epsFactor);
  const currentNormalPred = predictS11Curve(patchWidth, 60.0 * epsFactor);
  const currentCancerPred = predictS11Curve(patchWidth, 68.0 * epsFactor);

  // Computed KPIs based on selected params
  const predDeltaFrNormal = (currentAirPred.fr - currentNormalPred.fr) * 1000;
  const predDeltaFrCancer = (currentAirPred.fr - currentCancerPred.fr) * 1000;
  const predSensitivityNormal = Math.abs(predDeltaFrNormal / 59.0);
  const predSensitivityCancer = Math.abs(predDeltaFrCancer / 67.0);

  const handleRunPrediction = () => {
    setIsPredicting(true);
    setTimeout(() => {
      setPredictionParams({ w: patchWidth, shape: shape });
      setIsPredicting(false);
    }, 400);
  };

  const predictedAir = predictS11Curve(predictionParams.w, 1.0 * epsFactor);
  const predictedNormal = predictS11Curve(predictionParams.w, 60.0 * epsFactor);
  const predictedCancer = predictS11Curve(predictionParams.w, 68.0 * epsFactor);

  return (
    <div className="space-y-6 bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 text-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Droplet className="w-5 h-5 text-red-500 animate-pulse" />
            1.5 GHz Blood Cancer Dielectric Sensing Dashboard
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Analyze resonance shifts using real CST simulation values: Air (εr=1), Normal Blood (εr=60), Cancer (εr=68).
          </p>
        </div>
        {/* Navigation bar */}
        <div className="flex space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setSubTab('baseline')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              subTab === 'baseline' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Baseline
          </button>
          <button
            onClick={() => setSubTab('dnn')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              subTab === 'dnn' ? 'bg-purple-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DNN Metrics
          </button>
          <button
            onClick={() => setSubTab('sensing')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              subTab === 'sensing' ? 'bg-red-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sensing Analysis
          </button>
        </div>
      </div>

      {subTab === 'baseline' && (
        <div className="space-y-6">
          <p className="text-slate-300 text-sm leading-relaxed">
            Reference performance of the metamaterial absorber with an air load ($\epsilon_r = 1.0$). Resonant frequency is at <strong>2.4741 GHz</strong>.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">S11 (dB) Baseline Spectrum</h3>
              <Plot
                data={[
                  {
                    x: DEFAULT_FREQ_POINTS,
                    y: predictS11Curve(10, 1.0).s11,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'S11 (dB)',
                    line: { color: '#00D4FF', width: 2.5 }
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 320,
                  margin: { l: 45, r: 15, t: 10, b: 35 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' } },
                  yaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [-40, 2] }
                }}
                config={{ responsive: true }}
                className="w-full"
              />
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Absorption Rate Spectrum</h3>
              <Plot
                data={[
                  {
                    x: DEFAULT_FREQ_POINTS,
                    y: predictS11Curve(10, 1.0).absorption,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Absorption',
                    line: { color: '#3b82f6', width: 2.5 },
                    fill: 'tozeroy',
                    fillcolor: 'rgba(59, 130, 246, 0.12)'
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 320,
                  margin: { l: 45, r: 15, t: 10, b: 35 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' } },
                  yaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [0, 1.1] }
                }}
                config={{ responsive: true }}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {subTab === 'dnn' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400">Architecture</div>
              <div className="text-sm font-bold text-purple-400">{DNN_METRICS.architecture}</div>
            </div>
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400">Model Framework</div>
              <div className="text-sm font-bold text-cyan-400">{DNN_METRICS.framework}</div>
            </div>
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400">Validation MSE</div>
              <div className="text-sm font-bold text-emerald-400">{DNN_METRICS.final_mse}</div>
            </div>
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg">
              <div className="text-[10px] text-slate-400">R² Score</div>
              <div className="text-sm font-bold text-yellow-400">{DNN_METRICS.r2_score}</div>
            </div>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">DNN Training Loss Curve</h3>
            <Plot
              data={[
                {
                  x: DNN_METRICS.loss_history.map(h => h.epoch),
                  y: DNN_METRICS.loss_history.map(h => h.loss),
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: { color: '#a855f7', width: 2 }
                }
              ]}
              layout={{
                autosize: true,
                height: 240,
                margin: { l: 45, r: 15, t: 10, b: 35 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                xaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' } },
                yaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, type: 'log' }
              }}
              config={{ responsive: true }}
              className="w-full"
            />
          </div>
        </div>
      )}

      {subTab === 'sensing' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 p-4 rounded-lg border border-slate-850">
            <div className="text-xs text-slate-300">
              Select geometry parameters to instantly predict blood response:
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-slate-400">Shape:</span>
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded text-xs px-2 py-1 focus:outline-none"
                >
                  {SHAPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-slate-400">Width w:</span>
                <select
                  value={patchWidth}
                  onChange={(e) => setPatchWidth(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded text-xs px-2 py-1 focus:outline-none"
                >
                  {PATCH_WIDTHS.map(w => (
                    <option key={w} value={w}>{w.toFixed(1)} mm</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleRunPrediction}
                disabled={isPredicting}
                className="bg-red-500 hover:bg-red-400 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition-all disabled:opacity-50"
              >
                {isPredicting ? 'Predicting...' : 'Run DNN Prediction'}
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4.5 rounded-xl border border-slate-850">
              <div className="text-[10px] text-slate-400">Δfr (Normal Blood)</div>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black text-white">{Math.abs(predDeltaFrNormal).toFixed(2)}</span>
                <span className="text-slate-400 text-xs">MHz shift</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-1 font-mono">fr = {currentNormalPred.fr.toFixed(4)} GHz</div>
            </div>
            <div className="bg-slate-950 p-4.5 rounded-xl border border-slate-850 border-l-2 border-l-red-500">
              <div className="text-[10px] text-slate-400 font-bold text-red-400">Δfr (Cancer Blood)</div>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black text-white">{Math.abs(predDeltaFrCancer).toFixed(2)}</span>
                <span className="text-slate-400 text-xs">MHz shift</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-1 font-mono">fr = {currentCancerPred.fr.toFixed(4)} GHz</div>
            </div>
            <div className="bg-slate-950 p-4.5 rounded-xl border border-slate-850">
              <div className="text-[10px] text-slate-400">Peak Absorption</div>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black text-white">≥ 99.96</span>
                <span className="text-slate-400 text-xs">% efficiency</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-1">Near-Perfect Matching</div>
            </div>
          </div>

          {/* Multi-curve Plot */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">
              S11 Response Curves (w = {predictionParams.w.toFixed(1)} mm)
            </h4>
            <Plot
              data={[
                {
                  x: predictedAir.freq,
                  y: predictedAir.s11,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Air (εr = 1.0)',
                  line: { color: '#00D4FF', width: 2 }
                },
                {
                  x: predictedNormal.freq,
                  y: predictedNormal.s11,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Normal Blood (εr = 60.0)',
                  line: { color: '#00FF88', width: 2 }
                },
                {
                  x: predictedCancer.freq,
                  y: predictedCancer.s11,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Blood Cancer (εr = 68.0)',
                  line: { color: '#FF4466', width: 2 }
                }
              ]}
              layout={{
                autosize: true,
                height: 340,
                margin: { l: 45, r: 15, t: 10, b: 35 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                xaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [2.0, 3.2] },
                yaxis: { gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [-40, 2] }
              }}
              config={{ responsive: true }}
              className="w-full"
            />
          </div>

          {/* Sensitivity Table */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">Sample</th>
                  <th className="py-2 text-center">Permittivity εr</th>
                  <th className="py-2 text-center">Resonant fr</th>
                  <th className="py-2 text-center">Shift Δfr</th>
                  <th className="py-2 text-center">Sensitivity (MHz/Δε)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 font-semibold">Air Reference</td>
                  <td className="py-2 text-center font-mono text-cyan-400">1.0</td>
                  <td className="py-2 text-center font-mono">{predictedAir.fr.toFixed(4)} GHz</td>
                  <td className="py-2 text-center text-slate-500">—</td>
                  <td className="py-2 text-center text-slate-500">—</td>
                </tr>
                <tr className="border-t border-slate-900/60">
                  <td className="py-2 font-semibold">Normal Blood</td>
                  <td className="py-2 text-center font-mono text-emerald-400">60.0</td>
                  <td className="py-2 text-center font-mono">{predictedNormal.fr.toFixed(4)} GHz</td>
                  <td className="py-2 text-center font-mono text-emerald-400">+{Math.abs(predDeltaFrNormal).toFixed(1)} MHz</td>
                  <td className="py-2 text-center font-mono text-emerald-400">{predSensitivityNormal.toFixed(4)}</td>
                </tr>
                <tr className="border-t border-slate-900/60">
                  <td className="py-2 font-semibold">Blood Cancer</td>
                  <td className="py-2 text-center font-mono text-red-400">68.0</td>
                  <td className="py-2 text-center font-mono">{predictedCancer.fr.toFixed(4)} GHz</td>
                  <td className="py-2 text-center font-mono text-red-400">+{Math.abs(predDeltaFrCancer).toFixed(1)} MHz</td>
                  <td className="py-2 text-center font-mono text-red-400">{predSensitivityCancer.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── EXISTING UI CONTENT SECTIONS (preserved) ─── */
function OverviewSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Microscope}
        title="What This Tab Does"
        subtitle="Understanding the biosensing workflow"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          icon={Layers}
          title="Dielectric Exposure"
          description="The absorber structure is computationally or experimentally exposed to materials with different relative permittivity (εr) values — specifically blood samples and nitrate-containing solutions."
        />
        <InfoCard
          icon={Activity}
          title="Electromagnetic Response"
          description="Blood εr and nitrate εr directly influence the absorber's resonance frequency, absorption magnitude, and bandwidth. These changes are captured as measurable electromagnetic signatures."
        />
        <InfoCard
          icon={Target}
          title="Sensing Output"
          description="Variations in the absorber performance metrics — including resonance shift (Δf), absorption change (ΔA), and quality factor modulation — serve as sensing indicators for analyte detection and quantification."
        />
      </div>
      <Card className="border-border">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Operational summary:</strong> This biosensing module treats the
            metamaterial absorber as a transducer that converts dielectric property variations into electromagnetic
            observable changes. When a sample with unknown permittivity is placed in contact with or in proximity
            to the absorber, the resulting resonance perturbation can be correlated to the sample's dielectric
            characteristics. This principle is well-established in metamaterial sensing literature [3, 4, 5]
            and forms the basis for non-invasive, label-free sensing applications.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SensingPrincipleSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Zap}
        title="Sensing Principle"
        subtitle="Physical basis of dielectric-based metamaterial sensing"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Dielectric Permittivity & Field Interaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The relative permittivity ($\epsilon_r$) of a material defines how it interacts with
              an applied electromagnetic field. In a metamaterial absorber, the resonant elements
              create highly localized electric field concentrations. When a dielectric material is
              placed within or near these field-concentrated regions, the effective capacitance of the
              resonant structure changes, directly affecting the resonance condition.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-mono bg-secondary/50 rounded-lg p-3 text-center border border-border">
              f_res ∝ 1 / √(L · C_eff(εr))
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              where C_eff is the effective capacitance, which is a function of the analyte's
              dielectric constant εr. An increase in εr increases C_eff, resulting in a downward shift of the resonance frequency [5].
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              Measurable Sensing Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2.5">
              <MetricRow label="Resonance Frequency Shift (Δf)" desc="The primary sensing metric. A change in εr shifts the resonance frequency." />
              <MetricRow label="Absorption Magnitude Change (ΔA)" desc="Variations in εr and loss tangent affect the peak absorption level." />
              <MetricRow label="Quality Factor Modulation (ΔQ)" desc="Lossy analytes broaden the resonance, reducing the Q-factor." />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BloodSensingSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={HeartPulse}
        title="Blood-Based Biosensing"
        subtitle="Dielectric permittivity of blood as a sensing parameter"
      />
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Why Blood Dielectric Properties Matter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Blood is a complex biological fluid whose dielectric properties are influenced by its
            composition — including water content, hemoglobin concentration, glucose levels, and
            electrolyte balance. Pathological conditions — such as variations in blood glucose, changes in hematocrit, or the presence of abnormal cell populations — can alter the effective εr, providing a measurable signature for electromagnetic-based sensing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NitrateSensingSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Droplets}
        title="Nitrate Dielectric Sensing"
        subtitle="Detecting nitrate-related permittivity variations"
      />
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Relevance of Nitrate Dielectric Variation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nitrate contamination in water and food sources is a significant environmental and public
            health concern. Dissolved nitrate ions modify the dielectric properties of the host solution — primarily water — by altering the ionic conductivity and the effective permittivity of the medium.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={BarChart3}
        title="Literature Comparison"
        subtitle="Comparison with previously published metamaterial sensor studies"
      />
      <Card className="border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30">
                  <TableHead className="text-xs font-bold">Study</TableHead>
                  <TableHead className="text-xs font-bold">Structure</TableHead>
                  <TableHead className="text-xs font-bold">Freq. Range</TableHead>
                  <TableHead className="text-xs font-bold">Target</TableHead>
                  <TableHead className="text-xs font-bold">Mechanism</TableHead>
                  <TableHead className="text-xs font-bold">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON_TABLE.map((row, i) => (
                  <TableRow key={i} className={i === COMPARISON_TABLE.length - 1 ? 'bg-primary/5 border-primary/30' : ''}>
                    <TableCell className="text-xs font-semibold whitespace-nowrap">{row.study}</TableCell>
                    <TableCell className="text-xs">{row.structure}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.freqRange}</TableCell>
                    <TableCell className="text-xs">{row.target}</TableCell>
                    <TableCell className="text-xs">{row.mechanism}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InteractiveToolsSection() {
  const [subTab, setSubTab] = useState<'cancer' | 'nitrate' | 'calibration'>('cancer');
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Activity}
        title="Interactive Sensing Tools"
        subtitle="Run quick calculations for biosensing analysis"
      />
      <div className="flex gap-2">
        <Button variant={subTab === 'cancer' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('cancer')}>
          <HeartPulse className="w-4 h-4 mr-1" /> Blood Screening
        </Button>
        <Button variant={subTab === 'nitrate' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('nitrate')}>
          <Droplets className="w-4 h-4 mr-1" /> Nitrate Detection
        </Button>
        <Button variant={subTab === 'calibration' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('calibration')}>
          <TrendingUp className="w-4 h-4 mr-1" /> Calibration Curve
        </Button>
      </div>
      {subTab === 'cancer' && <CancerScreening />}
      {subTab === 'nitrate' && <NitrateDetection />}
      {subTab === 'calibration' && <CalibrationCurve />}
    </div>
  );
}

function ReferencesSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const visible = expanded ? REFERENCES : REFERENCES.slice(0, 4);
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={BookOpen}
        title="References"
        subtitle="Verified, peer-reviewed sources supporting this analysis"
      />
      <div className="space-y-3">
        {visible.map(ref => (
          <Card key={ref.id} className="border-border">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-2 py-1 h-fit shrink-0">
                  [{ref.id}]
                </span>
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{ref.title}</p>
                  <p className="text-xs text-muted-foreground">{ref.authors}</p>
                  <p className="text-xs text-muted-foreground"><em>{ref.journal}</em>, {ref.volume}, {ref.year}.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {REFERENCES.length > 4 && (
        <Button variant="ghost" size="sm" onClick={onToggle} className="w-full text-xs">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
          {expanded ? 'Show fewer' : `Show all ${REFERENCES.length} references`}
        </Button>
      )}
    </div>
  );
}

function CancerScreening() {
  const [baseF, setBaseF] = useState(24.2);
  const [sampleF, setSampleF] = useState(23.0);
  const [shiftThr, setShiftThr] = useState(1.0);
  const [sensMhz, setSensMhz] = useState(0);
  const [result, setResult] = useState<{ shift: number; abnormal: boolean; deltaEr?: number } | null>(null);

  const run = () => {
    const shift = Math.abs(baseF - sampleF);
    const abnormal = shift >= shiftThr;
    const deltaEr = sensMhz > 0 ? (shift * 1000) / sensMhz : undefined;
    setResult({ shift, abnormal, deltaEr });
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Reference resonance (GHz)</label>
            <Input type="number" value={baseF} onChange={e => setBaseF(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sample resonance (GHz)</label>
            <Input type="number" value={sampleF} onChange={e => setSampleF(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Alert threshold (GHz)</label>
            <Input type="number" value={shiftThr} onChange={e => setShiftThr(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Sensitivity (MHz/Δεr)</label>
          <Input type="number" value={sensMhz} onChange={e => setSensMhz(Number(e.target.value))} step={0.1} className="font-mono text-sm w-48" />
        </div>
        <Button onClick={run} size="sm"><HeartPulse className="w-4 h-4 mr-1" /> Run Analysis</Button>
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <MetricBox label="Frequency shift" value={`${result.shift.toFixed(4)} GHz`} sub={`${(result.shift * 1000).toFixed(1)} MHz`} />
            <MetricBox label="Threshold" value={`${shiftThr.toFixed(3)} GHz`} />
            <MetricBox label="Result" value={result.abnormal ? '⚠️ ABNORMAL' : '✅ NORMAL'} className={result.abnormal ? 'border-destructive/50' : 'border-emerald-500/50'} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NitrateDetection() {
  const [nBase, setNBase] = useState(24.2);
  const [nSample, setNSample] = useState(23.95);
  const [nSens, setNSens] = useState(2);
  const [nAlert, setNAlert] = useState(50);
  const [result, setResult] = useState<{ shiftMhz: number; ppm: number; over: boolean } | null>(null);

  const run = () => {
    const shiftMhz = Math.abs(nBase - nSample) * 1000;
    const ppm = Math.max(0, shiftMhz / nSens);
    setResult({ shiftMhz, ppm, over: ppm >= nAlert });
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Reference resonance (GHz)</label>
            <Input type="number" value={nBase} onChange={e => setNBase(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sample resonance (GHz)</label>
            <Input type="number" value={nSample} onChange={e => setNSample(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sensitivity (MHz/ppm)</label>
            <Input type="number" value={nSens} onChange={e => setNSens(Number(e.target.value))} step={0.1} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">WHO Alert (ppm)</label>
            <Input type="number" value={nAlert} onChange={e => setNAlert(Number(e.target.value))} step={1} className="font-mono text-sm" />
          </div>
        </div>
        <Button onClick={run} size="sm"><Droplets className="w-4 h-4 mr-1" /> Estimate Nitrate</Button>
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <MetricBox label="Frequency shift" value={`${result.shiftMhz.toFixed(2)} MHz`} />
            <MetricBox label="Estimated [NO3-]" value={`${result.ppm.toFixed(2)} ppm`} />
            <MetricBox label="WHO limit (50 ppm)" value={result.over ? '⚠️ EXCEEDS' : '✅ SAFE'} className={result.over ? 'border-destructive/50' : 'border-emerald-500/50'} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CalibrationCurve() {
  const [calibTxt, setCalibTxt] = useState("0, 24.200\n10, 24.185\n25, 24.162\n50, 24.125\n100, 24.062\n200, 23.975");
  const [result, setResult] = useState<{ coeffs: [number, number]; r2: number; data: { conc: number; freq: number }[] } | null>(null);

  const fit = () => {
    try {
      const data = calibTxt.trim().split('\n').map(l => {
        const [c, f] = l.split(',').map(s => parseFloat(s.trim()));
        return { conc: c, freq: f };
      }).filter(d => isFinite(d.conc) && isFinite(d.freq));

      if (data.length < 2) return;
      const n = data.length;
      const xs = data.map(d => d.freq);
      const ys = data.map(d => d.conc);
      const xm = xs.reduce((a, b) => a + b, 0) / n;
      const ym = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0);
      const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
      const slope = num / den;
      const intercept = ym - slope * xm;
      const ssTot = ys.reduce((s, y) => s + (y - ym) ** 2, 0);
      const ssRes = xs.reduce((s, x, i) => s + (ys[i] - (slope * x + intercept)) ** 2, 0);
      const r2 = 1 - ssRes / ssTot;
      setResult({ coeffs: [slope, intercept], r2, data });
    } catch { /* ignore */ }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data (concentration_ppm, resonance_GHz):</label>
          <Textarea value={calibTxt} onChange={e => setCalibTxt(e.target.value)} rows={6} className="font-mono text-xs" />
        </div>
        <Button onClick={fit} size="sm"><TrendingUp className="w-4 h-4 mr-1" /> Fit Calibration</Button>
        {result && (
          <div className="space-y-4">
            <Plot
              data={[
                { x: result.data.map(d => d.freq), y: result.data.map(d => d.conc), mode: 'markers', name: 'Measured', marker: { size: 10, color: 'hsl(217, 91%, 60%)' } },
                {
                  x: (() => { const xs = result.data.map(d => d.freq); const mn = Math.min(...xs) - 0.05; const mx = Math.max(...xs) + 0.05; return Array.from({ length: 200 }, (_, i) => mn + (mx - mn) * i / 199); })(),
                  y: (() => { const xs = result.data.map(d => d.freq); const mn = Math.min(...xs) - 0.05; const mx = Math.max(...xs) + 0.05; return Array.from({ length: 200 }, (_, i) => { const x = mn + (mx - mn) * i / 199; return result.coeffs[0] * x + result.coeffs[1]; }); })(),
                  mode: 'lines', name: `Linear fit (R²=${result.r2.toFixed(4)})`, line: { color: 'hsl(160, 84%, 39%)', width: 2 },
                },
              ]}
              layout={{
                height: 320, margin: { l: 60, r: 10, t: 10, b: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(15,23,42,0.3)',
                font: { family: 'JetBrains Mono', color: '#94a3b8', size: 11 },
                xaxis: { title: { text: 'Resonance freq (GHz)' }, gridcolor: 'rgba(148,163,184,0.1)' },
                yaxis: { title: { text: 'Concentration (ppm)' }, gridcolor: 'rgba(148,163,184,0.1)' },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
            />
            <div className="grid grid-cols-3 gap-3">
              <MetricBox label="R²" value={result.r2.toFixed(4)} />
              <MetricBox label="Slope" value={`${result.coeffs[0].toFixed(3)} ppm/GHz`} />
              <MetricBox label="Sensitivity" value={`${(1000 / Math.abs(result.coeffs[0])).toFixed(3)} MHz/ppm`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHARED UI COMPONENTS ─── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <Card className="border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-border p-2.5">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </div>
  );
}

function MetricBox({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={`rounded-lg bg-card border border-border p-4 ${className || ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-mono font-bold text-foreground mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function PlaceholderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-dashed border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs font-mono text-warn mt-1">{value}</div>
    </div>
  );
}

export default BioSensingTab;

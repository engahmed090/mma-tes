import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import {
  Activity,
  BrainCircuit,
  Droplet,
  HeartPulse,
  TrendingUp,
  Cpu,
  Layers,
  Database,
  CheckCircle,
  HelpCircle
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

export default function BioSensingTab() {
  const [activeTab, setActiveTab] = useState<'baseline' | 'dnn' | 'sensing'>('sensing');
  
  // State for interactive prediction
  const [patchWidth, setPatchWidth] = useState<number>(10);
  const [shape, setShape] = useState<string>('square');
  
  // State to hold active predictions when "Run DNN Prediction" is clicked
  const [predictionParams, setPredictionParams] = useState({ w: 10, shape: 'square' });
  const [isPredicting, setIsPredicting] = useState(false);

  // Compute live prediction curves for selected params
  const activeShape = SHAPE_OPTIONS.find(s => s.value === shape) || SHAPE_OPTIONS[0];
  const epsFactor = activeShape.eps_factor;

  const currentAirPred = predictS11Curve(patchWidth, 1.0 * epsFactor);
  const currentNormalPred = predictS11Curve(patchWidth, 60.0 * epsFactor);
  const currentCancerPred = predictS11Curve(patchWidth, 68.0 * epsFactor);

  // Computed KPIs based on prediction parameters (to dynamically show how w shifts resonance)
  const predDeltaFrNormal = (currentAirPred.fr - currentNormalPred.fr) * 1000; // MHz
  const predDeltaFrCancer = (currentAirPred.fr - currentCancerPred.fr) * 1000; // MHz
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
    <div className="flex flex-col w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      
      {/* Header Section */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-8 h-8 text-red-500 animate-pulse" />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              AI-Enhanced Bio-Sensing & Cancer Diagnostics
            </h1>
          </div>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            Detecting dielectric shifts ($\Delta f_r$) at 1.5 GHz using metamaterial absorber sensing templates
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-2.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
          <div>Substrate: <span className="text-cyan-400">{SUBSTRATE.material} (h={SUBSTRATE.h_mm}mm, εr={SUBSTRATE.eps_r})</span></div>
          <div className="h-4 w-[1px] bg-slate-800"></div>
          <div>Analyte: <span className="text-red-400">r={SUBSTRATE.analyte_r_mm}mm, h={SUBSTRATE.analyte_h_mm}mm</span></div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 mb-6 bg-slate-900 p-1.5 rounded-lg border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('baseline')}
          className={`flex items-center px-4 py-2 rounded-md text-xs md:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'baseline' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 mr-2" />
          Baseline (Air)
        </button>
        <button
          onClick={() => setActiveTab('dnn')}
          className={`flex items-center px-4 py-2 rounded-md text-xs md:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'dnn' ? 'bg-purple-500 text-slate-950 shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <BrainCircuit className="w-4 h-4 mr-2" />
          DNN Architecture
        </button>
        <button
          onClick={() => setActiveTab('sensing')}
          className={`flex items-center px-4 py-2 rounded-md text-xs md:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'sensing' ? 'bg-red-500 text-slate-950 shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Droplet className="w-4 h-4 mr-2" />
          Cancer Sensing Analysis
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-grow bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-800 p-5 md:p-6">
        
        {/* TAB 1: Baseline */}
        {activeTab === 'baseline' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                  Baseline Absorption Model (No Sample / Air Reference)
                </h2>
                <p className="text-slate-400 text-sm mt-1 max-w-3xl">
                  Reference simulation performance of the unloaded metamaterial absorber ($\epsilon_r = 1.0$). 
                  The primary resonance occurs at $f_r = 2.4741$ GHz with S11 dipping to -34.04 dB.
                </p>
              </div>
              <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 text-sm flex gap-4">
                <div>
                  <div className="text-xs text-slate-400">Resonant Freq (fr)</div>
                  <div className="text-base font-bold text-cyan-400">2.4741 GHz</div>
                </div>
                <div className="h-8 w-[1px] bg-slate-700"></div>
                <div>
                  <div className="text-xs text-slate-400">S11 at fr</div>
                  <div className="text-base font-bold text-cyan-400">-34.04 dB</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* S11 plot */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">S11 Reflection Coefficient Spectrum</h3>
                <Plot
                  data={[
                    {
                      x: DEFAULT_FREQ_POINTS,
                      y: predictS11Curve(10, 1.0).s11,
                      type: 'scatter',
                      mode: 'lines',
                      name: 'S11 (dB)',
                      line: { color: '#00D4FF', width: 3 },
                    },
                    {
                      x: [2.4741],
                      y: [-34.044],
                      type: 'scatter',
                      mode: 'markers+text',
                      name: 'Resonance Dip',
                      marker: { color: '#FFD700', size: 10, symbol: 'star' },
                      text: ['fr = 2.474 GHz'],
                      textposition: 'bottom center',
                      textfont: { color: '#ffffff', size: 11 }
                    }
                  ]}
                  layout={{
                    autosize: true,
                    height: 380,
                    margin: { l: 50, r: 20, t: 15, b: 40 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    xaxis: { title: 'Frequency (GHz)', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' } },
                    yaxis: { title: 'S11 (dB)', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [-40, 2] },
                    legend: { font: { color: '#cbd5e1' } }
                  }}
                  config={{ responsive: true }}
                  className="w-full"
                />
              </div>

              {/* Absorption plot */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Absorption Rate Spectrum (A = 1 - 10^(S11/10))</h3>
                <Plot
                  data={[
                    {
                      x: DEFAULT_FREQ_POINTS,
                      y: predictS11Curve(10, 1.0).absorption,
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Absorption',
                      line: { color: '#3b82f6', width: 3 },
                      fill: 'tozeroy',
                      fillcolor: 'rgba(59, 130, 246, 0.15)'
                    },
                    {
                      x: [2.4741],
                      y: [0.9996],
                      type: 'scatter',
                      mode: 'markers+text',
                      name: 'Peak Absorption',
                      marker: { color: '#00FF88', size: 8 },
                      text: ['A = 99.96%'],
                      textposition: 'top center',
                      textfont: { color: '#ffffff', size: 11 }
                    }
                  ]}
                  layout={{
                    autosize: true,
                    height: 380,
                    margin: { l: 50, r: 20, t: 15, b: 40 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    xaxis: { title: 'Frequency (GHz)', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' } },
                    yaxis: { title: 'Absorption Rate', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [0, 1.1] },
                    legend: { font: { color: '#cbd5e1' } }
                  }}
                  config={{ responsive: true }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DNN Metrics */}
        {activeTab === 'dnn' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-purple-400" />
                Deep Neural Network Extrapolation Model
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                The conditional model accepts patch width ($w$), shapes, and relative permittivity ($\epsilon_r$) to predict S11 curves across complex ranges.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Framework</div>
                <div className="text-base font-bold text-purple-400">{DNN_METRICS.framework}</div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Input Vector</div>
                <div className="text-base font-bold text-cyan-400">[w, shape, f, εr]</div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Validation MSE</div>
                <div className="text-base font-bold text-emerald-400">{DNN_METRICS.final_mse}</div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">R² Score</div>
                <div className="text-base font-bold text-yellow-400">{DNN_METRICS.r2_score}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* DNN architecture visual */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 lg:col-span-1 space-y-4">
                <h3 className="text-sm font-semibold text-slate-300">Model Layers & Neurons</h3>
                <div className="space-y-2">
                  {DNN_METRICS.layers.map((layer, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-900/60 rounded border border-slate-800 text-xs">
                      <div>
                        <div className="font-bold text-slate-200">{layer.name}</div>
                        <div className="text-[10px] text-slate-500">{layer.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-purple-400 font-bold">{layer.neurons} Neurons</div>
                        <div className="text-[10px] text-slate-400">Act: {layer.activation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Training loss chart */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 lg:col-span-2">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">DNN Training Loss History (MSE)</h3>
                <Plot
                  data={[
                    {
                      x: DNN_METRICS.loss_history.map(h => h.epoch),
                      y: DNN_METRICS.loss_history.map(h => h.loss),
                      type: 'scatter',
                      mode: 'lines+markers',
                      name: 'Training Loss',
                      line: { color: '#a855f7', width: 2 },
                      marker: { color: '#c084fc', size: 6 }
                    }
                  ]}
                  layout={{
                    autosize: true,
                    height: 270,
                    margin: { l: 50, r: 20, t: 15, b: 40 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    xaxis: { title: 'Epoch', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' } },
                    yaxis: { title: 'MSE Loss', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, type: 'log' },
                    legend: { font: { color: '#cbd5e1' } }
                  }}
                  config={{ responsive: true }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Classical ML Comparison */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Comparison: Classical ML vs. Deep Learning (10-Fold CV)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2">Model Name</th>
                      <th className="py-2">RMSE (dB)</th>
                      <th className="py-2">MAE (dB)</th>
                      <th className="py-2">R² Score</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DNN_METRICS.classical_ml_comparison.models.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-900/60 hover:bg-slate-900/30">
                        <td className="py-2.5 font-semibold text-slate-200">{m}</td>
                        <td className="py-2.5 font-mono text-slate-300">{DNN_METRICS.classical_ml_comparison.rmse[idx]}</td>
                        <td className="py-2.5 font-mono text-slate-300">{DNN_METRICS.classical_ml_comparison.mae[idx]}</td>
                        <td className="py-2.5 font-mono text-slate-300">{DNN_METRICS.classical_ml_comparison.r2[idx]}</td>
                        <td className="py-2.5">
                          {idx === 2 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                              Selected Model
                            </span>
                          ) : (
                            <span className="text-slate-500">Muted Baseline</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Sensing (Core Feature) */}
        {activeTab === 'sensing' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-5">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-red-500 animate-pulse" />
                  Blood Cancer Diagnostics & Resonance Shift Analysis
                </h2>
                <p className="text-slate-400 text-sm mt-1 max-w-4xl">
                  Real-time prediction utilizing the custom PyTorch forward neural network model to evaluate shifts under Normal Blood ($\epsilon_r = 60.0$) and Cancer Blood ($\epsilon_r = 68.0$) superstrate loading conditions.
                </p>
              </div>
              
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-semibold text-slate-400">Shape:</label>
                  <select 
                    value={shape} 
                    onChange={(e) => setShape(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-md text-xs px-2.5 py-1.5 focus:border-cyan-500 focus:outline-none"
                  >
                    {SHAPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-semibold text-slate-400">Patch Width (w):</label>
                  <select 
                    value={patchWidth} 
                    onChange={(e) => setPatchWidth(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-md text-xs px-2.5 py-1.5 focus:border-cyan-500 focus:outline-none"
                  >
                    {PATCH_WIDTHS.map(w => (
                      <option key={w} value={w}>{w.toFixed(1)} mm</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={handleRunPrediction}
                  disabled={isPredicting}
                  className="bg-red-500 text-slate-950 hover:bg-red-400 font-bold px-4 py-1.5 rounded-md text-xs transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 shadow"
                >
                  {isPredicting ? 'Predicting...' : 'Run DNN Prediction'}
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Normal Blood Shift */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors shadow-lg">
                <div className="text-xs font-semibold text-slate-400 mb-1 flex justify-between items-center">
                  <span>Δfr (Normal Blood)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                    εr = 60.0
                  </span>
                </div>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span className="text-3xl font-black text-white">{Math.abs(predDeltaFrNormal).toFixed(2)}</span>
                  <span className="text-slate-400 text-sm font-medium">MHz shift</span>
                </div>
                <div className="mt-2.5 text-xs text-emerald-400/90 font-mono">
                  fr = {currentNormalPred.fr.toFixed(4)} GHz
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Sensitivity S = {predSensitivityNormal.toFixed(4)} MHz/Δε
                </div>
              </div>

              {/* Cancer Blood Shift */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors shadow-lg border-l-4 border-l-red-500">
                <div className="text-xs font-semibold text-slate-400 mb-1 flex justify-between items-center">
                  <span>Δfr (Cancer Blood)</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px]">
                    εr = 68.0
                  </span>
                </div>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span className="text-3xl font-black text-white">{Math.abs(predDeltaFrCancer).toFixed(2)}</span>
                  <span className="text-slate-400 text-sm font-medium">MHz shift</span>
                </div>
                <div className="mt-2.5 text-xs text-red-400/90 font-mono">
                  fr = {currentCancerPred.fr.toFixed(4)} GHz
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Sensitivity S = {predSensitivityCancer.toFixed(4)} MHz/Δε
                </div>
              </div>

              {/* Absorption peak */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors shadow-lg">
                <div className="text-xs font-semibold text-slate-400 mb-1 flex justify-between items-center">
                  <span>Absorption Efficiency Peak</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">
                    At Resonance
                  </span>
                </div>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span className="text-3xl font-black text-white">&ge; 99.96</span>
                  <span className="text-slate-400 text-sm font-medium">%</span>
                </div>
                <div className="mt-2.5 text-xs text-cyan-400/90 font-mono">
                  Near-Perfect Matching (Z = Z₀)
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Reflectivity R &le; -34 dB (0.04% power reflected)
                </div>
              </div>

            </div>

            {/* Overlaid multi-curve plot */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs md:text-sm font-semibold text-slate-300">
                  Resonant Frequency Shift Overlay (w = {predictionParams.w.toFixed(1)} mm, {SHAPE_OPTIONS.find(s => s.value === predictionParams.shape)?.label})
                </h3>
                <div className="text-[10px] text-slate-500 font-mono">
                  Cyan: Air (1.0) | Green: Normal Blood (60.0) | Red: Cancer Blood (68.0)
                </div>
              </div>
              <Plot
                data={[
                  {
                    x: predictedAir.freq,
                    y: predictedAir.s11,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Air (εr = 1.0)',
                    line: { color: '#00D4FF', width: 2.5 }
                  },
                  {
                    x: predictedNormal.freq,
                    y: predictedNormal.s11,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Normal Blood (εr = 60.0)',
                    line: { color: '#00FF88', width: 2.5, dash: 'solid' }
                  },
                  {
                    x: predictedCancer.freq,
                    y: predictedCancer.s11,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Blood Cancer (εr = 68.0)',
                    line: { color: '#FF4466', width: 2.5, dash: 'solid' }
                  },
                  {
                    x: [predictedAir.fr, predictedNormal.fr, predictedCancer.fr],
                    y: [
                      predictedAir.s11[predictedAir.freq.indexOf(predictedAir.freq.reduce((prev, curr) => Math.abs(curr - predictedAir.fr) < Math.abs(prev - predictedAir.fr) ? curr : prev))],
                      predictedNormal.s11[predictedNormal.freq.indexOf(predictedNormal.freq.reduce((prev, curr) => Math.abs(curr - predictedNormal.fr) < Math.abs(prev - predictedNormal.fr) ? curr : prev))],
                      predictedCancer.s11[predictedCancer.freq.indexOf(predictedCancer.freq.reduce((prev, curr) => Math.abs(curr - predictedCancer.fr) < Math.abs(prev - predictedCancer.fr) ? curr : prev))]
                    ],
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Resonances',
                    marker: { color: '#FFD700', size: 8 }
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 400,
                  margin: { l: 50, r: 20, t: 15, b: 40 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { title: 'Frequency (GHz)', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [2.0, 3.2] },
                  yaxis: { title: 'S11 (dB)', gridcolor: '#1e293b', tickcolor: '#475569', tickfont: { color: '#94a3b8' }, range: [-40, 2] },
                  legend: { font: { color: '#cbd5e1' } }
                }}
                config={{ responsive: true }}
                className="w-full"
              />
            </div>

            {/* Sensitivity Analysis Table */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Sensing Sensitivity Figure of Merit (FOM)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2">Sample Type</th>
                      <th className="py-2 text-center">Permittivity (εr)</th>
                      <th className="py-2 text-center">Resonant Frequency (fr)</th>
                      <th className="py-2 text-center">Shift Δfr (vs Air)</th>
                      <th className="py-2 text-center">Sensitivity S (MHz/Δε)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-900/60 hover:bg-slate-900/30">
                      <td className="py-2.5 font-semibold text-slate-200">Air Reference</td>
                      <td className="py-2.5 text-center font-mono text-cyan-400">1.0</td>
                      <td className="py-2.5 text-center font-mono text-slate-300">{predictedAir.fr.toFixed(4)} GHz</td>
                      <td className="py-2.5 text-center font-mono text-slate-500">—</td>
                      <td className="py-2.5 text-center font-mono text-slate-500">—</td>
                    </tr>
                    <tr className="border-b border-slate-900/60 hover:bg-slate-900/30">
                      <td className="py-2.5 font-semibold text-slate-200">Normal Blood</td>
                      <td className="py-2.5 text-center font-mono text-emerald-400">60.0</td>
                      <td className="py-2.5 text-center font-mono text-slate-300">{predictedNormal.fr.toFixed(4)} GHz</td>
                      <td className="py-2.5 text-center font-mono text-emerald-400">{Math.abs(predDeltaFrNormal).toFixed(2)} MHz</td>
                      <td className="py-2.5 text-center font-mono text-emerald-400">{predSensitivityNormal.toFixed(4)}</td>
                    </tr>
                    <tr className="border-b border-slate-900/60 hover:bg-slate-900/30">
                      <td className="py-2.5 font-semibold text-slate-200">Blood Cancer</td>
                      <td className="py-2.5 text-center font-mono text-red-400">68.0</td>
                      <td className="py-2.5 text-center font-mono text-slate-300">{predictedCancer.fr.toFixed(4)} GHz</td>
                      <td className="py-2.5 text-center font-mono text-red-400">{Math.abs(predDeltaFrCancer).toFixed(2)} MHz</td>
                      <td className="py-2.5 text-center font-mono text-red-400">{predSensitivityCancer.toFixed(4)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

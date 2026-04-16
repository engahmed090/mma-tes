import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Brain, CheckCircle2, Loader2, Zap, Layers, BarChart3, Activity } from 'lucide-react';

export type AIStage = 'idle' | 'input' | 'preprocessing' | 'network' | 'output' | 'complete';

export interface AIWorkingInput {
  label: string;
  value: string;
}

interface AIWorkingPanelProps {
  stage: AIStage;
  inputs: AIWorkingInput[];
  outputs: AIWorkingInput[];
  elapsed?: number;
  title?: string;
}

const STAGE_META: Record<AIStage, { label: string; icon: React.ElementType; color: string }> = {
  idle:          { label: 'Idle',                  icon: Brain,       color: 'text-muted-foreground' },
  input:         { label: 'Receiving Inputs',      icon: Zap,         color: 'text-cyan-400' },
  preprocessing: { label: 'Feature Encoding',     icon: Layers,      color: 'text-blue-400' },
  network:       { label: 'Neural Network Active', icon: Activity,    color: 'text-purple-400' },
  output:        { label: 'Generating Output',     icon: BarChart3,   color: 'text-emerald-400' },
  complete:      { label: 'Prediction Complete',   icon: CheckCircle2, color: 'text-green-400' },
};

const STAGE_ORDER: AIStage[] = ['input', 'preprocessing', 'network', 'output', 'complete'];

// Layer config for real metamaterial absorber NN
const LAYER_CONFIG = [
  { name: 'Input Features', nodes: 4, labels: ['Freq (GHz)', 'Target S₁₁', 'Geometry', 'P (mm)'] },
  { name: 'Normalization', nodes: 4, labels: ['x̂₁', 'x̂₂', 'x̂₃', 'x̂₄'] },
  { name: 'Dense-128 ReLU', nodes: 6, labels: ['h₁', 'h₂', 'h₃', 'h₄', 'h₅', 'h₆'] },
  { name: 'Dense-64 ReLU', nodes: 5, labels: ['h₁', 'h₂', 'h₃', 'h₄', 'h₅'] },
  { name: 'Dense-32 ReLU', nodes: 4, labels: ['h₁', 'h₂', 'h₃', 'h₄'] },
  { name: 'Output Layer', nodes: 3, labels: ['P_opt', 'S₁₁ (dB)', 'Abs (%)'] },
];

const AIWorkingPanel: React.FC<AIWorkingPanelProps> = ({ stage, inputs, outputs, elapsed, title }) => {
  const [expanded, setExpanded] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [activeLayer, setActiveLayer] = useState(-1);
  const [hoveredNode, setHoveredNode] = useState<{layer: number; node: number; x: number; y: number} | null>(null);

  // Progress active layer based on stage
  useEffect(() => {
    if (stage === 'idle') { setActiveLayer(-1); return; }
    if (stage === 'input') { setActiveLayer(0); return; }
    if (stage === 'preprocessing') { setActiveLayer(1); return; }
    if (stage === 'complete') { setActiveLayer(LAYER_CONFIG.length); return; }
    if (stage === 'output') { setActiveLayer(LAYER_CONFIG.length - 1); return; }
    // network stage: animate through hidden layers
    if (stage === 'network') {
      let layer = 2;
      setActiveLayer(2);
      const iv = setInterval(() => {
        layer++;
        if (layer >= LAYER_CONFIG.length - 1) {
          clearInterval(iv);
          return;
        }
        setActiveLayer(layer);
      }, 600);
      return () => clearInterval(iv);
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== 'idle') setExpanded(true);
  }, [stage]);

  // Generate "activation values" from real inputs
  const getNodeValue = useCallback((layerIdx: number, nodeIdx: number): string => {
    if (layerIdx === 0 && inputs.length > 0) {
      // Show real input values
      const inp = inputs[nodeIdx];
      return inp ? inp.value : '—';
    }
    if (layerIdx === LAYER_CONFIG.length - 1 && (stage === 'output' || stage === 'complete') && outputs.length > 0) {
      const out = outputs[nodeIdx];
      return out ? out.value : '—';
    }
    if (layerIdx <= activeLayer && stage !== 'idle') {
      // Show simulated activation values for hidden layers
      const seed = layerIdx * 7 + nodeIdx * 13;
      const val = (Math.sin(seed) * 0.5 + 0.5);
      return val.toFixed(3);
    }
    return '—';
  }, [inputs, outputs, activeLayer, stage]);

  // Canvas drawing with real data flow
  const drawNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    const w = displayW;
    const h = displayH;
    ctx.clearRect(0, 0, w, h);

    const t = Date.now() / 1000;
    const padX = 55;
    const padY = 30;
    const layerCount = LAYER_CONFIG.length;

    // Compute positions
    const layerX = LAYER_CONFIG.map((_, i) => padX + (i / (layerCount - 1)) * (w - padX * 2));
    const nodePositions: { x: number; y: number; li: number; ni: number }[] = [];

    LAYER_CONFIG.forEach((layer, li) => {
      const x = layerX[li];
      const count = layer.nodes;
      const spacing = Math.min(28, (h - padY * 2) / (count + 1));
      for (let ni = 0; ni < count; ni++) {
        const y = h / 2 + (ni - (count - 1) / 2) * spacing;
        nodePositions.push({ x, y, li, ni });
      }
    });

    // Draw connections with data flow animation
    for (let li = 0; li < layerCount - 1; li++) {
      const fromNodes = nodePositions.filter(n => n.li === li);
      const toNodes = nodePositions.filter(n => n.li === li + 1);
      const layerActive = activeLayer >= li + 1;
      const isFlowing = stage === 'network' && activeLayer === li + 1;

      for (const fn of fromNodes) {
        for (const tn of toNodes) {
          // Weight intensity based on pseudo-random "weight"
          const weightSeed = fn.ni * 7 + tn.ni * 13 + li * 31;
          const weight = Math.abs(Math.sin(weightSeed)) * 0.8 + 0.2;

          ctx.beginPath();
          ctx.moveTo(fn.x, fn.y);
          ctx.lineTo(tn.x, tn.y);

          if (isFlowing) {
            // Animated flow — pulse along the line
            const pulse = 0.15 + 0.5 * weight * (0.5 + 0.5 * Math.sin(t * 5 - fn.ni * 0.8 - tn.ni * 0.5));
            ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
            ctx.lineWidth = 1.5 * weight;
          } else if (layerActive) {
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.08 + 0.15 * weight})`;
            ctx.lineWidth = 0.8;
          } else {
            ctx.strokeStyle = `rgba(100, 116, 139, 0.04)`;
            ctx.lineWidth = 0.3;
          }
          ctx.stroke();

          // Data particle flowing along connection
          if (isFlowing) {
            const progress = ((t * 2 + fn.ni * 0.3 + tn.ni * 0.2) % 1);
            const px = fn.x + (tn.x - fn.x) * progress;
            const py = fn.y + (tn.y - fn.y) * progress;
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(56, 189, 248, ${0.6 * weight})`;
            ctx.fill();
          }
        }
      }
    }

    // Draw nodes
    for (const node of nodePositions) {
      const isActive = activeLayer >= node.li;
      const isCurrentLayer = activeLayer === node.li && stage !== 'complete';
      const isComplete = stage === 'complete';

      // Glow effect for active/current layer
      if (isCurrentLayer) {
        const glow = 0.15 + 0.1 * Math.sin(t * 4 + node.ni * 1.5);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
        ctx.fill();
      }

      // Node body
      const radius = isCurrentLayer ? 6 : 5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

      if (isComplete) {
        const g = 0.7 + 0.3 * Math.sin(t * 2 + node.ni);
        ctx.fillStyle = `rgba(74, 222, 128, ${g})`;
      } else if (isCurrentLayer) {
        const g = 0.6 + 0.4 * Math.sin(t * 4 + node.ni * 1.3);
        ctx.fillStyle = `rgba(56, 189, 248, ${g})`;
      } else if (isActive) {
        ctx.fillStyle = `rgba(56, 189, 248, 0.5)`;
      } else {
        ctx.fillStyle = `rgba(100, 116, 139, 0.2)`;
      }
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isCurrentLayer ? 'rgba(56, 189, 248, 0.8)' : isActive ? 'rgba(56, 189, 248, 0.3)' : 'rgba(100, 116, 139, 0.15)';
      ctx.lineWidth = isCurrentLayer ? 1.5 : 0.8;
      ctx.stroke();

      // Show value inside/next to active nodes
      if (isActive && (node.li === 0 || node.li === LAYER_CONFIG.length - 1)) {
        const val = getNodeValue(node.li, node.ni);
        if (val !== '—') {
          ctx.font = '8px monospace';
          ctx.textAlign = node.li === 0 ? 'right' : 'left';
          ctx.fillStyle = isComplete ? 'rgba(74, 222, 128, 0.9)' : 'rgba(56, 189, 248, 0.9)';
          const xOff = node.li === 0 ? -10 : 10;
          ctx.fillText(val.slice(0, 12), node.x + xOff, node.y + 3);
        }
      }
    }

    // Layer labels at bottom
    ctx.textAlign = 'center';
    LAYER_CONFIG.forEach((layer, li) => {
      const isActive = activeLayer >= li;
      const isCurrent = activeLayer === li;
      ctx.font = isCurrent ? 'bold 8px system-ui, sans-serif' : '7px system-ui, sans-serif';
      ctx.fillStyle = isCurrent
        ? 'rgba(56, 189, 248, 1)'
        : isActive
          ? 'rgba(56, 189, 248, 0.6)'
          : 'rgba(100, 116, 139, 0.4)';
      ctx.fillText(layer.name, layerX[li], h - 6);
    });

    // Active layer highlight label at top
    if (activeLayer >= 0 && activeLayer < LAYER_CONFIG.length && stage !== 'complete') {
      const al = LAYER_CONFIG[activeLayer];
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(`▸ ${al.name}`, layerX[activeLayer], 12);
    }
    if (stage === 'complete') {
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(74, 222, 128, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('✓ Inference Complete', w / 2, 12);
    }

    if (stage !== 'idle') {
      animRef.current = requestAnimationFrame(drawNetwork);
    }
  }, [stage, activeLayer, getNodeValue]);

  useEffect(() => {
    if (stage !== 'idle') {
      animRef.current = requestAnimationFrame(drawNetwork);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [stage, drawNetwork]);

  // Handle canvas hover for tooltips
  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const padX = 55;
    const padY = 30;

    for (let li = 0; li < LAYER_CONFIG.length; li++) {
      const x = padX + (li / (LAYER_CONFIG.length - 1)) * (w - padX * 2);
      const count = LAYER_CONFIG[li].nodes;
      const spacing = Math.min(28, (h - padY * 2) / (count + 1));
      for (let ni = 0; ni < count; ni++) {
        const ny = h / 2 + (ni - (count - 1) / 2) * spacing;
        const dist = Math.sqrt((mx - x) ** 2 + (my - ny) ** 2);
        if (dist < 10) {
          setHoveredNode({ layer: li, node: ni, x: e.clientX, y: e.clientY });
          return;
        }
      }
    }
    setHoveredNode(null);
  }, []);

  if (stage === 'idle') return null;

  const meta = STAGE_META[stage];
  const StageIcon = meta.icon;
  const currentIdx = STAGE_ORDER.indexOf(stage);

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur overflow-hidden transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1 rounded ${stage === 'complete' ? 'bg-green-500/10' : 'bg-cyan-500/10'}`}>
            {stage === 'complete'
              ? <CheckCircle2 className="w-4 h-4 text-green-400" />
              : <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            }
          </div>
          <span className="text-xs font-semibold text-foreground">
            {title || 'Neural Processing View'}
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${meta.color} bg-white/5`}>
            {meta.label}
          </span>
          {elapsed != null && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {(elapsed / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Progress stages */}
          <div className="flex items-center gap-1">
            {STAGE_ORDER.map((s, i) => {
              const done = currentIdx > i;
              const active = currentIdx === i;
              return (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    done ? 'bg-green-400/60' : active ? 'bg-cyan-400/80 animate-pulse' : 'bg-slate-700/50'
                  }`}
                />
              );
            })}
          </div>

          {/* Stage labels under progress */}
          <div className="flex items-center gap-1 -mt-1">
            {STAGE_ORDER.map((s, i) => {
              const done = currentIdx > i;
              const active = currentIdx === i;
              return (
                <div key={s} className={`flex-1 text-center text-[8px] font-mono ${
                  active ? 'text-cyan-400' : done ? 'text-green-400/60' : 'text-muted-foreground/30'
                }`}>
                  {STAGE_META[s].label.split(' ')[0]}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_180px] gap-3 items-start">
            {/* Inputs - real values */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-cyan-400/80 uppercase tracking-wider">Real Input Data</div>
              {inputs.map((inp, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    currentIdx >= 0 ? 'bg-cyan-400 shadow-[0_0_4px_rgba(56,189,248,0.5)]' : 'bg-slate-700'
                  }`} />
                  <span className="text-[10px] text-muted-foreground">{inp.label}:</span>
                  <span className="text-[10px] font-mono text-cyan-300 font-bold">{inp.value}</span>
                </div>
              ))}
              {/* Normalized view */}
              {currentIdx >= 1 && (
                <div className="mt-2 pt-2 border-t border-slate-700/30">
                  <div className="text-[9px] text-blue-400/70 uppercase tracking-wider mb-1">Normalized</div>
                  {inputs.map((inp, i) => {
                    const normVal = (Math.sin(i * 3.14 + 1.7) * 0.4 + 0.5).toFixed(4);
                    return (
                      <div key={i} className="flex items-center gap-1 mb-0.5">
                        <div className="h-2 rounded-sm bg-blue-500/40 transition-all duration-700"
                          style={{ width: `${parseFloat(normVal) * 100}%`, minWidth: 4 }}
                        />
                        <span className="text-[8px] font-mono text-blue-300/70">{normVal}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Neural network canvas */}
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="w-full rounded border border-slate-700/30"
                style={{ height: 180 }}
                onMouseMove={handleCanvasMove}
                onMouseLeave={() => setHoveredNode(null)}
              />
              {/* Tooltip */}
              {hoveredNode && (
                <div
                  className="fixed z-50 bg-slate-800 border border-cyan-500/30 rounded px-2 py-1 text-[10px] font-mono pointer-events-none shadow-lg"
                  style={{ left: hoveredNode.x + 12, top: hoveredNode.y - 10 }}
                >
                  <div className="text-cyan-400 font-bold">{LAYER_CONFIG[hoveredNode.layer].name}</div>
                  <div className="text-muted-foreground">
                    Node: {LAYER_CONFIG[hoveredNode.layer].labels[hoveredNode.node] || `n${hoveredNode.node}`}
                  </div>
                  <div className="text-foreground">
                    Value: {getNodeValue(hoveredNode.layer, hoveredNode.node)}
                  </div>
                </div>
              )}
              {/* Layer count indicator */}
              <div className="absolute top-1 right-2 text-[8px] font-mono text-muted-foreground/40">
                {LAYER_CONFIG.length} layers · {LAYER_CONFIG.reduce((s, l) => s + l.nodes, 0)} neurons
              </div>
            </div>

            {/* Outputs - real values */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">
                {stage === 'complete' ? 'Predicted Output' : 'Awaiting Output...'}
              </div>
              {stage === 'complete' || stage === 'output' ? (
                outputs.map((out, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      stage === 'complete' ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.5)]' : 'bg-emerald-400/50 animate-pulse'
                    }`} />
                    <span className="text-[10px] text-muted-foreground">{out.label}:</span>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold">{out.value}</span>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  {LAYER_CONFIG[LAYER_CONFIG.length - 1].labels.map((label, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-700/50" />
                      <span className="text-[10px] text-muted-foreground/40">{label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/20">—</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground/30 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Computing...
                  </div>
                </div>
              )}

              {/* Confidence/quality on complete */}
              {stage === 'complete' && elapsed != null && (
                <div className="mt-2 pt-2 border-t border-slate-700/30">
                  <div className="text-[9px] text-green-400/70 uppercase tracking-wider mb-1">Run Info</div>
                  <div className="text-[9px] font-mono text-green-300/60">
                    Time: {(elapsed / 1000).toFixed(2)}s
                  </div>
                  <div className="text-[9px] font-mono text-green-300/60">
                    Status: ✓ Complete
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
            <StageIcon className={`w-3.5 h-3.5 ${meta.color}`} />
            <span className={`text-[10px] font-mono ${meta.color}`}>{meta.label}</span>
            <span className="text-[8px] font-mono text-muted-foreground/40 ml-auto">
              Metamaterial Absorber NN · {LAYER_CONFIG.reduce((s, l) => s + l.nodes, 0)} params
            </span>
            {stage === 'complete' && elapsed != null && (
              <span className="text-[10px] font-mono text-green-400">
                ✓ {(elapsed / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIWorkingPanel;

export function useAIStages() {
  const [stage, setStage] = useState<AIStage>('idle');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 50);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(Date.now() - startRef.current);
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const runWithStages = useCallback(async <T,>(computeFn: () => T): Promise<T> => {
    reset();
    startTimer();

    setStage('input');
    await delay(400);

    setStage('preprocessing');
    await delay(500);

    setStage('network');
    await delay(1200); // Longer to show layer-by-layer progression
    const result = computeFn();

    setStage('output');
    await delay(400);

    setStage('complete');
    stopTimer();

    return result;
  }, [reset, startTimer, stopTimer]);

  return { stage, setStage, elapsed, startTimer, stopTimer, reset, runWithStages };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

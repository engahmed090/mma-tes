import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { CurvesByP } from '@/utils/parser';
import { nearestPKey, absorptionFromS11, calcBandwidth } from '@/utils/math';

interface CombinedPlotProps {
  curves: CurvesByP;
  pValue: number;
  thrDb?: number;
  vline?: number;
  vspan?: [number, number];
  height?: number;
}

const CombinedPlot: React.FC<CombinedPlotProps> = ({ curves, pValue, thrDb = -10, vline, vspan, height = 380 }) => {
  const plotData = useMemo(() => {
    const data: any[] = [];
    const shapes: any[] = [];
    const pKey = nearestPKey(curves, pValue);
    
    if (pKey !== null && curves[pKey]) {
      const { freqs, s11 } = curves[pKey];
      const A = (absorptionFromS11(s11) as number[]).map(a => a * 100);
      const { bw, fLo, fHi } = calcBandwidth(freqs, s11, thrDb);
      
      data.push({
        x: freqs, y: s11, mode: 'lines', name: 'S11 (dB)',
        line: { color: '#2563EB', width: 2.5 }, yaxis: 'y1',
      });
      data.push({
        x: freqs, y: A, mode: 'lines', name: 'Absorption (%)',
        line: { color: '#10B981', width: 2, dash: 'dot' },
        fill: 'tozeroy', fillcolor: 'rgba(16,185,129,0.06)', yaxis: 'y2',
      });
      
      if (bw > 0 && isFinite(fLo)) {
        shapes.push({
          type: 'rect', xref: 'x', yref: 'y1', x0: fLo, x1: fHi,
          y0: -60, y1: 5, fillcolor: 'rgba(37,99,235,0.12)', line: { width: 0 },
        });
        data.push({
          x: [(fLo + fHi) / 2], y: [2], mode: 'text',
          text: [`BW=${bw.toFixed(2)} GHz`], textfont: { color: '#2563EB', size: 10 },
          showlegend: false, yaxis: 'y1',
        });
      }
    }
    
    // Threshold lines
    shapes.push({
      type: 'line', xref: 'paper', yref: 'y1',
      x0: 0, x1: 1, y0: thrDb, y1: thrDb,
      line: { color: 'red', width: 1, dash: 'dash' },
    });
    
    if (vline !== undefined) {
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper',
        x0: vline, x1: vline, y0: 0, y1: 1,
        line: { color: '#F59E0B', width: 1.5, dash: 'dot' },
      });
    }
    
    if (vspan) {
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper',
        x0: Math.min(vspan[0], vspan[1]), x1: Math.max(vspan[0], vspan[1]),
        y0: 0, y1: 1, fillcolor: 'rgba(96,165,250,0.07)', line: { width: 0 },
      });
    }
    
    return { data, shapes };
  }, [curves, pValue, thrDb, vline, vspan]);

  const layout: any = {
    height,
    margin: { l: 60, r: 60, t: 20, b: 50 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(15,23,42,0.3)',
    font: { family: 'JetBrains Mono, monospace', color: '#94a3b8', size: 11 },
    xaxis: { title: 'Frequency (GHz)', gridcolor: 'rgba(148,163,184,0.1)', zerolinecolor: 'rgba(148,163,184,0.1)' },
    yaxis: { title: 'S11 (dB)', gridcolor: 'rgba(148,163,184,0.1)', zerolinecolor: 'rgba(148,163,184,0.1)' },
    yaxis2: { title: 'Absorption (%)', overlaying: 'y', side: 'right', range: [0, 102], gridcolor: 'rgba(148,163,184,0.05)' },
    legend: { orientation: 'h', y: 1.08, x: 0, font: { size: 10 } },
    shapes: plotData.shapes,
  };

  return (
    <Plot
      data={plotData.data}
      layout={layout}
      config={{ responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
      style={{ width: '100%' }}
    />
  );
};

export default CombinedPlot;

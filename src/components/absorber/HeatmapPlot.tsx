import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { CurvesByP } from '@/utils/parser';

interface HeatmapPlotProps {
  curves: CurvesByP;
  freqTarget?: number;
  height?: number;
}

const HeatmapPlot: React.FC<HeatmapPlotProps> = ({ curves, freqTarget, height = 300 }) => {
  const plotData = useMemo(() => {
    const ps = Object.keys(curves).map(Number).sort((a, b) => a - b);
    if (ps.length === 0) return null;
    const allF = curves[ps[0]].freqs;
    const zMat = ps.map(p => {
      const { freqs, s11 } = curves[p];
      return allF.map(f => {
        if (f <= freqs[0]) return s11[0];
        if (f >= freqs[freqs.length - 1]) return s11[s11.length - 1];
        for (let i = 0; i < freqs.length - 1; i++) {
          if (f >= freqs[i] && f <= freqs[i + 1]) {
            const t = (f - freqs[i]) / (freqs[i + 1] - freqs[i]);
            return s11[i] + t * (s11[i + 1] - s11[i]);
          }
        }
        return NaN;
      });
    });
    return { allF, ps, zMat };
  }, [curves]);

  if (!plotData) return null;

  const shapes: any[] = [];
  if (freqTarget !== undefined) {
    shapes.push({
      type: 'line', xref: 'x', yref: 'paper',
      x0: freqTarget, x1: freqTarget, y0: 0, y1: 1,
      line: { color: 'white', width: 2, dash: 'dot' },
    });
  }

  return (
    <Plot
      data={[{
        z: plotData.zMat, x: plotData.allF, y: plotData.ps,
        type: 'heatmap',
        colorscale: [[0, '#1d4ed8'], [0.4, '#10B981'], [0.7, '#F59E0B'], [1, '#EF4444']],
        zmin: -40, zmax: 0,
        colorbar: { title: { text: 'S11 (dB)' }, tickvals: [-40, -20, -10, -5, 0], tickfont: { color: '#94a3b8' } },
        hovertemplate: 'Freq=%{x:.2f} GHz<br>P=%{y:.2f} mm<br>S11=%{z:.1f} dB<extra></extra>',
      }]}
      layout={{
        height,
        margin: { l: 60, r: 10, t: 35, b: 50 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(15,23,42,0.3)',
        font: { family: 'JetBrains Mono, monospace', color: '#94a3b8', size: 11 },
        xaxis: { title: { text: 'Frequency (GHz)' } },
        yaxis: { title: { text: 'P (mm)' } },
        title: { text: 'S11 Sweep — P vs Frequency', font: { size: 13, color: '#e2e8f0' } },
        shapes,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
    />
  );
};

export default HeatmapPlot;

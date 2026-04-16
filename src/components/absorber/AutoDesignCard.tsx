import React from 'react';
import { aiAutoDesign, makeAutoDesignCurves, buildAutoDesignSpec } from '@/utils/math';
import CombinedPlot from './CombinedPlot';
import Absorber3D from './Absorber3D';

interface AutoDesignCardProps {
  freqGhz: number;
  thrDb: number;
}

const AutoDesignCard: React.FC<AutoDesignCardProps> = ({ freqGhz, thrDb }) => {
  const design = aiAutoDesign(freqGhz);
  const curves = makeAutoDesignCurves(design);
  const doiMatch = design.reference.match(/10\.\d{4,}\/\S+/);

  const rows: [string, string][] = [
    ['Target Freq', `${freqGhz.toFixed(4)} GHz`],
    ['λ', `${design.lambdaMm} mm`],
    ['Geometry', design.geomDesc],
    ['Unit Cell P', `${design.unitCellMm} mm (≈λ/10)`],
    ['Substrate', design.substrateMaterial],
    ['Substrate h', `${design.substrateHMm} mm`],
    ['Patch', `Copper ${design.patchThickMm}mm`],
    ['Ground', `Copper ${design.groundThickMm}mm solid`],
    ['Expected S11', `${design.expectedS11Db} dB`],
    ['Expected A', `${design.expectedAbsorptionPct}%`],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5 border border-primary/30" style={{ background: 'linear-gradient(135deg, hsl(222 47% 6%), hsl(210 50% 23%))' }}>
        <h3 className="text-primary font-bold text-lg">🤖 AI Auto-Design — {freqGhz.toFixed(3)} GHz</h3>
        <p className="text-muted-foreground text-sm mt-1">No shape covers this frequency. Physics-based design from literature:</p>
        <p className="text-warn text-xs mt-2">📄 {design.reference}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-secondary/50">
                <th className="py-2 px-3 text-left text-muted-foreground">Parameter</th>
                <th className="py-2 px-3 text-left text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([p, v], i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="py-1.5 px-3 text-muted-foreground">{p}</td>
                  <td className="py-1.5 px-3 text-foreground font-medium">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {doiMatch && (
            <div className="px-3 py-2">
              <a href={`https://doi.org/${doiMatch[0].replace(/\)$/, '')}`} target="_blank" rel="noopener" className="text-primary text-xs hover:underline">
                🔗 Paper DOI
              </a>
            </div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">🧊 3D Structure</h4>
          <Absorber3D
            shapeSpec={buildAutoDesignSpec(design)}
            pValueMm={design.patchSizeMm}
            height={340}
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">📈 Predicted S11 curve (physics model):</h4>
        <CombinedPlot curves={curves} pValue={design.patchSizeMm} thrDb={thrDb} vline={freqGhz} />
      </div>
    </div>
  );
};

export default AutoDesignCard;

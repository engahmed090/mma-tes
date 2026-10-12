import { RESONANCE_DATA } from '@/data/bloodSensingData';
import { isJuice, type Sample } from './demo';
/** Presentation-only curves. Never imported by ranking, backend inference or scientific exports. */
export function responseFor(sample: Sample) {
  const juice = isJuice(sample);
  const baseline = RESONANCE_DATA[sample === 'Healthy' ? 'normal_blood' : sample === 'Research' ? 'cancer_blood' : 'air'];
  // Nitrate parameters are deliberately schematic drawing coordinates, not calibrated concentrations.
  const center = juice ? sample === 'JuiceElevated' ? 2.48 : 2.42 : baseline.fr_ghz;
  const depth = juice ? -22 : baseline.s11_at_fr_db;
  const width = juice ? 0.018 : baseline.bw_mhz / 1000;
  const min = juice ? 2.3 : 2.45, max = juice ? 2.6 : 2.515;
  const points = Array.from({ length: 301 }, (_, i) => {
    const frequency = min + (max - min) * i / 300;
    return { frequency, s11: depth * (width / 2) ** 2 / ((frequency - center) ** 2 + (width / 2) ** 2) };
  });
  return { points, min, max, center, label: juice ? 'ILLUSTRATIVE NITRATE SENSING RESPONSE' : 'ILLUSTRATIVE RESEARCH RESPONSE',
    provenance: juice ? 'Schematic curve; arbitrary illustration parameters. No nitrate calibration or measured source.' : 'Analytical Lorentzian from existing bloodSensingData.ts baseline parameters; source calibration unverified. Not measured CST data.',
    type: juice ? 'synthetic/demo' : 'analytical/unverified' };
}
export const acquisitionFraction = (time: number) => Math.max(0, Math.min(1, (time - 5) / 7));

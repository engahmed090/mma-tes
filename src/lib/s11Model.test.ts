import { describe, it, expect } from 'vitest';
import weightsJson from '../../public/models/weights.json';
import scalers from '../../public/models/scalers.json';
import { validateModel, predictCurve, WeightsData } from './s11Model';
const weights = weightsJson as WeightsData;
describe('saved blood-sensing model contract', () => {
  it('loads the actual scaler schema and predicts all supported samples', () => {
    expect(() => validateModel(weights, scalers)).not.toThrow();
    // Independent NumPy matrix evaluation using the trainer's normalization.
    const reference = [[0.033, -0.056], [0.026, -0.102], [0.034, -0.126]];
    for (const [index, sample] of scalers.eps_values.entries()) {
      const result = predictCurve(weights, scalers, sample, 12, 1, 5);
      expect(result.points).toHaveLength(200);
      expect(result.points[0].s11).toBe(reference[index][0]);
      expect(result.points[199].s11).toBe(reference[index][1]);
      expect(result.points.every(p => Number.isFinite(p.s11))).toBe(true);
    }
  });
  it('rejects the old geometry schema and out-of-domain inputs', () => {
    expect(() => validateModel(weights, { ...scalers, input_features: ['freq', 'p', 'shape'] })).toThrow();
    for (const args of [[60, 9, 1, 5], [2, 12, 1, 5], [60, 12, 5, 1], [60, 12, 1, 20]]) {
      expect(() => predictCurve(weights, scalers, args[0], args[1], args[2], args[3])).toThrow();
    }
  });
});

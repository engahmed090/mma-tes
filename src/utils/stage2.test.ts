import { expect, it } from 'vitest';
import { calcBandwidth, searchResultStatus, rawBestInRange } from './math';
import { parseVNAFile } from './vna';
it('reports all, partial and failing ranges distinctly', () => {
  const result = (s11: number[]) => rawBestInRange({ 1: { freqs: [1, 2, 3], s11 } }, 1, 3, -10);
  expect(searchResultStatus(result([-12, -11, -10]))).toContain('entire range');
  expect(searchResultStatus(result([-12, -5, -3]))).toContain('best point only');
  expect(searchResultStatus(result([-2, -5, -3]))).toContain('FAIL');
  expect(searchResultStatus({ pass: true })).toBe('✅ PASS');
});
it('selects the widest contiguous sampled band without bridging failures', () => {
  expect(calcBandwidth([1, 2, 3, 4, 5, 6], [-12, -10, -3, -14, -15, -11])).toEqual({ bw: 2, fLo: 4, fHi: 6 });
  expect(calcBandwidth([1, 2, 3], [-12, NaN, -15]).bw).toBe(0);
  expect(calcBandwidth([1, 2], [-3, -5]).bw).toBe(0);
  expect(calcBandwidth([1, 2], [-10, -10]).bw).toBe(1);
});
it.each([['Hz', 1e9], ['MHz', 1000], ['GHz', 1]])('reads explicit %s units without magnitude guesses', (unit, frequency) => {
  const points = parseVNAFile(`freq_${unit},S11_dB\n${frequency},-10\n${frequency * 2},-20`);
  expect(points).toEqual([{ freq: 1, s11: -10 }, { freq: 2, s11: -20 }]);
});
it.each([['DB', '-20 45'], ['MA', '0.1 45'], ['RI', '0.06 0.08']])('decodes one-port Touchstone %s', (format, pair) => {
  const points = parseVNAFile(`! comment\n# Hz S ${format} R 50\n1e9 ${pair} ! inline\n2e9 ${pair}`, 'test.s1p');
  expect(points[0].freq).toBe(1);
  expect(points[0].s11).toBeCloseTo(-20);
});
it.each(['1 -10\n2 -20', '# GHz Z RI R 50\n1 1 0\n2 1 0', '[Version] 2.0', '# GHz S DB R 50\n1 -10 0 1 0\n2 -10 0 1 0', 'freq_GHz,S11_dB\n1x,-10\n2,-20'])('rejects ambiguous or unsupported VNA data', text => {
  expect(() => parseVNAFile(text)).toThrow();
});
it('rejects multiport files rather than treating S21 as S11', () => {
  expect(() => parseVNAFile('# GHz S DB R 50\n1 -10 0\n2 -10 0', 'data.s2p')).toThrow();
});

it('constructs gap cutters with exact angular boundaries outside the ring', async () => {
  const { splitRingGapMacro } = await import('./cstGeometry');
  const lines = splitRingGapMacro('Ring', 4.5, 90, 16, .035);
  const vertices = lines.filter(l => l.includes('.LineTo')).slice(0, 2).map(l => [...l.matchAll(/"([^" ]+)"/g)].map(m => Number(m[1])));
  expect(vertices.map(([x, y]) => Math.atan2(y, x) * 180 / Math.PI)[0]).toBeCloseTo(82, 6);
  expect(vertices.map(([x, y]) => Math.atan2(y, x) * 180 / Math.PI)[1]).toBeCloseTo(98, 6);
  expect(vertices.every(([x, y]) => Math.hypot(x, y) > 4.5)).toBe(true);
  expect(() => splitRingGapMacro('Ring', 4.5, 90, 180, .035)).toThrow();
});

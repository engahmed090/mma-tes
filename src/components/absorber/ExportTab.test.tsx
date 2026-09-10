import { expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ExportTab, { buildCSTMacro } from './ExportTab';
import { SHAPES } from '@/data/shapes';
import { LoadedShape } from '@/hooks/useShapeData';
function shape(name: string): LoadedShape {
  const config = SHAPES.find(s => s.name === name)!;
  return { ...config, fixed: { ...config.fixed }, config, isReal: true,
    curves: {}, ranges: { fmin: 1, fmax: 20, pmin: 0, pmax: 10 } } as LoadedShape;
}
afterEach(cleanup);
it('keeps selector labels as strings and handlers callable', () => {
  render(<ExportTab shapes={[shape('rectangle')]} pickAllInFreq={() => []} />);
  fireEvent.click(screen.getByRole('button', { name: /Select Shapes/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
  expect(screen.getByRole('button', { name: /Shapes \(0\/1\)/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
  expect(screen.getByRole('button', { name: /Shapes \(1\/1\)/ })).toBeTruthy();
});
it('exports the selected radius and substrate height', () => {
  expect(buildCSTMacro(shape('ring_ro_sweep'), 3, 5, -10)).toContain('.Outerradius "3.000000"');
  const ring = shape('ring');
  ring.fixed.substrate_eps_r = 2.2; ring.fixed.substrate_tan_delta = .001;
  const macro = buildCSTMacro(ring, 2.5, 5, -10);
  expect(macro).toContain('StoreParameter "sub_h",   "2.5"');
  expect(macro).toContain('.Zrange "-2.500000", "0"');
  expect(macro).toContain('.Material "Substrate"');
  expect(macro).not.toContain('FR-4');
  expect(macro).toContain('.Epsilon "2.2"');
});
it('subtracts both angular gaps instead of exporting closed rings', () => {
  const macro = buildCSTMacro(shape('two_resonator'), 0, 5, -10);
  expect(macro).toContain('Ring1: gap center 90 deg, width 16 deg');
  expect(macro).toContain('Ring2: gap center 270 deg, width 16 deg');
  expect(macro.match(/Solid.Subtract/g)).toHaveLength(2);
});
it.each(['triangle1', 'octa_resonator'])('explicitly rejects unsupported %s export', name => {
  expect(() => buildCSTMacro(shape(name), 0, 5, -10)).toThrow(/unsupported/);
});
it('does not substitute FR-4 for a material with unknown properties', () => {
  expect(() => buildCSTMacro(shape('square'), 4, 5, -10)).toThrow(/substrate_eps_r/);
});

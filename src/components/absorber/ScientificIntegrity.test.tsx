import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return Object.fromEntries(['ComposedChart', 'Line', 'Scatter', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend', 'ResponsiveContainer', 'ReferenceLine'].map(name => [name, Container]));
});
import BioSensingTab from './BioSensingTab';
import AutoDesignCard from './AutoDesignCard';
import { analyticalS11Curve, DNN_METRICS, KPIS, SENSITIVITY_TABLE } from '@/data/bloodSensingData';
afterEach(cleanup);
it('keeps scientific data safeguards and removes analytical panels from hardware tab', () => {
  render(<BioSensingTab />);
  expect(screen.queryByText(/Analytical Sensing Model|Manual VNA Input|Sensitivity/)).toBeNull();
  expect(screen.getByText(/Scripted animation, not measured results/)).toBeTruthy();
  expect(screen.getByText(/Classification accuracy .* Unavailable/)).toBeTruthy();
  expect(DNN_METRICS.status).toBe('unavailable');
  expect(KPIS.status).toBe('unavailable');
  expect(SENSITIVITY_TABLE.every(r => r.fr_ghz === null && r.sensitivity === 'Unavailable')).toBe(true);
  expect(analyticalS11Curve(10, 1).provenance.type).toBe('analytical');
});
it('does not substitute expected performance or a generated curve for missing designs', () => {
  render(<AutoDesignCard freqGhz={10} thrDb={-10} />);
  expect(screen.getByRole('status').textContent).toContain('performance are unavailable');
  expect(screen.queryByText(/Expected S11|Expected A|AI Auto-Design/)).toBeNull();
});

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
it('identifies analytical curves and makes unsupported metrics unavailable', () => {
  render(<BioSensingTab />);
  expect(screen.getByRole('heading', { name: /Analytical Sensing Model/ })).toBeTruthy();
  expect(screen.queryByText(/Virtual AI Laboratory/)).toBeNull();
  expect(screen.getByText(/Not a neural-network prediction/)).toBeTruthy();
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
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

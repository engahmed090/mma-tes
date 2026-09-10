import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/hooks/useShapeData', () => ({ useShapeData: () => ({ shapes: [], loading: true, errors: [] }) }));
vi.mock('@/components/absorber/FindBestTab', () => ({ default: () => null }));
vi.mock('@/components/absorber/InverseDesignTab', () => ({ default: () => null }));
vi.mock('@/components/absorber/BioSensingTab', () => ({ default: () => null }));
vi.mock('@/components/absorber/ChatTab', () => ({ default: () => null }));
vi.mock('@/components/absorber/ExportTab', () => ({ default: () => null }));
vi.mock('@/components/absorber/DNNPredictorTab', () => ({ default: () => null }));
import Index from './Index';
it('renders the full permittivity set literally', () => {
  render(<Index />);
  expect(screen.getByText('Blood Sensing: εr∈{1,60,68}')).toBeTruthy();
});

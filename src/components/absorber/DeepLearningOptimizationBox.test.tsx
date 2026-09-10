import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Box from './DeepLearningOptimizationBox';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('sends canonical identifiers and removes stale suggestions on failure', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ prediction_source: 'pytorch', model_used: 'ring.pt', p_optimal: 4 }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ detail: 'Missing verified contract' }) });
  vi.stubGlobal('fetch', fetchMock);
  const { rerender } = render(<Box currentP={2} currentS11={-3} targetFreq={5} shapeId="ring" />);
  await screen.findByText(/single-frequency model suggestion/);
  rerender(<Box currentP={2} currentS11={-3} targetFreq={5} shapeId="ring_ro_sweep" />);
  await screen.findByText(/Missing verified contract/);
  expect(screen.queryByText(/single-frequency model suggestion/)).toBeNull();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).shape_type).toBe('ring_ro_sweep');
});
it('rejects legacy synthetic-looking success responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ p_optimal: 3, model_used: 'fake.pt' }) }));
  render(<Box currentP={2} currentS11={-3} targetFreq={5} shapeId="square" />);
  await waitFor(() => expect(screen.getByText(/did not return a verified model prediction/)).toBeTruthy());
});

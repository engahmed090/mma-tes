import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useShapeData } from './useShapeData';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('never substitutes synthetic shapes when real files are unavailable by default', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  const { result } = renderHook(() => useShapeData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.shapes).toEqual([]);
  expect(result.current.pickAllInFreq(8, -10)).toEqual([]);
  expect(result.current.pickAllInRange(8, 10, -10)).toEqual([]);
});
it('labels explicit demo opt-in and immediately excludes demos after opt-out', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  const { result, rerender } = renderHook(({ demo }) => useShapeData(demo), { initialProps: { demo: true } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.shapes).toHaveLength(3);
  expect(result.current.shapes.every(s => s.displayName.includes('SYNTHETIC / DEMONSTRATION DATA') && s.provenance?.type === 'synthetic/demo')).toBe(true);
  expect(result.current.pickAllInFreq(8, -10).length).toBeGreaterThan(0);
  act(() => rerender({ demo: false }));
  expect(result.current.pickAllInFreq(8, -10)).toEqual([]);
  expect(result.current.pickAllInRange(8, 10, -10)).toEqual([]);
  await waitFor(() => expect(result.current.loading).toBe(false));
});

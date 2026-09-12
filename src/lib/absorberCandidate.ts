import type { LoadedShape } from '@/hooks/useShapeData';
/** Pass the canonical source geometry through unchanged to the shared 3D renderer. */
export function candidateGeometry(item: LoadedShape, pValueMm: number) {
  return { shapeSpec: { geometryType: item.geometryType, paramMode: item.paramMode,
    paramLabel: item.paramLabel, fixed: item.fixed }, pValueMm };
}
export function candidateSource(item: LoadedShape) {
  if (!item.isReal) return 'SYNTHETIC / DEMONSTRATION DATA';
  return item.ranges.fmin <= 1 && item.ranges.fmax >= 5
    ? 'CST DATA · 1–5 GHz coverage' : 'CST DATA';
}

/** Expose inconsistent inherited geometry metadata; never resize source geometry to fit. */
export function candidateGeometryWarning(item: LoadedShape, p: number): string | null {
  const cell=Number(item.fixed.unit_cell_mm);
  if(item.paramMode==='ro' && Number.isFinite(cell) && p*2>cell)
    return 'UNVERIFIED GEOMETRY: source ring diameter exceeds the configured unit-cell width. Original dimensions are preserved; confirm the CST geometry before fabrication or research use.';
  return null;
}

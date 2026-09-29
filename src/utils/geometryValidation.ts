export interface GeometryLike {
  geometryType: string;
  paramMode: string;
  fixed: Record<string, any>;
  fixedCurve?: boolean;
}

export interface GeometryValidationResult {
  valid: boolean;
  reason?: string;
}

const EPS = 1e-9;

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function insideHalfCell(value: number, unitCell: number): boolean {
  return Math.abs(value) <= unitCell / 2 + EPS;
}

/**
 * Checks whether a selected sweep value can be represented inside the configured
 * unit cell without silently resizing the geometry.
 *
 * This is a manufacturability/geometry guard only. A valid result does not imply
 * electromagnetic performance, fabrication tolerance, or experimental validation.
 */
export function validateGeometryCandidate(shape: GeometryLike, pValue: number): GeometryValidationResult {
  if (!Number.isFinite(pValue)) return { valid: false, reason: 'Sweep parameter is not finite.' };

  const fixed = shape.fixed ?? {};
  const unitCell = Number(fixed.unit_cell_mm);
  if (!finitePositive(unitCell)) return { valid: false, reason: 'Unit-cell size is missing or invalid.' };

  const gt = shape.geometryType;
  const mode = shape.paramMode;

  if (gt === 'square_patch') {
    if (mode === 'wm' && (pValue <= 0 || pValue > unitCell + EPS)) {
      return { valid: false, reason: `Square patch width ${pValue} mm exceeds the ${unitCell} mm unit cell.` };
    }
    return { valid: true };
  }

  if (gt === 'rect_patch') {
    if (mode !== 'wm') return { valid: false, reason: `Unsupported rectangle sweep mode: ${mode}.` };
    const yFactor = Number(fixed.rect_y_factor ?? 0.5);
    if (!finitePositive(yFactor)) return { valid: false, reason: 'Rectangle Y-factor is invalid.' };
    if (pValue <= 0 || pValue > unitCell + EPS || pValue * yFactor > unitCell + EPS) {
      return { valid: false, reason: `Rectangle dimensions for P=${pValue} mm exceed the ${unitCell} mm unit cell.` };
    }
    return { valid: true };
  }

  if (gt === 'ring_patch_fixed_geom') {
    const outer = mode === 'ro' ? pValue : Number(fixed.ring_outer_r_mm);
    const inner = mode === 'rin' ? pValue : Number(fixed.ring_inner_r_mm);
    if (!Number.isFinite(outer) || !Number.isFinite(inner) || outer <= inner || inner < 0) {
      return { valid: false, reason: 'Ring radii must satisfy outer radius > inner radius >= 0.' };
    }
    if (2 * outer > unitCell + EPS) {
      return {
        valid: false,
        reason: `Ring diameter ${(2 * outer).toFixed(4)} mm exceeds the ${unitCell} mm unit cell.`,
      };
    }
    if (mode === 'h' && pValue <= 0) return { valid: false, reason: 'Substrate thickness must be positive.' };
    return { valid: true };
  }

  if (gt === 'double_split_rings') {
    const radii = [
      Number(fixed.ring1_outer_r_mm), Number(fixed.ring1_inner_r_mm),
      Number(fixed.ring2_outer_r_mm), Number(fixed.ring2_inner_r_mm),
    ];
    if (!radii.every(Number.isFinite)) return { valid: false, reason: 'Split-ring radii are incomplete.' };
    const [ro1, ri1, ro2, ri2] = radii;
    if (!(ro1 > ri1 && ri1 >= 0 && ro2 > ri2 && ri2 >= 0)) {
      return { valid: false, reason: 'Split-ring radii are inconsistent.' };
    }
    if (2 * Math.max(ro1, ro2) > unitCell + EPS) {
      return { valid: false, reason: 'A split-ring diameter exceeds the unit cell.' };
    }
    return { valid: true };
  }

  if (gt === 'triangle_patch_custom') {
    const vertices = fixed.triangle_vertices_mm;
    if (!Array.isArray(vertices) || vertices.length < 3) {
      return { valid: false, reason: 'Triangle vertices are missing.' };
    }
    const ok = vertices.every((pair: unknown) =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      Number.isFinite(Number(pair[0])) &&
      Number.isFinite(Number(pair[1])) &&
      insideHalfCell(Number(pair[0]), unitCell) &&
      insideHalfCell(Number(pair[1]), unitCell)
    );
    return ok
      ? { valid: true }
      : { valid: false, reason: 'At least one triangle vertex lies outside the unit cell.' };
  }

  // Unknown geometries are not silently rejected here because some UI-only shapes
  // are not exported to CST. Export code should continue to maintain its own support list.
  return { valid: true };
}

export function filterGeometryValidCurves<T>(
  shape: GeometryLike,
  curves: Record<number, T>
): { curves: Record<number, T>; excluded: { p: number; reason: string }[] } {
  const valid: Record<number, T> = {};
  const excluded: { p: number; reason: string }[] = [];

  for (const [key, curve] of Object.entries(curves)) {
    const p = Number(key);
    const check = validateGeometryCandidate(shape, p);
    if (check.valid) valid[p] = curve;
    else excluded.push({ p, reason: check.reason ?? 'Invalid geometry.' });
  }
  return { curves: valid, excluded };
}

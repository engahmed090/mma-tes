import React from 'react';

interface DimTableProps {
  spec: { fixed: Record<string, any>; paramLabel?: string; paramMode?: string; geometryType?: string };
  pBest: number;
}

const DimTable: React.FC<DimTableProps> = ({ spec, pBest }) => {
  const fixed = spec.fixed || {};
  const mode = (spec.paramLabel || spec.paramMode || 'wm').toLowerCase();
  const gtype = spec.geometryType || '';
  
  let paramName = 'wm — patch width (mm)';
  if (mode === 'h') paramName = 'h — substrate thickness (mm)';
  else if (['ro', 'rout', 'outer_r'].includes(mode)) paramName = 'ro — outer radius (mm)';
  else if (['rin', 'inner_r'].includes(mode)) paramName = 'rin — inner radius (mm)';

  const rows: [string, string][] = [
    ['Unit Cell (P)', `${fixed.unit_cell_mm ?? '—'} mm`],
    ['Patch Material', fixed.patch_material ?? '—'],
    ['Patch Thickness', `${fixed.patch_thick_mm ?? '—'} mm`],
    ['Ground Material', fixed.ground_material ?? '—'],
    ['Ground Thickness', `${fixed.ground_thick_mm ?? '—'} mm`],
    ['Substrate Material', fixed.substrate_material ?? '—'],
    ['Substrate Thickness', `${fixed.substrate_thick_mm ?? fixed.substrate_visual_mm ?? '—'} mm`],
    [paramName, `► ${pBest.toFixed(4)} mm`],
  ];

  if (gtype.includes('triangle')) {
    const verts = fixed.triangle_vertices_mm;
    if (verts && Array.isArray(verts)) {
      const xs = verts.map((v: number[]) => v[0]);
      const ys = verts.map((v: number[]) => v[1]);
      rows.push(['Triangle span Δx/Δy', `${(Math.max(...xs) - Math.min(...xs)).toFixed(3)} / ${(Math.max(...ys) - Math.min(...ys)).toFixed(3)} mm`]);
    }
  }
  
  if (gtype.includes('ring') && !['double', 'split', 'octagon'].some(x => gtype.includes(x))) {
    if (['ro', 'rout', 'outer_r'].includes(mode)) {
      rows.push(['Ring Outer r', `► ${pBest.toFixed(4)} mm`], ['Ring Inner r', `${fixed.ring_inner_r_mm ?? '—'} mm`]);
    } else if (['rin', 'inner_r'].includes(mode)) {
      rows.push(['Ring Outer r', `${fixed.ring_outer_r_mm ?? '—'} mm`], ['Ring Inner r', `► ${pBest.toFixed(4)} mm`]);
    } else {
      rows.push(['Ring Outer r', `${fixed.ring_outer_r_mm ?? '—'} mm`], ['Ring Inner r', `${fixed.ring_inner_r_mm ?? '—'} mm`]);
    }
  } else if (gtype === 'double_split_rings') {
    rows.push(
      ['Outer r_out/r_in', `${fixed.ring1_outer_r_mm ?? '—'}/${fixed.ring1_inner_r_mm ?? '—'} mm`],
      ['Inner r_out/r_in', `${fixed.ring2_outer_r_mm ?? '—'}/${fixed.ring2_inner_r_mm ?? '—'} mm`],
      ['Gap Width', `${fixed.gap_width_deg ?? '—'}°`],
    );
  } else if (gtype === 'octagon_split_ring_center') {
    rows.push(
      ['Ring r_out/r_in', `${fixed.ring_outer_r_mm ?? '—'}/${fixed.ring_inner_r_mm ?? '—'} mm`],
      ['Center r', `${fixed.center_r_mm ?? '—'} mm`],
      ['Gap Width', `${fixed.gap_width_deg ?? '—'}°`],
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-muted-foreground font-semibold">Parameter</th>
            <th className="text-left py-2 px-3 text-muted-foreground font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([param, val], i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
              <td className="py-1.5 px-3 text-muted-foreground">{param}</td>
              <td className="py-1.5 px-3 text-foreground font-medium">{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DimTable;

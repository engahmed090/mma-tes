// Port of make_absorber_3d from app.py — exact same geometry logic
import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import {
  boxMesh, ringPrismMesh, polygonPrismMesh, polyVerticesPrismMesh,
  splitRingMesh, polygonSplitRingMesh, addBox, MeshData,
} from '@/utils/mesh3d';

const COLOR_COPPER = '#E07B00';
const COLOR_GROUND = '#B05A00';
const COLOR_SUBSTRATE = '#D6E4F0';
const COLOR_PORT = '#2563EB';

interface Absorber3DProps {
  shapeSpec: {
    geometryType: string;
    paramMode?: string;
    paramLabel?: string;
    fixed: Record<string, any>;
  };
  pValueMm: number;
  height?: number;
}

const Absorber3D: React.FC<Absorber3DProps> = ({ shapeSpec, pValueMm, height = 380 }) => {
  const plotData = useMemo(() => {
    const fixed = shapeSpec.fixed || {};
    const unitCell = parseFloat(fixed.unit_cell_mm ?? 16.0);
    const patchTh = parseFloat(fixed.patch_thick_mm ?? 0.035);
    const groundTh = parseFloat(fixed.ground_thick_mm ?? 0.035);
    const gtype = shapeSpec.geometryType || 'square_patch';
    const paramMode = (shapeSpec.paramLabel ?? shapeSpec.paramMode ?? 'wm').toLowerCase();

    let subTh: number;
    if (paramMode === 'h') {
      subTh = pValueMm > 0 ? pValueMm : parseFloat(fixed.substrate_visual_mm ?? 10.0);
    } else {
      subTh = parseFloat(fixed.substrate_thick_mm ?? fixed.substrate_visual_mm ?? 10.0);
    }

    const cellXy = Math.max(unitCell * 1.3, 8.0);
    const half = cellXy / 2.0;
    const zG1 = groundTh;
    const zS1 = zG1 + subTh;
    const zP1 = zS1 + patchTh;

    const traces: any[] = [];

    // Ground plane
    const ground = boxMesh(-half, half, -half, half, 0.0, zG1);
    traces.push({ type: 'mesh3d', ...spread(ground), opacity: 1.0, color: COLOR_GROUND, name: 'Ground Plane' });

    // Substrate
    const sub = boxMesh(-half, half, -half, half, zG1, zS1);
    traces.push({ type: 'mesh3d', ...spread(sub), opacity: 0.75, color: COLOR_SUBSTRATE, name: 'Substrate' });

    // Patch accumulator
    const patch: MeshData = { x: [], y: [], z: [], i: [], j: [], k: [] };

    if (gtype === 'square_patch') {
      const wm = pValueMm > 0 ? pValueMm : unitCell * 0.5;
      const ph = wm / 2.0;
      addBox(patch, -ph, ph, -ph, ph, zS1, zP1);
    } else if (gtype === 'rect_patch') {
      const wm = pValueMm > 0 ? pValueMm : unitCell * 0.5;
      const factor = parseFloat(fixed.rect_y_factor ?? 0.5);
      const L = wm / 2.0, W = (wm * factor) / 2.0;
      addBox(patch, -L, L, -W, W, zS1, zP1);
    } else if (gtype === 'triangle_patch_custom') {
      let verts: [number, number][] = fixed.triangle_vertices_mm ?? fixed.vertices_mm ?? [];
      if (!verts.length) verts = [[-4.5, 6.0], [5.5, -6.0], [6.5, 6.0]];
      let scale = 1.0;
      if (['wm', 'scale', 's'].includes(paramMode) && pValueMm > 0) {
        const base = parseFloat(fixed.wm_ref_mm ?? 0);
        scale = base > 0 ? pValueMm / base : 1.0;
      }
      const verts2: [number, number][] = verts.map(([a, b]) => [scale * a, scale * b]);
      const m = polyVerticesPrismMesh(verts2, zS1, zP1);
      traces.push({ type: 'mesh3d', ...spread(m), opacity: 1.0, color: COLOR_COPPER, name: 'Triangle Patch' });
    } else if (gtype === 'plus_cross_patch' || gtype === 'arrow_square_circle') {
      const span = parseFloat(fixed.span_factor ?? 0.90) * unitCell;
      const armW = Math.max(0.4, parseFloat(fixed.arm_width_factor ?? 0.10) * unitCell);
      const L = span / 2.0, w = armW / 2.0;
      addBox(patch, -L, L, -w, w, zS1, zP1);
      addBox(patch, -w, w, -L, L, zS1, zP1);
      if (gtype === 'arrow_square_circle') {
        const rCo = parseFloat(fixed.center_outer_r_mm ?? unitCell * 0.18);
        const rCi = parseFloat(fixed.center_inner_r_mm ?? unitCell * 0.13);
        const m = ringPrismMesh(rCo, rCi, zS1, zP1, 72);
        traces.push({ type: 'mesh3d', ...spread(m), opacity: 1.0, color: COLOR_COPPER, name: 'Center Ring' });
      }
    } else if (gtype === 'square_spiral') {
      const cnt = parseInt(fixed.turns ?? 4);
      const rw = parseFloat(fixed.trace_w_mm ?? 0.6);
      const rg = parseFloat(fixed.gap_mm ?? 0.6);
      const outer = parseFloat(fixed.outer_factor ?? 0.92) * unitCell;
      for (let k = 0; k < cnt; k++) {
        const side = outer - 2.0 * k * (rw + rg);
        if (side <= 2 * rw) break;
        const hS = side / 2.0, t = rw;
        addBox(patch, -hS, hS, hS - t, hS, zS1, zP1);
        addBox(patch, -hS, hS, -hS, -hS + t, zS1, zP1);
        addBox(patch, -hS, -hS + t, -hS, hS, zS1, zP1);
        addBox(patch, hS - t, hS, -hS, hS, zS1, zP1);
      }
    } else if (gtype === 'nested_square_rings') {
      const cnt = parseInt(fixed.ring_count ?? 3);
      const rw = parseFloat(fixed.ring_w_mm ?? 0.7);
      const rg = parseFloat(fixed.ring_gap_mm ?? 0.7);
      const outer = parseFloat(fixed.outer_factor ?? 0.92) * unitCell;
      for (let k = 0; k < cnt; k++) {
        const side = outer - 2.0 * k * (rw + rg);
        if (side <= 2 * rw) break;
        const h = side / 2.0, t = rw;
        addBox(patch, -h, h, h - t, h, zS1, zP1);
        addBox(patch, -h, h, -h, -h + t, zS1, zP1);
        addBox(patch, -h, -h + t, -h, h, zS1, zP1);
        addBox(patch, h - t, h, -h, h, zS1, zP1);
      }
    } else if (gtype === 'ring_patch_fixed_geom') {
      let rOut: number, rIn: number;
      if (['ro', 'rout', 'outer_r', 'outerradius'].includes(paramMode)) {
        rOut = pValueMm;
        rIn = parseFloat(fixed.ring_inner_r_mm ?? Math.max(0.1, rOut * 0.72));
      } else if (['rin', 'inner_r', 'innerradius'].includes(paramMode)) {
        rIn = pValueMm;
        rOut = parseFloat(fixed.ring_outer_r_mm ?? unitCell * 0.44);
      } else {
        rOut = parseFloat(fixed.ring_outer_r_mm ?? unitCell * 0.44);
        rIn = parseFloat(fixed.ring_inner_r_mm ?? unitCell * 0.32);
      }
      if (rOut <= 0) rOut = unitCell * 0.44;
      if (rIn <= 0 || rIn >= rOut) rIn = rOut * 0.72;
      const m = ringPrismMesh(rOut, rIn, zS1, zP1, 90);
      traces.push({ type: 'mesh3d', ...spread(m), opacity: 1.0, color: COLOR_COPPER, name: 'Ring Patch' });
    } else if (gtype === 'octagon_split_ring_center') {
      const rOut = parseFloat(fixed.ring_outer_r_mm ?? 2.28);
      const rIn = parseFloat(fixed.ring_inner_r_mm ?? 1.76);
      const centers = fixed.gap_centers_deg ?? [90.0, 210.0, 330.0];
      const gapW = parseFloat(fixed.gap_width_deg ?? 18.0);
      const segs = parseInt(fixed.segments ?? 8);
      const m = polygonSplitRingMesh(rOut, rIn, zS1, zP1, segs, centers, gapW);
      traces.push({ type: 'mesh3d', ...spread(m), opacity: 1.0, color: COLOR_COPPER, name: 'Octagon Ring' });
      const rC = parseFloat(fixed.center_r_mm ?? 1.20);
      const disk = polygonPrismMesh(rC, zS1, zP1, segs);
      traces.push({ type: 'mesh3d', ...spread(disk), opacity: 1.0, color: COLOR_COPPER, name: 'Center Disk' });
    } else if (gtype === 'double_split_rings') {
      const r1o = parseFloat(fixed.ring1_outer_r_mm ?? 4.5);
      const r1i = parseFloat(fixed.ring1_inner_r_mm ?? 4.0);
      const r2o = parseFloat(fixed.ring2_outer_r_mm ?? 3.5);
      const r2i = parseFloat(fixed.ring2_inner_r_mm ?? 3.0);
      const gw = parseFloat(fixed.gap_width_deg ?? 16.0);
      let gc: number[] = fixed.gap_centers_deg ?? [90.0, 270.0];
      if (!Array.isArray(gc)) gc = [parseFloat(gc as any)];
      const m1 = splitRingMesh(r1o, r1i, zS1, zP1, [gc[0]], gw);
      traces.push({ type: 'mesh3d', ...spread(m1), opacity: 1.0, color: COLOR_COPPER, name: 'Outer Ring' });
      const m2 = splitRingMesh(r2o, r2i, zS1, zP1, [gc[gc.length - 1]], gw);
      traces.push({ type: 'mesh3d', ...spread(m2), opacity: 1.0, color: COLOR_COPPER, name: 'Inner Ring' });
    } else {
      // Default: square patch
      const wm = pValueMm > 0 ? pValueMm : unitCell * 0.5;
      const ph = wm / 2.0;
      addBox(patch, -ph, ph, -ph, ph, zS1, zP1);
    }

    // Add accumulated patch if any
    if (patch.x.length > 0) {
      traces.push({ type: 'mesh3d', ...spread(patch), opacity: 1.0, color: COLOR_COPPER, name: 'Patch' });
    }

    // Corner guides
    for (const xv of [-half, half]) {
      for (const yv of [-half, half]) {
        traces.push({
          type: 'scatter3d',
          x: [xv, xv], y: [yv, yv], z: [0, zP1 + 1],
          mode: 'lines',
          line: { color: 'rgba(100,100,100,0.3)', width: 1, dash: 'dot' },
          showlegend: false,
        });
      }
    }

    // Port
    const portX = half * 0.78, portY = half * 0.78;
    const portZ0 = zP1 + 0.8;
    const portZ1 = portZ0 + Math.max(2.0, subTh * 0.55);
    traces.push({
      type: 'scatter3d',
      x: [portX, portX], y: [portY, portY], z: [portZ0, portZ1],
      mode: 'lines+markers',
      line: { color: COLOR_PORT, width: 8 },
      marker: { size: 4, color: COLOR_PORT },
      name: 'Port',
    });

    // Apply high-quality realistic lighting to meshes
    traces.forEach(t => {
      if (t.type === 'mesh3d') {
        if (t.color === COLOR_COPPER || t.color === COLOR_GROUND) {
          t.lighting = { ambient: 0.3, diffuse: 0.8, roughness: 0.1, specular: 1.5, fresnel: 0.5 };
          t.lightposition = { x: 100, y: 100, z: 200 };
        } else if (t.color === COLOR_SUBSTRATE) {
          t.lighting = { ambient: 0.5, diffuse: 0.4, roughness: 0.5, specular: 0.1, fresnel: 0.1 };
          t.lightposition = { x: 100, y: 100, z: 200 };
        }
      }
    });

    return traces;
  }, [shapeSpec, pValueMm]);

  return (
    <Plot
      data={plotData}
      layout={{
        height,
        margin: { l: 0, r: 0, t: 0, b: 0 },
        scene: {
          xaxis: { visible: false },
          yaxis: { visible: false },
          zaxis: { visible: false },
          aspectmode: 'data',
          bgcolor: 'transparent',
          camera: { eye: { x: 1.5, y: 1.5, z: 1.2 }, center: { x: 0, y: 0, z: -0.1 } },
        },
        legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'left', x: 0, font: { size: 10 } },
        paper_bgcolor: 'transparent',
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%' }}
    />
  );
};

function spread(m: MeshData) {
  return { x: m.x, y: m.y, z: m.z, i: m.i, j: m.j, k: m.k };
}

export default Absorber3D;

import React, { useState, useCallback } from 'react';
import { LoadedShape } from '@/hooks/useShapeData';
import { absorptionFromS11, calcBandwidth, nearestPKey, rawBestAtFreq } from '@/utils/math';
import {
  Download,
  FileJson,
  FileText,
  FileSpreadsheet,
  Code2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Cpu,
  Package,
  Zap,
  Info,
  Settings2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportTabProps {
  shapes: LoadedShape[];
  pickAllInFreq: (f: number, thr: number) => any[];
}

type ExportFormat = 'json' | 'csv' | 'markdown' | 'cst';
type DownloadState = 'idle' | 'building' | 'done' | 'error';

interface FormatCard {
  id: ExportFormat;
  icon: React.ReactNode;
  label: string;
  description: string;
  ext: string;
  mime: string;
  color: string;
  accent: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Extracts the FULL geometry spec from a shape:
 * - all fixed dimensions (unit cell, ring radii, triangle vertices, gaps, etc.)
 * - material layers (patch, substrate, ground)
 * - sweep parameter range and all P values
 * - best-at-freq performance metrics
 */
function buildFullShapeSpec(shape: LoadedShape, freqGhz: number, thrDb: number) {
  const pKeys = Object.keys(shape.curves).map(Number).sort((a, b) => a - b);
  const bestResult = rawBestAtFreq(shape.curves, freqGhz, thrDb);

  // Collect all P-value curves summary
  const curvesSummary = pKeys.map((p) => {
    const curve = shape.curves[p];
    const s11AtFreq = curve.freqs.length > 0 ? (() => {
      const idx = curve.freqs.reduce((best, f, i) =>
        Math.abs(f - freqGhz) < Math.abs(curve.freqs[best] - freqGhz) ? i : best, 0);
      return curve.s11[idx] ?? null;
    })() : null;
    const { bw, fLo, fHi } = calcBandwidth(curve.freqs, curve.s11, thrDb);
    return {
      paramValue_mm: p,
      freqRange_GHz: { min: Math.min(...curve.freqs), max: Math.max(...curve.freqs) },
      s11AtTargetFreq_dB: s11AtFreq !== null ? Number(s11AtFreq.toFixed(4)) : null,
      bandwidth_GHz: bw > 0 ? Number(bw.toFixed(4)) : 0,
      bandpassLo_GHz: isFinite(fLo) ? Number(fLo.toFixed(4)) : null,
      bandpassHi_GHz: isFinite(fHi) ? Number(fHi.toFixed(4)) : null,
      absorption_pct: s11AtFreq !== null
        ? Number(((absorptionFromS11(s11AtFreq) as number) * 100).toFixed(2))
        : null,
    };
  });

  // Best performance
  let bestPerf = null;
  if (bestResult) {
    const absorption = (absorptionFromS11(bestResult.s11_db) as number) * 100;
    const nearestPk = nearestPKey(shape.curves, bestResult.p);
    let bwData = { bw: 0, fLo: NaN, fHi: NaN };
    if (nearestPk !== null && shape.curves[nearestPk]) {
      bwData = calcBandwidth(shape.curves[nearestPk].freqs, shape.curves[nearestPk].s11, thrDb);
    }
    bestPerf = {
      bestParam_mm: bestResult.p,
      s11_dB: Number(bestResult.s11_db.toFixed(4)),
      absorption_pct: Number(absorption.toFixed(2)),
      passesThreshold: bestResult.pass,
      bandwidth_GHz: bwData.bw > 0 ? Number(bwData.bw.toFixed(4)) : 0,
      bandpassLo_GHz: isFinite(bwData.fLo) ? Number(bwData.fLo.toFixed(4)) : null,
      bandpassHi_GHz: isFinite(bwData.fHi) ? Number(bwData.fHi.toFixed(4)) : null,
    };
  }

  return {
    meta: {
      name: shape.name,
      displayName: shape.displayName,
      source: shape.isReal ? 'CST Simulation' : 'Literature (Synthetic)',
      rawDataFile: shape.rawFile ?? 'N/A',
    },
    geometry: {
      geometryType: shape.geometryType,
      sweepParameter: shape.paramLabel,
      sweepMode: shape.paramMode,
      isFixedGeometry: shape.fixedCurve,
      fixedParamValue_mm: shape.fixedPValue ?? null,
      frequencyRange_GHz: { min: shape.ranges.fmin, max: shape.ranges.fmax },
      paramSweepRange_mm: { min: shape.ranges.pmin, max: shape.ranges.pmax },
      numSweepPoints: pKeys.length,
    },
    dimensions: {
      // Unit cell & global
      unitCell_mm: shape.fixed?.unit_cell_mm ?? null,
      substrateThickness_mm: shape.fixed?.substrate_thick_mm ?? shape.fixed?.substrate_visual_mm ?? null,
      substrateMaterial: shape.fixed?.substrate_material ?? null,
      // Patch layer
      patchThickness_mm: shape.fixed?.patch_thick_mm ?? null,
      patchMaterial: shape.fixed?.patch_material ?? null,
      // Ground layer
      groundThickness_mm: shape.fixed?.ground_thick_mm ?? null,
      groundMaterial: shape.fixed?.ground_material ?? null,
      // Ring geometry
      ringOuterRadius_mm: shape.fixed?.ring_outer_r_mm ?? null,
      ringInnerRadius_mm: shape.fixed?.ring_inner_r_mm ?? null,
      // Double ring
      ring1OuterRadius_mm: shape.fixed?.ring1_outer_r_mm ?? null,
      ring1InnerRadius_mm: shape.fixed?.ring1_inner_r_mm ?? null,
      ring2OuterRadius_mm: shape.fixed?.ring2_outer_r_mm ?? null,
      ring2InnerRadius_mm: shape.fixed?.ring2_inner_r_mm ?? null,
      // Center disk
      centerRadius_mm: shape.fixed?.center_r_mm ?? null,
      // Gaps / splits
      gapCenters_deg: shape.fixed?.gap_centers_deg ?? null,
      gapWidth_deg: shape.fixed?.gap_width_deg ?? null,
      segments: shape.fixed?.segments ?? null,
      // Rectangle
      rectYFactor: shape.fixed?.rect_y_factor ?? null,
      // Triangle
      triangleVertices_mm: shape.fixed?.triangle_vertices_mm ?? null,
      // Cross/Plus
      spanFactor: shape.fixed?.span_factor ?? null,
      armWidthFactor: shape.fixed?.arm_width_factor ?? null,
      // Spiral
      traceWidth_mm: shape.fixed?.trace_w_mm ?? null,
      spiralGap_mm: shape.fixed?.gap_mm ?? null,
      spiralTurns: shape.fixed?.turns ?? null,
      outerFactor: shape.fixed?.outer_factor ?? null,
      // Ring count (nested rings)
      ringCount: shape.fixed?.ring_count ?? null,
      ringWidth_mm: shape.fixed?.ring_w_mm ?? null,
      ringGap_mm: shape.fixed?.ring_gap_mm ?? null,
      // Arrow+circle (composite)
      centerOuterRadius_mm: shape.fixed?.center_outer_r_mm ?? null,
      centerInnerRadius_mm: shape.fixed?.center_inner_r_mm ?? null,
    },
    layers: [
      { layer: 'Ground', material: shape.fixed?.ground_material ?? 'N/A', thickness_mm: shape.fixed?.ground_thick_mm ?? null, position: 'Bottom' },
      { layer: 'Substrate', material: shape.fixed?.substrate_material ?? 'N/A', thickness_mm: shape.fixed?.substrate_thick_mm ?? shape.fixed?.substrate_visual_mm ?? null, position: 'Middle' },
      { layer: 'Patch', material: shape.fixed?.patch_material ?? 'N/A', thickness_mm: shape.fixed?.patch_thick_mm ?? null, position: 'Top' },
    ],
    performance: {
      targetFreq_GHz: freqGhz,
      threshold_dB: thrDb,
      best: bestPerf,
    },
    curves: curvesSummary,
  };
}

// ─── CST Macro Generator ──────────────────────────────────────────────────────

function buildCSTMacro(shapes: LoadedShape[], freqGhz: number, thrDb: number): string {
  const ts = new Date().toISOString();
  const lines: string[] = [
    `' ============================================================`,
    `' CST Macro Script — Auto-Generated by MMA AI Platform`,
    `' Date: ${ts}`,
    `' Target Frequency: ${freqGhz} GHz  |  S11 Threshold: ${thrDb} dB`,
    `' Total Shapes Exported: ${shapes.length}`,
    `' ============================================================`,
    ``,
    `Option Explicit`,
    ``,
    `Sub Main()`,
    `    ' -- Configure Solver --`,
    `    With Solver`,
    `        .FrequencyRange "1", "50"`,
    `        .MaximumNumberOfKeys "1000"`,
    `    End With`,
    ``,
  ];

  shapes.forEach((shape, idx) => {
    const spec = buildFullShapeSpec(shape, freqGhz, thrDb);
    const best = spec.performance.best;
    const dim = spec.dimensions;

    lines.push(`    ' ── Shape ${idx + 1}: ${shape.displayName} ──`);
    lines.push(`    ' Geometry: ${shape.geometryType}`);
    lines.push(`    ' Source: ${spec.meta.source}`);
    if (best) {
      lines.push(`    ' Best ${shape.paramLabel} = ${best.bestParam_mm} mm  →  S11=${best.s11_dB} dB  Absorption=${best.absorption_pct}%`);
    }
    lines.push(`    ' Unit Cell: ${dim.unitCell_mm ?? 'N/A'} mm`);
    lines.push(`    ' Substrate: ${dim.substrateMaterial ?? 'N/A'}, h=${dim.substrateThickness_mm ?? 'N/A'} mm`);
    lines.push(`    ' Patch: ${dim.patchMaterial ?? 'N/A'}, t=${dim.patchThickness_mm ?? 'N/A'} mm`);
    lines.push(`    ' Ground: ${dim.groundMaterial ?? 'N/A'}, t=${dim.groundThickness_mm ?? 'N/A'} mm`);

    // Geometry-specific parameters
    if (dim.ringOuterRadius_mm !== null)
      lines.push(`    ' Ring: Ro=${dim.ringOuterRadius_mm} mm, Ri=${dim.ringInnerRadius_mm ?? 'N/A'} mm`);
    if (dim.ring1OuterRadius_mm !== null)
      lines.push(`    ' Ring1: Ro=${dim.ring1OuterRadius_mm} mm, Ri=${dim.ring1InnerRadius_mm ?? 'N/A'} mm`);
    if (dim.ring2OuterRadius_mm !== null)
      lines.push(`    ' Ring2: Ro=${dim.ring2OuterRadius_mm} mm, Ri=${dim.ring2InnerRadius_mm ?? 'N/A'} mm`);
    if (dim.gapCenters_deg !== null)
      lines.push(`    ' Gaps: centers=${JSON.stringify(dim.gapCenters_deg)} deg, width=${dim.gapWidth_deg ?? 'N/A'} deg`);
    if (dim.triangleVertices_mm !== null)
      lines.push(`    ' Triangle vertices (mm): ${JSON.stringify(dim.triangleVertices_mm)}`);
    if (dim.spanFactor !== null)
      lines.push(`    ' Cross span factor: ${dim.spanFactor}, arm width factor: ${dim.armWidthFactor ?? 'N/A'}`);
    if (dim.spiralTurns !== null)
      lines.push(`    ' Spiral: turns=${dim.spiralTurns}, trace w=${dim.traceWidth_mm ?? 'N/A'} mm, gap=${dim.spiralGap_mm ?? 'N/A'} mm`);

    // CST simulation block (generic structure template)
    const uc = dim.unitCell_mm ?? 16;
    const sub_h = dim.substrateThickness_mm ?? 1.6;
    const patch_t = dim.patchThickness_mm ?? 0.035;
    const gnd_t = dim.groundThickness_mm ?? 0.035;
    const bestP = best?.bestParam_mm ?? shape.ranges.pmin;

    lines.push(`    `);
    lines.push(`    ' -- Unit Cell & Boundary (Shape ${idx + 1}) --`);
    lines.push(`    With Boundary`);
    lines.push(`        .Xmin "unit cell"  .Xmax "unit cell"`);
    lines.push(`        .Ymin "unit cell"  .Ymax "unit cell"`);
    lines.push(`        .Zmin "expanded open"  .Zmax "expanded open"`);
    lines.push(`    End With`);
    lines.push(`    `);
    lines.push(`    ' -- Material: ${dim.substrateMaterial ?? 'Substrate'} --`);
    lines.push(`    With Material`);
    lines.push(`        .Name "${dim.substrateMaterial ?? 'Substrate'}"`);
    lines.push(`        .Epsilon "4.4" .TanD "0.02"`);
    lines.push(`        .Create`);
    lines.push(`    End With`);
    lines.push(`    `);
    lines.push(`    ' -- Ground Plane (t=${gnd_t} mm) --`);
    lines.push(`    With Brick`);
    lines.push(`        .Name "Ground" .Component "Layers" .Material "PEC"`);
    lines.push(`        .Xrange "-${uc / 2}", "${uc / 2}"`);
    lines.push(`        .Yrange "-${uc / 2}", "${uc / 2}"`);
    lines.push(`        .Zrange "${-(sub_h + gnd_t)}", "${-sub_h}"`);
    lines.push(`        .Create`);
    lines.push(`    End With`);
    lines.push(`    `);
    lines.push(`    ' -- Substrate (h=${sub_h} mm) --`);
    lines.push(`    With Brick`);
    lines.push(`        .Name "Substrate" .Component "Layers" .Material "${dim.substrateMaterial ?? 'Substrate'}"`);
    lines.push(`        .Xrange "-${uc / 2}", "${uc / 2}"`);
    lines.push(`        .Yrange "-${uc / 2}", "${uc / 2}"`);
    lines.push(`        .Zrange "0", "${sub_h}"`);
    lines.push(`        .Create`);
    lines.push(`    End With`);
    lines.push(`    `);
    lines.push(`    ' -- Patch: ${shape.geometryType}, ${shape.paramLabel}=${bestP} mm --`);

    if (shape.geometryType === 'square_patch') {
      lines.push(`    With Brick`);
      lines.push(`        .Name "Patch" .Component "Layers" .Material "PEC"`);
      lines.push(`        .Xrange "-${(bestP / 2).toFixed(4)}", "${(bestP / 2).toFixed(4)}"`);
      lines.push(`        .Yrange "-${(bestP / 2).toFixed(4)}", "${(bestP / 2).toFixed(4)}"`);
      lines.push(`        .Zrange "${sub_h}", "${sub_h + patch_t}"`);
      lines.push(`        .Create`);
      lines.push(`    End With`);
    } else if (shape.geometryType === 'rect_patch') {
      const yFactor = dim.rectYFactor ?? 0.5;
      lines.push(`    With Brick`);
      lines.push(`        .Name "Patch" .Component "Layers" .Material "PEC"`);
      lines.push(`        .Xrange "-${(bestP / 2).toFixed(4)}", "${(bestP / 2).toFixed(4)}"`);
      lines.push(`        .Yrange "-${((bestP * yFactor) / 2).toFixed(4)}", "${((bestP * yFactor) / 2).toFixed(4)}"`);
      lines.push(`        .Zrange "${sub_h}", "${sub_h + patch_t}"`);
      lines.push(`        .Create`);
      lines.push(`    End With`);
    } else if (shape.geometryType === 'ring_patch_fixed_geom') {
      const ro = dim.ringOuterRadius_mm ?? uc * 0.44;
      const ri = dim.ringInnerRadius_mm ?? uc * 0.32;
      lines.push(`    With Cylinder`);
      lines.push(`        .Name "RingOuter" .Component "Layers" .Material "PEC"`);
      lines.push(`        .Outerradius "${ro}" .Innerradius "${ri}"`);
      lines.push(`        .Xcenter "0" .Ycenter "0"`);
      lines.push(`        .Zrange "${sub_h}", "${sub_h + patch_t}"`);
      lines.push(`        .Create`);
      lines.push(`    End With`);
    } else if (shape.geometryType === 'double_split_rings') {
      [
        [dim.ring1OuterRadius_mm, dim.ring1InnerRadius_mm, 'Ring1'],
        [dim.ring2OuterRadius_mm, dim.ring2InnerRadius_mm, 'Ring2'],
      ].forEach(([ro, ri, name]) => {
        if (ro !== null) {
          lines.push(`    With Cylinder`);
          lines.push(`        .Name "${name}" .Component "Layers" .Material "PEC"`);
          lines.push(`        .Outerradius "${ro}" .Innerradius "${ri ?? 0}"`);
          lines.push(`        .Xcenter "0" .Ycenter "0"`);
          lines.push(`        .Zrange "${sub_h}", "${sub_h + patch_t}"`);
          lines.push(`        .Create`);
          lines.push(`    End With`);
        }
      });
    } else {
      lines.push(`    ' Generic patch placeholder for: ${shape.geometryType}`);
      lines.push(`    ' See documentation for geometry-specific commands.`);
    }

    lines.push(`    `);
    lines.push(`    ' -- S11 Output Probe (Shape ${idx + 1}) --`);
    lines.push(`    With Port`);
    lines.push(`        .Type "Zmin" .Label "Port1"`);
    lines.push(`    End With`);
    lines.push(`    `);
    lines.push(`    Dim oMonitor As Object`);
    lines.push(`    Set oMonitor = CreateObject("CST.Monitor")`);
    lines.push(`    oMonitor.Name = "S11_${shape.name}"`);
    lines.push(`    oMonitor.Frequency = ${freqGhz}`);
    lines.push(`    `);
  });

  lines.push(`    MsgBox "MMA AI Platform: Macro executed successfully for ${shapes.length} shape(s).", vbInformation`);
  lines.push(`End Sub`);

  return lines.join('\n');
}

// ─── JSON Builder ─────────────────────────────────────────────────────────────

function buildJSON(shapes: LoadedShape[], freqGhz: number, thrDb: number): string {
  const export_payload = {
    exportMeta: {
      generator: 'Metamaterial Absorber AI Platform v5',
      exportedAt: new Date().toISOString(),
      targetFreq_GHz: freqGhz,
      threshold_dB: thrDb,
      totalShapes: shapes.length,
    },
    shapes: shapes.map((s) => buildFullShapeSpec(s, freqGhz, thrDb)),
  };
  return JSON.stringify(export_payload, null, 2);
}

// ─── CSV Builder ──────────────────────────────────────────────────────────────

function buildCSV(shapes: LoadedShape[], freqGhz: number, thrDb: number): string {
  const headers = [
    'Name', 'DisplayName', 'GeometryType', 'Source', 'SweepParam', 'SweepMode',
    'FreqMin_GHz', 'FreqMax_GHz', 'ParamMin_mm', 'ParamMax_mm',
    'UnitCell_mm', 'SubstrateH_mm', 'SubstrateMaterial',
    'PatchThk_mm', 'PatchMaterial', 'GroundThk_mm', 'GroundMaterial',
    'RingOuter_mm', 'RingInner_mm',
    'Ring1Outer_mm', 'Ring1Inner_mm', 'Ring2Outer_mm', 'Ring2Inner_mm',
    'GapCenters_deg', 'GapWidth_deg', 'Segments',
    'RectYFactor', 'TriangleVertices', 'SpanFactor', 'ArmWidthFactor',
    'SpiralTurns', 'TraceW_mm', 'SpiralGap_mm',
    'BestParam_mm', 'BestS11_dB', 'Absorption_pct', 'Bandwidth_GHz',
    'BandpassLo_GHz', 'BandpassHi_GHz', 'PassesThreshold',
  ];

  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? JSON.stringify(v) : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = shapes.map((shape) => {
    const spec = buildFullShapeSpec(shape, freqGhz, thrDb);
    const d = spec.dimensions;
    const g = spec.geometry;
    const b = spec.performance.best;
    return [
      escape(spec.meta.name),
      escape(spec.meta.displayName),
      escape(spec.geometry.geometryType),
      escape(spec.meta.source),
      escape(g.sweepParameter),
      escape(g.sweepMode),
      escape(g.frequencyRange_GHz.min),
      escape(g.frequencyRange_GHz.max),
      escape(g.paramSweepRange_mm.min),
      escape(g.paramSweepRange_mm.max),
      escape(d.unitCell_mm),
      escape(d.substrateThickness_mm),
      escape(d.substrateMaterial),
      escape(d.patchThickness_mm),
      escape(d.patchMaterial),
      escape(d.groundThickness_mm),
      escape(d.groundMaterial),
      escape(d.ringOuterRadius_mm),
      escape(d.ringInnerRadius_mm),
      escape(d.ring1OuterRadius_mm),
      escape(d.ring1InnerRadius_mm),
      escape(d.ring2OuterRadius_mm),
      escape(d.ring2InnerRadius_mm),
      escape(d.gapCenters_deg),
      escape(d.gapWidth_deg),
      escape(d.segments),
      escape(d.rectYFactor),
      escape(d.triangleVertices_mm),
      escape(d.spanFactor),
      escape(d.armWidthFactor),
      escape(d.spiralTurns),
      escape(d.traceWidth_mm),
      escape(d.spiralGap_mm),
      escape(b?.bestParam_mm ?? ''),
      escape(b?.s11_dB ?? ''),
      escape(b?.absorption_pct ?? ''),
      escape(b?.bandwidth_GHz ?? ''),
      escape(b?.bandpassLo_GHz ?? ''),
      escape(b?.bandpassHi_GHz ?? ''),
      escape(b?.passesThreshold ?? ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// ─── Markdown Builder ─────────────────────────────────────────────────────────

function buildMarkdown(shapes: LoadedShape[], freqGhz: number, thrDb: number, title: string): string {
  const ts = new Date().toLocaleString();
  const lines: string[] = [
    `# ${title}`,
    ``,
    `> **Generated by:** Metamaterial Absorber AI Platform v5  `,
    `> **Date:** ${ts}  `,
    `> **Target Frequency:** ${freqGhz} GHz &nbsp;|&nbsp; **S11 Threshold:** ${thrDb} dB  `,
    `> **Total Shapes:** ${shapes.length}`,
    ``,
    `---`,
    ``,
    `## 1. Executive Summary`,
    ``,
    `| # | Shape | Type | Source | Best Param (mm) | S11 (dB) | Absorption | BW (GHz) | Status |`,
    `|---|-------|------|--------|-----------------|----------|------------|----------|--------|`,
  ];

  const medals = ['🥇', '🥈', '🥉'];

  shapes.forEach((shape, idx) => {
    const spec = buildFullShapeSpec(shape, freqGhz, thrDb);
    const b = spec.performance.best;
    const medal = idx < 3 ? medals[idx] : `#${idx + 1}`;
    const status = b ? (b.passesThreshold ? '✅ PASS' : '⚠️ FAIL') : '—';
    lines.push(
      `| ${medal} | ${shape.displayName.slice(0, 45)} | ${shape.geometryType} | ${spec.meta.source} | ${b ? b.bestParam_mm : '—'} | ${b ? b.s11_dB : '—'} | ${b ? `${b.absorption_pct}%` : '—'} | ${b ? b.bandwidth_GHz : '—'} | ${status} |`
    );
  });

  lines.push(``, `---`, ``, `## 2. Detailed Shape Specifications`);

  shapes.forEach((shape, idx) => {
    const spec = buildFullShapeSpec(shape, freqGhz, thrDb);
    const d = spec.dimensions;
    const b = spec.performance.best;

    lines.push(``, `### ${idx + 1}. ${shape.displayName}`, ``);
    lines.push(`**Geometry Type:** \`${shape.geometryType}\` &nbsp;|&nbsp; **Source:** ${spec.meta.source}  `);
    if (spec.meta.rawDataFile !== 'N/A')
      lines.push(`**Data File:** \`${spec.meta.rawDataFile}\`  `);
    lines.push(`**Sweep Parameter:** ${shape.paramLabel} &nbsp;|&nbsp; **Range:** ${spec.geometry.paramSweepRange_mm.min}–${spec.geometry.paramSweepRange_mm.max} mm (${spec.geometry.numSweepPoints} points)  `);
    lines.push(`**Frequency Range:** ${spec.geometry.frequencyRange_GHz.min.toFixed(2)}–${spec.geometry.frequencyRange_GHz.max.toFixed(2)} GHz`, ``);

    lines.push(`#### Layer Stack`);
    lines.push(`| Layer | Material | Thickness (mm) | Position |`);
    lines.push(`|-------|----------|----------------|----------|`);
    spec.layers.forEach((l) => {
      lines.push(`| ${l.layer} | ${l.material} | ${l.thickness_mm ?? 'N/A'} | ${l.position} |`);
    });

    lines.push(``, `#### Geometric Dimensions`);
    lines.push(`| Parameter | Value |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Unit Cell (P) | ${d.unitCell_mm ?? 'N/A'} mm |`);
    if (d.ringOuterRadius_mm !== null) lines.push(`| Ring Outer Radius | ${d.ringOuterRadius_mm} mm |`);
    if (d.ringInnerRadius_mm !== null) lines.push(`| Ring Inner Radius | ${d.ringInnerRadius_mm} mm |`);
    if (d.ring1OuterRadius_mm !== null) lines.push(`| Ring 1 Outer Radius | ${d.ring1OuterRadius_mm} mm |`);
    if (d.ring1InnerRadius_mm !== null) lines.push(`| Ring 1 Inner Radius | ${d.ring1InnerRadius_mm} mm |`);
    if (d.ring2OuterRadius_mm !== null) lines.push(`| Ring 2 Outer Radius | ${d.ring2OuterRadius_mm} mm |`);
    if (d.ring2InnerRadius_mm !== null) lines.push(`| Ring 2 Inner Radius | ${d.ring2InnerRadius_mm} mm |`);
    if (d.centerRadius_mm !== null) lines.push(`| Center Disk Radius | ${d.centerRadius_mm} mm |`);
    if (d.gapCenters_deg !== null) lines.push(`| Gap Centers | ${JSON.stringify(d.gapCenters_deg)} ° |`);
    if (d.gapWidth_deg !== null) lines.push(`| Gap Width | ${d.gapWidth_deg} ° |`);
    if (d.segments !== null) lines.push(`| Polygon Segments | ${d.segments} |`);
    if (d.rectYFactor !== null) lines.push(`| Rectangle Y-Factor | ${d.rectYFactor} |`);
    if (d.triangleVertices_mm !== null) lines.push(`| Triangle Vertices | \`${JSON.stringify(d.triangleVertices_mm)}\` mm |`);
    if (d.spanFactor !== null) lines.push(`| Span Factor | ${d.spanFactor} |`);
    if (d.armWidthFactor !== null) lines.push(`| Arm Width Factor | ${d.armWidthFactor} |`);
    if (d.spiralTurns !== null) lines.push(`| Spiral Turns | ${d.spiralTurns} |`);
    if (d.traceWidth_mm !== null) lines.push(`| Trace Width | ${d.traceWidth_mm} mm |`);
    if (d.spiralGap_mm !== null) lines.push(`| Spiral Gap | ${d.spiralGap_mm} mm |`);
    if (d.ringCount !== null) lines.push(`| Ring Count | ${d.ringCount} |`);
    if (d.ringWidth_mm !== null) lines.push(`| Ring Width | ${d.ringWidth_mm} mm |`);
    if (d.ringGap_mm !== null) lines.push(`| Ring Gap | ${d.ringGap_mm} mm |`);
    if (d.outerFactor !== null) lines.push(`| Outer Factor | ${d.outerFactor} |`);

    if (b) {
      lines.push(``, `#### Performance @ ${freqGhz} GHz`);
      lines.push(`| Metric | Value |`);
      lines.push(`|--------|-------|`);
      lines.push(`| Best ${shape.paramLabel} | **${b.bestParam_mm} mm** |`);
      lines.push(`| S11 | **${b.s11_dB} dB** |`);
      lines.push(`| Absorption | **${b.absorption_pct}%** |`);
      lines.push(`| Bandwidth (-10dB) | ${b.bandwidth_GHz > 0 ? `${b.bandwidth_GHz} GHz (${b.bandpassLo_GHz}–${b.bandpassHi_GHz} GHz)` : '< threshold'} |`);
      lines.push(`| Threshold Status | ${b.passesThreshold ? '✅ PASS' : '⚠️ FAIL'} |`);
    }

    lines.push(``, `---`);
  });

  lines.push(``, `## 3. Notes`, ``, `- All dimensions in millimeters (mm) unless otherwise stated.`);
  lines.push(`- S11 values represent reflection coefficient in dB (lower = better absorption).`);
  lines.push(`- Absorption = 1 − 10^(S11/10); a value > 90% indicates near-perfect absorption.`);
  lines.push(`- CST simulation files may need to be re-run after geometric adjustments.`);
  lines.push(``, `*Report generated automatically — Metamaterial Absorber AI Platform v5*`);

  return lines.join('\n');
}

// ─── Format Cards Config ──────────────────────────────────────────────────────

const FORMAT_CARDS: FormatCard[] = [
  {
    id: 'json',
    icon: <FileJson className="w-6 h-6" />,
    label: 'Full JSON Export',
    description: 'Complete machine-readable data — all geometry, dimensions, materials, curves, and performance metrics.',
    ext: 'json',
    mime: 'application/json',
    color: 'from-blue-900/40 to-blue-800/20',
    accent: 'border-blue-500/50 hover:border-blue-400',
  },
  {
    id: 'csv',
    icon: <FileSpreadsheet className="w-6 h-6" />,
    label: 'Spreadsheet CSV',
    description: 'Tabular format with all geometric dimensions and performance data. Import directly into Excel or MATLAB.',
    ext: 'csv',
    mime: 'text/csv',
    color: 'from-emerald-900/40 to-emerald-800/20',
    accent: 'border-emerald-500/50 hover:border-emerald-400',
  },
  {
    id: 'markdown',
    icon: <FileText className="w-6 h-6" />,
    label: 'Thesis Report (.md)',
    description: 'Structured academic report with summary tables, layer stacks, geometric specs and performance analysis.',
    ext: 'md',
    mime: 'text/markdown',
    color: 'from-violet-900/40 to-violet-800/20',
    accent: 'border-violet-500/50 hover:border-violet-400',
  },
  {
    id: 'cst',
    icon: <Code2 className="w-6 h-6" />,
    label: 'CST Macro Script (.bas)',
    description: 'Ready-to-run CST Microwave Studio VBA macro. Builds unit cells, materials, and patches for each shape.',
    ext: 'bas',
    mime: 'text/plain',
    color: 'from-orange-900/40 to-orange-800/20',
    accent: 'border-orange-500/50 hover:border-orange-400',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const ExportTab: React.FC<ExportTabProps> = ({ shapes, pickAllInFreq }) => {
  const [freqGhz, setFreqGhz] = useState(10);
  const [thrDb, setThrDb] = useState(-10);
  const [reportTitle, setReportTitle] = useState('Metamaterial Absorber Performance Report');
  const [selectedShapes, setSelectedShapes] = useState<Set<string>>(new Set(shapes.map(s => s.name)));
  const [downloadStates, setDownloadStates] = useState<Record<ExportFormat, DownloadState>>({
    json: 'idle', csv: 'idle', markdown: 'idle', cst: 'idle',
  });
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState<ExportFormat | null>(null);
  const [showShapeSelector, setShowShapeSelector] = useState(false);
  const [validationLog, setValidationLog] = useState<{ ok: boolean; message: string }[]>([]);

  const activeShapes = shapes.filter(s => selectedShapes.has(s.name));

  const setDownloadState = (fmt: ExportFormat, state: DownloadState) => {
    setDownloadStates(prev => ({ ...prev, [fmt]: state }));
  };

  const validateAndBuild = useCallback((fmt: ExportFormat): string => {
    const logs: { ok: boolean; message: string }[] = [];

    if (activeShapes.length === 0) {
      logs.push({ ok: false, message: 'No shapes selected for export.' });
      setValidationLog(logs);
      throw new Error('No shapes selected.');
    }
    logs.push({ ok: true, message: `${activeShapes.length} shape(s) selected.` });

    // Validate each shape has curve data
    activeShapes.forEach(shape => {
      const pKeys = Object.keys(shape.curves);
      if (pKeys.length === 0) {
        logs.push({ ok: false, message: `⚠ ${shape.displayName}: No curve data found.` });
      } else {
        logs.push({ ok: true, message: `✓ ${shape.displayName}: ${pKeys.length} parameter points loaded.` });
      }
    });

    // Validate freq range
    const allInRange = activeShapes.every(s => freqGhz >= s.ranges.fmin - 1 && freqGhz <= s.ranges.fmax + 1);
    if (!allInRange) {
      logs.push({ ok: false, message: `⚠ Target frequency ${freqGhz} GHz may be outside some shapes' ranges.` });
    } else {
      logs.push({ ok: true, message: `✓ Target frequency ${freqGhz} GHz is within all selected shapes' ranges.` });
    }

    setValidationLog(logs);

    if (fmt === 'json') return buildJSON(activeShapes, freqGhz, thrDb);
    if (fmt === 'csv') return buildCSV(activeShapes, freqGhz, thrDb);
    if (fmt === 'markdown') return buildMarkdown(activeShapes, freqGhz, thrDb, reportTitle);
    if (fmt === 'cst') return buildCSTMacro(activeShapes, freqGhz, thrDb);
    throw new Error('Unknown format');
  }, [activeShapes, freqGhz, thrDb, reportTitle]);

  const handleDownload = useCallback(async (fmt: ExportFormat) => {
    setDownloadState(fmt, 'building');
    setValidationLog([]);
    try {
      await new Promise(r => setTimeout(r, 120)); // allow state flash
      const content = validateAndBuild(fmt);
      const card = FORMAT_CARDS.find(c => c.id === fmt)!;
      const ts = new Date().toISOString().slice(0, 10);
      const filename = `mma_export_${freqGhz}GHz_${ts}.${card.ext}`;
      triggerDownload(content, filename, card.mime);
      setDownloadState(fmt, 'done');
      setTimeout(() => setDownloadState(fmt, 'idle'), 3000);
    } catch (err: any) {
      setDownloadState(fmt, 'error');
      setTimeout(() => setDownloadState(fmt, 'idle'), 4000);
    }
  }, [validateAndBuild, freqGhz]);

  const handlePreview = useCallback((fmt: ExportFormat) => {
    try {
      const content = validateAndBuild(fmt);
      setPreviewText(content.slice(0, 4000) + (content.length > 4000 ? '\n\n... (truncated for preview)' : ''));
      setPreviewFormat(fmt);
    } catch {
      setPreviewText('Error generating preview.');
      setPreviewFormat(fmt);
    }
  }, [validateAndBuild]);

  const toggleShape = (name: string) => {
    setSelectedShapes(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelectedShapes(new Set(shapes.map(s => s.name)));
  const deselectAll = () => setSelectedShapes(new Set());

  const buttonContent = (fmt: ExportFormat) => {
    const state = downloadStates[fmt];
    if (state === 'building') return (
      <span className="flex items-center gap-2">
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Building…
      </span>
    );
    if (state === 'done') return (
      <span className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Downloaded!
      </span>
    );
    if (state === 'error') return (
      <span className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-400" /> Error
      </span>
    );
    return <span className="flex items-center gap-2"><Download className="w-4 h-4" /> Download</span>;
  };

  return (
    <div className="space-y-8 tab-content-enter" style={{ background: 'transparent' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, hsl(222 47% 9%) 0%, hsl(210 55% 18%) 60%, hsl(195 60% 12%) 100%)',
        borderRadius: '1rem',
        border: '1px solid hsl(217 33% 28%)',
        padding: '1.75rem 2rem',
        boxShadow: '0 8px 32px -8px hsla(0 0% 0% / 0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '220px', height: '220px', borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(217 91% 60% / 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="flex items-start gap-4">
          <div style={{
            background: 'hsl(217 91% 25%)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            border: '1px solid hsl(217 91% 40% / 0.4)',
          }}>
            <Package className="w-7 h-7" style={{ color: 'hsl(217 91% 70%)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(213 31% 95%)', margin: 0 }}>
              Export & Download
            </h2>
            <p style={{ color: 'hsl(215 16% 65%)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
              Export complete shape geometry, material layers, and performance data in multiple formats.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { label: `${activeShapes.length} shapes`, icon: <Layers className="w-3 h-3" /> },
                { label: `${freqGhz} GHz target`, icon: <Zap className="w-3 h-3" /> },
                { label: `${thrDb} dB threshold`, icon: <Cpu className="w-3 h-3" /> },
              ].map(({ label, icon }) => (
                <span key={label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.2rem 0.65rem', borderRadius: '20px',
                  background: 'hsl(217 33% 22%)', border: '1px solid hsl(217 33% 32%)',
                  fontSize: '0.75rem', color: 'hsl(213 31% 82%)', fontWeight: 600,
                }}>
                  {icon}{label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Config Panel ── */}
      <div style={{
        background: 'hsl(217 33% 14%)',
        borderRadius: '0.875rem',
        border: '1px solid hsl(217 33% 24%)',
        padding: '1.5rem',
      }}>
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-4 h-4" style={{ color: 'hsl(217 91% 60%)' }} />
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'hsl(213 31% 91%)', margin: 0 }}>
            Export Configuration
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Target Frequency (GHz)', value: freqGhz, setter: setFreqGhz, min: 1, max: 50, step: 0.5 },
            { label: 'S11 Threshold (dB)', value: thrDb, setter: setThrDb, min: -40, max: -3, step: 1 },
          ].map(({ label, value, setter, min, max, step }) => (
            <div key={label}>
              <label style={{ fontSize: '0.78rem', color: 'hsl(215 16% 62%)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                {label}
              </label>
              <input
                type="number"
                value={value}
                min={min} max={max} step={step}
                onChange={e => setter(Number(e.target.value))}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'hsl(217 33% 19%)',
                  border: '1px solid hsl(217 33% 30%)',
                  color: 'hsl(213 31% 91%)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          ))}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ fontSize: '0.78rem', color: 'hsl(215 16% 62%)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
              Report Title
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'hsl(217 33% 19%)',
                border: '1px solid hsl(217 33% 30%)',
                color: 'hsl(213 31% 91%)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Shape selector */}
        <button
          onClick={() => setShowShapeSelector(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'hsl(217 33% 19%)',
            border: '1px solid hsl(217 33% 30%)',
            borderRadius: '0.5rem', padding: '0.5rem 0.9rem',
            color: 'hsl(213 31% 82%)', fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.2s',
          }}
        >
          <Layers className="w-4 h-4" />
          {showShapeSelector ? 'Hide' : 'Select'} Shapes ({activeShapes.length}/{shapes.length})
          {showShapeSelector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showShapeSelector && (
          <div style={{
            marginTop: '0.75rem',
            background: 'hsl(217 33% 11%)',
            borderRadius: '0.625rem',
            border: '1px solid hsl(217 33% 22%)',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[['Select All', selectAll], ['Deselect All', deselectAll]].map(([label, fn]) => (
                <button
                  key={label}
                  onClick={fn as () => void}
                  style={{
                    padding: '0.25rem 0.7rem', borderRadius: '0.375rem',
                    border: '1px solid hsl(217 33% 30%)',
                    background: 'hsl(217 33% 20%)',
                    color: 'hsl(213 31% 82%)', fontSize: '0.75rem', cursor: 'pointer',
                  }}
                >{label}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
              {shapes.map(shape => (
                <label
                  key={shape.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.45rem 0.7rem', borderRadius: '0.375rem',
                    border: `1px solid ${selectedShapes.has(shape.name) ? 'hsl(217 91% 40%)' : 'hsl(217 33% 25%)'}`,
                    background: selectedShapes.has(shape.name) ? 'hsl(217 91% 18%)' : 'hsl(217 33% 16%)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontSize: '0.78rem', color: 'hsl(213 31% 88%)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedShapes.has(shape.name)}
                    onChange={() => toggleShape(shape.name)}
                    style={{ accentColor: 'hsl(217 91% 60%)' }}
                  />
                  <span style={{ flex: 1 }}>{shape.displayName.slice(0, 55)}</span>
                  <span style={{
                    fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                    background: shape.isReal ? 'hsl(160 84% 20%)' : 'hsl(38 60% 20%)',
                    color: shape.isReal ? 'hsl(152 81% 75%)' : 'hsl(38 80% 75%)',
                    whiteSpace: 'nowrap',
                  }}>
                    {shape.isReal ? 'CST' : 'Lit.'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Format Cards ── */}
      <div>
        <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'hsl(213 31% 91%)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download className="w-4 h-4" style={{ color: 'hsl(217 91% 60%)' }} />
          Choose Export Format
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {FORMAT_CARDS.map(card => {
            const state = downloadStates[card.id];
            const isBuilding = state === 'building';
            const isDone = state === 'done';
            const isError = state === 'error';

            return (
              <div
                key={card.id}
                style={{
                  background: `linear-gradient(145deg, hsl(217 33% 15%), hsl(217 33% 12%))`,
                  borderRadius: '0.875rem',
                  border: `1px solid ${isDone ? 'hsl(160 84% 35%)' : isError ? 'hsl(0 84% 40%)' : 'hsl(217 33% 26%)'}`,
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: isDone ? '0 0 20px -4px hsla(160 84% 39% / 0.25)' : '0 2px 12px -4px hsla(0 0% 0% / 0.4)',
                }}
              >
                {/* Icon + Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    padding: '0.6rem',
                    borderRadius: '0.625rem',
                    background: card.id === 'json' ? 'hsl(217 91% 22%)' :
                      card.id === 'csv' ? 'hsl(160 84% 18%)' :
                        card.id === 'markdown' ? 'hsl(263 70% 22%)' : 'hsl(28 73% 20%)',
                    border: card.id === 'json' ? '1px solid hsl(217 91% 35%)' :
                      card.id === 'csv' ? '1px solid hsl(160 84% 30%)' :
                        card.id === 'markdown' ? '1px solid hsl(263 70% 35%)' : '1px solid hsl(28 73% 33%)',
                    color: card.id === 'json' ? 'hsl(217 91% 72%)' :
                      card.id === 'csv' ? 'hsl(152 81% 70%)' :
                        card.id === 'markdown' ? 'hsl(263 70% 78%)' : 'hsl(38 80% 72%)',
                  }}>
                    {card.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'hsl(213 31% 93%)' }}>{card.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'hsl(215 16% 55%)', marginTop: '0.1rem' }}>
                      .{card.ext}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.8rem', color: 'hsl(215 16% 65%)', lineHeight: 1.5, margin: 0 }}>
                  {card.description}
                </p>

                {/* Includes indicator */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {card.id === 'json' && ['Geometry', 'Dimensions', 'Layers', 'All Curves', 'Performance'].map(tag => (
                    <span key={tag} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '3px', background: 'hsl(217 33% 22%)', color: 'hsl(215 16% 72%)' }}>{tag}</span>
                  ))}
                  {card.id === 'csv' && ['Tabular', 'Excel-Ready', 'All Params', 'MATLAB Import'].map(tag => (
                    <span key={tag} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '3px', background: 'hsl(160 60% 15%)', color: 'hsl(152 70% 70%)' }}>{tag}</span>
                  ))}
                  {card.id === 'markdown' && ['Thesis-Ready', 'Layer Stack', 'Summary Table', 'Full Specs'].map(tag => (
                    <span key={tag} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '3px', background: 'hsl(263 50% 18%)', color: 'hsl(263 70% 78%)' }}>{tag}</span>
                  ))}
                  {card.id === 'cst' && ['VBA Macro', 'Unit Cells', 'Materials', 'Patch Build'].map(tag => (
                    <span key={tag} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '3px', background: 'hsl(28 50% 18%)', color: 'hsl(38 80% 72%)' }}>{tag}</span>
                  ))}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
                  <button
                    onClick={() => handleDownload(card.id)}
                    disabled={isBuilding || activeShapes.length === 0}
                    style={{
                      flex: 1, padding: '0.55rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: isDone ? 'hsl(160 84% 25%)' :
                        isError ? 'hsl(0 84% 28%)' :
                          isBuilding ? 'hsl(217 33% 25%)' : 'hsl(217 91% 40%)',
                      color: isDone ? 'hsl(152 81% 85%)' :
                        isError ? 'hsl(0 90% 85%)' : 'hsl(0 0% 100%)',
                      fontWeight: 700, fontSize: '0.82rem',
                      cursor: isBuilding || activeShapes.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: activeShapes.length === 0 ? 0.5 : 1,
                      transition: 'background 0.2s, transform 0.1s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onMouseEnter={e => { if (!isBuilding && activeShapes.length > 0) (e.currentTarget as HTMLButtonElement).style.background = isDone ? 'hsl(160 84% 30%)' : 'hsl(217 91% 50%)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isDone ? 'hsl(160 84% 25%)' : isError ? 'hsl(0 84% 28%)' : isBuilding ? 'hsl(217 33% 25%)' : 'hsl(217 91% 40%)'; }}
                  >
                    {buttonContent(card.id)}
                  </button>

                  <button
                    onClick={() => handlePreview(card.id)}
                    disabled={activeShapes.length === 0}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid hsl(217 33% 30%)',
                      background: 'hsl(217 33% 19%)',
                      color: 'hsl(215 16% 72%)',
                      fontWeight: 600, fontSize: '0.78rem',
                      cursor: activeShapes.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: activeShapes.length === 0 ? 0.5 : 1,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => { if (activeShapes.length > 0) (e.currentTarget as HTMLButtonElement).style.background = 'hsl(217 33% 24%)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'hsl(217 33% 19%)'; }}
                  >
                    Preview
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Validation Log ── */}
      {validationLog.length > 0 && (
        <div style={{
          background: 'hsl(217 33% 12%)',
          borderRadius: '0.75rem',
          border: '1px solid hsl(217 33% 22%)',
          padding: '1rem 1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Info className="w-4 h-4" style={{ color: 'hsl(217 91% 60%)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(213 31% 91%)' }}>Validation Log</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {validationLog.map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78rem' }}>
                {log.ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'hsl(160 84% 50%)' }} />
                  : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'hsl(38 92% 55%)' }} />}
                <span style={{ color: log.ok ? 'hsl(152 60% 72%)' : 'hsl(38 80% 72%)' }}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Preview Panel ── */}
      {previewText && (
        <div style={{
          background: 'hsl(222 47% 7%)',
          borderRadius: '0.875rem',
          border: '1px solid hsl(217 33% 24%)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid hsl(217 33% 20%)',
            background: 'hsl(217 33% 13%)',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(213 31% 88%)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Code2 className="w-4 h-4" style={{ color: 'hsl(217 91% 60%)' }} />
              Preview — {FORMAT_CARDS.find(c => c.id === previewFormat)?.label}
              <span style={{ fontSize: '0.7rem', color: 'hsl(215 16% 55%)', fontWeight: 400 }}>(first 4000 chars)</span>
            </span>
            <button
              onClick={() => { setPreviewText(null); setPreviewFormat(null); }}
              style={{
                background: 'hsl(217 33% 20%)', border: '1px solid hsl(217 33% 30%)',
                borderRadius: '0.375rem', padding: '0.25rem 0.65rem',
                color: 'hsl(215 16% 72%)', fontSize: '0.75rem', cursor: 'pointer',
              }}
            >✕ Close</button>
          </div>
          <pre style={{
            padding: '1.25rem', overflowX: 'auto', overflowY: 'auto',
            maxHeight: '440px', fontSize: '0.72rem', lineHeight: 1.6,
            color: 'hsl(213 31% 82%)', fontFamily: 'var(--font-mono)',
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {previewText}
          </pre>
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.75rem',
      }}>
        {[
          { icon: <FileJson className="w-4 h-4" />, title: 'JSON', desc: 'Full nested structure. Best for programmatic processing.', color: 'hsl(217 91% 60%)' },
          { icon: <FileSpreadsheet className="w-4 h-4" />, title: 'CSV', desc: 'Flat table. Open in Excel, Numbers, or import in MATLAB/Python.', color: 'hsl(160 84% 50%)' },
          { icon: <FileText className="w-4 h-4" />, title: 'Markdown', desc: 'Paste into your thesis doc or render in Jupyter.', color: 'hsl(263 70% 65%)' },
          { icon: <Code2 className="w-4 h-4" />, title: 'CST Macro', desc: 'Run in CST Microwave Studio → Macros → Run VBA Macro.', color: 'hsl(38 80% 62%)' },
        ].map(({ icon, title, desc, color }) => (
          <div key={title} style={{
            padding: '0.875rem 1rem',
            borderRadius: '0.625rem',
            border: '1px solid hsl(217 33% 22%)',
            background: 'hsl(217 33% 13%)',
            display: 'flex', gap: '0.65rem', alignItems: 'flex-start',
          }}>
            <div style={{ color, marginTop: '0.1rem', flexShrink: 0 }}>{icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'hsl(213 31% 90%)' }}>{title}</div>
              <div style={{ fontSize: '0.72rem', color: 'hsl(215 16% 60%)', marginTop: '0.2rem', lineHeight: 1.4 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExportTab;

import { readFileSync } from 'node:fs';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useShapeData } from './useShapeData';
import { candidateGeometry, candidateSource, candidateGeometryWarning } from '@/lib/absorberCandidate';
import { SHAPES } from '@/data/shapes';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('ranks real 1–5 GHz coverage in the existing pool and preserves source dimensions and 3D mapping',async()=>{
 const fetcher=vi.fn(async(url:string)=>({ok:true,text:async()=>readFileSync('public'+url,'utf8')}));vi.stubGlobal('fetch',fetcher);
 const {result}=renderHook(()=>useShapeData());await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.errors).toEqual([]);expect(result.current.shapes.map(s=>s.name)).toEqual(SHAPES.map(s=>s.name));
 const ranked=result.current.pickAllInFreq(1.5,-10);
 expect(ranked).toHaveLength(2);expect(new Set(ranked.map(r=>r.item.name))).toEqual(new Set(['ring_ro_sweep','triangle1']));
 expect(ranked[0].score).toBeLessThanOrEqual(ranked[1].score);expect(ranked[0].item.rawFile).not.toBe(ranked[1].item.rawFile);
 for(const r of ranked){expect(Number.isFinite(r.best.s11_db)).toBe(true);expect(r.item.curves[r.best.p]).toBeDefined();expect(candidateSource(r.item)).toContain('1–5 GHz coverage');expect(candidateGeometry(r.item,r.best.p).shapeSpec.fixed).toBe(r.item.config.fixed);}
 const ring=ranked.find(r=>r.item.name==='ring_ro_sweep')!;const triangle=ranked.find(r=>r.item.name==='triangle1')!;
 expect(candidateGeometry(ring.item,ring.best.p)).toEqual({shapeSpec:{geometryType:'ring_patch_fixed_geom',paramMode:'ro',paramLabel:'ro',fixed:ring.item.fixed},pValueMm:ring.best.p});
 expect(candidateGeometryWarning(ring.item,12)).toContain('UNVERIFIED GEOMETRY');
 expect(candidateGeometryWarning(ring.item,4)).toBeNull();
 expect(ring.item.fixed.ring_inner_r_mm).toBe(1);expect(ring.item.fixed.substrate_thick_mm).toBe(1.6);
 expect(triangle.item.fixed.triangle_vertices_mm).toEqual([[-4.5,6],[5.5,-6],[6.5,6]]);
 expect(triangle.item.geometryType).toBe('triangle_patch_custom');
 expect(fetcher.mock.calls.every(([url])=>!/(blood|cancer)/i.test(url))).toBe(true);
 expect(result.current.pickAllInFreq(.5,-10)).toEqual([]);
 console.info('Actual stored 1.5 GHz ranking:',ranked.map(r=>({shape:r.item.name,p:r.best.p,s11:r.best.s11_db,pass:r.best.pass})));
});

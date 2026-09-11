import { describe, expect, it } from 'vitest';
import { digitize, importVNA, summarize } from './lab';
const corners=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
const trace=Array.from({length:8},(_,i)=>({x:10+i*10,y:50}));
const cal={fmin:1,fmax:3,smin:-40,smax:0,unit:'GHz' as const,confirmed:true};
it('rejects unsupported VNA representations and missing units',()=>{
  expect(()=>importVNA('# GHz Y DB R 50\n1 2 0','x.s1p')).toThrow();
  expect(()=>importVNA('1,-20\n2,-30','x.csv')).toThrow();
  expect(()=>importVNA('# GHz S DB R 50\n1 -20 0','x.s2p')).toThrow();
});
it('detects MHz without guessing and canonicalizes raw samples',()=>{
  const text='freq_MHz,S11_dB\n'+Array.from({length:8},(_,i)=>`${1000+i*100},-20`).join('\n');
  const result=importVNA(text,'raw.csv');expect(result.unit).toBe('MHz');expect(result.points[0].freq).toBe(1);
});
it('requires explicit axis confirmation and plot corners',()=>{
  expect(()=>digitize(corners,trace,{...cal,confirmed:false})).toThrow(/calibration/);
  expect(()=>digitize([],trace,cal)).toThrow();
  expect(()=>digitize(corners,trace,{...cal,fmin:NaN})).toThrow();
});
it('maps user-traced pixels to calibrated XY without inventing points',()=>{
  const p=digitize(corners,trace,cal);expect(p).toHaveLength(8);expect(p[0].freq).toBeCloseTo(1.2);expect(p[0].s11).toBe(-20);
  expect(()=>digitize(corners,[...trace,{x:110,y:50}],cal)).toThrow(/inside/);
});
it('supports planar projective calibration with rotated plot corners',()=>{
  const rotated=corners.map(p=>({x:100-p.y,y:p.x})),t=trace.map(p=>({x:100-p.y,y:p.x}));
  expect(digitize(rotated,t,cal)[0].freq).toBeCloseTo(1.2);
});
it('uses explicit reference, deterministic minimum, contiguous bandwidth and unavailable Q',()=>{
  const s=summarize([{freq:1,s11:-12},{freq:2,s11:-13},{freq:3,s11:-2},{freq:4,s11:-12},{freq:5,s11:-13}],[{freq:1.5,s11:-20}])!;
  expect(s.resonance_ghz).toBe(2);expect(s.delta_frequency_ghz).toBe(.5);expect(s.contiguous_minus10db_bandwidth_ghz).toBe(1);expect(s.q).toContain('Unavailable');
});

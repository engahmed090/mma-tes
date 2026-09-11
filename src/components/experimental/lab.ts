import { parseVNAFile, VNAPoint } from '@/utils/vna';
import { calcBandwidth } from '@/utils/math';
export type Experiment = 'blood' | 'glucose' | 'nitrate';
export type Unit = 'Hz' | 'kHz' | 'MHz' | 'GHz';
export const units: Record<Unit, number> = { Hz: 1e-9, kHz: 1e-6, MHz: 1e-3, GHz: 1 };
export interface Sample {
  sample_id: string; specimen_group: string; experiment_type: Experiment;
  source_type: 'RAW_VNA' | 'IMAGE_EXTRACTED'; reference_label: 'NORMAL_REFERENCE' | 'CANCER_REFERENCE' | null;
  reference_established: boolean; cancer_type_optional: string | null;
  known_concentration_optional: number | null; concentration_unit_optional: string | null;
  sensor_id: string; measurement_session_id: string; replicate_id: string; measurement_date: string; notes: string;
  raw_filename: string | null; image_filename: string | null; raw_content?: string; image_data_url?: string;
  frequency_unit: Unit; s11_unit: 'dB'; provenance: Record<string, unknown>; quality_status: 'APPROVED';
  points: [number, number][]; reference_sample_id: string | null;
}
export function importVNA(text: string, filename: string) {
  const points = parseVNAFile(text, filename);
  if (points.length < 8) throw new Error('At least eight samples are required for the experimental lab.');
  const header = text.split(/\r?\n/).find(l => l.trim() && !l.trim().startsWith('!')) || '';
  const found = header.match(/(?:^|[^a-z])(GHZ|MHZ|KHZ|HZ)(?=$|[^a-z])/i)?.[1].toUpperCase();
  const unit: Unit = found === 'HZ' ? 'Hz' : found === 'KHZ' ? 'kHz' : found === 'MHZ' ? 'MHz' : 'GHz';
  return { points, unit, unitBasis: found ? 'Explicit file header' : 'Touchstone 1.x GHz default option semantics' };
}
export function summarize(points: VNAPoint[], reference?: VNAPoint[]) {
  if (!points.length) return null;
  const minimum = points.reduce((a,b) => b.s11 < a.s11 ? b : a);
  const ref = reference?.reduce((a,b) => b.s11 < a.s11 ? b : a);
  const minima = points.filter((p,i) => i>0 && i<points.length-1 && p.s11<points[i-1].s11 && p.s11<=points[i+1].s11);
  return { samples: points.length, frequency_range_ghz: [points[0].freq, points.at(-1)!.freq],
    resonance_ghz: minimum.freq, minimum_s11_db: minimum.s11, reference_resonance_ghz: ref?.freq ?? null,
    delta_frequency_ghz: ref ? minimum.freq-ref.freq : null,
    contiguous_minus10db_bandwidth_ghz: points.some(p=>p.s11<=-10) ? calcBandwidth(points.map(p=>p.freq),points.map(p=>p.s11)).bw : null,
    q: 'Unavailable: no justified half-power model',
    resonance_rule: 'Global sampled minimum; lowest-frequency tie',
    warnings: [minima.length>1 ? 'Multiple minima; inspect global-minimum selection.' : '',
      minimum===points[0] || minimum===points.at(-1) ? 'Minimum at sweep boundary.' : '',
      points.some(p=>p.s11>0) ? 'Positive S11: review calibration/passivity.' : ''].filter(Boolean) };
}
export interface Pixel { x: number; y: number }
export interface Calibration { fmin: number; fmax: number; smin: number; smax: number; unit: Unit; confirmed: boolean }
export function digitize(corners: Pixel[], trace: Pixel[], calibration: Calibration): VNAPoint[] {
  const { fmin,fmax,smin,smax,unit,confirmed }=calibration;
  if (!confirmed || corners.length!==4 || ![fmin,fmax,smin,smax].every(Number.isFinite) || fmin<=0 || fmax<=fmin || smax<=smin || !(unit in units))
    throw new Error('Four plot corners and confirmed finite linear axis calibration are required.');
  if (trace.length<8) throw new Error('Trace at least eight visible curve points; do not infer hidden portions.');
  const turns=corners.map((p,i)=> { const q=corners[(i+1)%4],r=corners[(i+2)%4]; return (q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x); });
  if (!turns.every(v=>v>1e-8) && !turns.every(v=>v< -1e-8)) throw new Error('Plot corners must form a convex quadrilateral in TL, TR, BR, BL order.');
  const dest=[[0,0],[1,0],[1,1],[0,1]];
  const matrix: number[][]=[];
  corners.forEach(({x,y},i)=>{const [u,v]=dest[i];matrix.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
  for(let k=0;k<8;k++) {
    let pivot=k;for(let j=k+1;j<8;j++) if(Math.abs(matrix[j][k])>Math.abs(matrix[pivot][k])) pivot=j;
    [matrix[k],matrix[pivot]]=[matrix[pivot],matrix[k]];
    const scale=matrix[k][k];if(Math.abs(scale)<1e-10) throw new Error('Degenerate perspective calibration.');
    matrix[k]=matrix[k].map(v=>v/scale);
    for(let j=0;j<8;j++) if(j!==k) {const factor=matrix[j][k];matrix[j]=matrix[j].map((v,i)=>v-factor*matrix[k][i]);}
  }
  const h=matrix.map(row=>row[8]);
  const points=trace.map(({x,y})=>{
    const d=h[6]*x+h[7]*y+1,u=(h[0]*x+h[1]*y+h[2])/d,v=(h[3]*x+h[4]*y+h[5])/d;
    if(!Number.isFinite(u+v)||u<0||u>1||v<0||v>1) throw new Error('Trace points must lie inside the calibrated plot.');
    return {freq:(fmin+u*(fmax-fmin))*units[unit],s11:smax-v*(smax-smin)};
  }).sort((a,b)=>a.freq-b.freq);
  if(points.some((p,i)=>i>0&&p.freq-points[i-1].freq<1e-12)) throw new Error('Duplicate trace frequencies; undo and select one curve value per frequency.');
  return points;
}
export async function localAPI(path: string, body?: unknown) {
  // Intentionally same-origin local backend: never uses the external chat endpoint.
  const response=await fetch('/api/experimental/'+path,body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : undefined);
  const data=await response.json();
  if(!response.ok) throw new Error(typeof data.detail==='string' ? data.detail : JSON.stringify(data.detail));
  return data;
}

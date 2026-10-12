import { useMemo } from 'react';
import { acquisitionFraction, responseFor } from './response';
import { isJuice, SAMPLE_LABELS, type Sample } from './demo';
export default function ResponsePanel({ sample, time }: { sample: Sample; time: number }) {
  const curve = useMemo(() => responseFor(sample), [sample]);
  const reference = useMemo(() => responseFor(isJuice(sample) ? 'JuiceReference' : 'Reference'), [sample]);
  const fraction = acquisitionFraction(time);
  const count = Math.floor(fraction * curve.points.length);
  const x = (f: number) => 58 + (f - curve.min) / (curve.max - curve.min) * 610;
  const y = (s: number) => 24 - s / 40 * 145;
  const path = (points: typeof curve.points) => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.frequency).toFixed(2)},${y(p.s11).toFixed(2)}`).join(' ');
  const color = sample === 'Research' || sample === 'JuiceElevated' ? '#fbbf24' : '#22d3ee';
  return <section aria-label="Live RF response" className="rounded-xl border border-border bg-secondary/10 p-4 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">LIVE RESPONSE · Demonstration</h3><span className="text-[10px] text-primary font-mono">{curve.label}</span></div>
    <p className="text-xs text-muted-foreground mt-2">{SAMPLE_LABELS[sample]} · {time < 5 ? 'Idle — select a sample and play' : time < 12 ? 'Illustrative acquisition' : 'Illustrative resonance feature'}</p>
    <svg viewBox="0 0 700 220" className="w-full max-h-64" role="img" aria-label={`${curve.label}: ${SAMPLE_LABELS[sample]}`}>
      {[0, -10, -20, -30, -40].map(v => <g key={v}><line x1="58" x2="668" y1={y(v)} y2={y(v)} stroke="#243449"/><text x="48" y={y(v)+4} textAnchor="end" fill="#94a3b8" fontSize="11">{v}</text></g>)}
      {[0, .25, .5, .75, 1].map(v => <text key={v} x={58+610*v} y="190" textAnchor="middle" fill="#94a3b8" fontSize="11">{(curve.min+(curve.max-curve.min)*v).toFixed(3)}</text>)}
      <text x="365" y="213" textAnchor="middle" fill="#cbd5e1" fontSize="12">Frequency (GHz)</text><text transform="translate(14,100) rotate(-90)" textAnchor="middle" fill="#cbd5e1" fontSize="12">S11 (dB)</text>
      {count > 1 && <><path d={path(reference.points)} fill="none" stroke="#64748b" strokeDasharray="4 4"/><path data-testid="response-curve" d={path(curve.points.slice(0,count))} fill="none" stroke={color} strokeWidth="2.5"/>{time >= 12 && <line x1={x(curve.center)} x2={x(curve.center)} y1="20" y2="170" stroke={color} strokeDasharray="3 5" />}</>}
    </svg>
    <div className="flex flex-wrap gap-4 text-xs"><span className="text-slate-400">- - Reference illustration</span><span style={{ color }}>— {SAMPLE_LABELS[sample]}</span>{time >= 12 && <span className="text-muted-foreground">Dotted marker: illustrative resonance</span>}</div>
    <p className="text-[10px] text-muted-foreground mt-2">{curve.provenance} No measured frequency shift, concentration, accuracy or confidence is inferred.</p>
  </section>;
}

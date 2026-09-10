export interface VNAPoint { freq: number; s11: number; }
// Touchstone 1.x option semantics: https://ibis.org/connector/touchstone_spec11.pdf
const scales: Record<string, number> = { HZ: 1e-9, KHZ: 1e-6, MHZ: 1e-3, GHZ: 1 };
export function parseVNAFile(text: string, filename = ''): VNAPoint[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (/\.s(?!1p$)\d+p$/i.test(filename) || lines.some(l => l.startsWith('[')))
    throw new Error('Only one-port Touchstone 1.x is supported; multiport and keyword formats are unsupported.');
  const touchstone = /\.s1p$/i.test(filename) || lines.some(l => l.startsWith('#'));
  let scale: number | undefined;
  let format = 'DB';
  let header = false;
  const points: VNAPoint[] = [];
  for (const original of lines) {
    if (original.startsWith('!')) continue;
    const line = original.split('!')[0].trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (header || points.length) throw new Error('Multiple or misplaced Touchstone option lines are unsupported.');
      header = true; scale = 1; format = 'MA';
      const tokens = line.slice(1).trim().toUpperCase().split(/\s+/).filter(Boolean);
      const seen = new Set<string>();
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const kind = token in scales ? 'unit' : ['DB', 'MA', 'RI'].includes(token) ? 'format' : token;
        if (seen.has(kind)) throw new Error('Duplicate Touchstone options.');
        seen.add(kind);
        if (token in scales) scale = scales[token];
        else if (['DB', 'MA', 'RI'].includes(token)) format = token;
        else if (token === 'R') {
          const resistance = Number(tokens[++i]);
          if (!Number.isFinite(resistance) || resistance <= 0) throw new Error('Invalid reference impedance.');
        } else if (token !== 'S') throw new Error('Unsupported Touchstone representation; only S parameters are supported.');
      }
      continue;
    }
    if (!touchstone && !header) {
      const unit = line.match(/(?:^|[^a-z])(GHZ|MHZ|KHZ|HZ)(?=$|[^a-z])/i);
      if (!unit || !/s11.*(?:^|[^a-z])db(?:$|[^a-z])/i.test(line))
        throw new Error('Two-column files require a header such as freq_GHz, S11_dB. Units are never guessed.');
      scale = scales[unit[1].toUpperCase()]; header = true; continue;
    }
    if (!header) throw new Error('Touchstone requires an option line.');
    const tokens = line.split(touchstone ? /\s+/ : /[\s,;]+/);
    const values = tokens.map(Number);
    if (values.length !== (touchstone ? 3 : 2) || !values.every(Number.isFinite))
      throw new Error('Malformed VNA row or unsupported column layout.');
    const [f, a, b] = values;
    const magnitude = format === 'RI' ? Math.hypot(a, b) : a;
    const s11 = format === 'DB' ? a : 20 * Math.log10(magnitude);
    const freq = f * scale!;
    if (f <= 0 || !Number.isFinite(freq) || !Number.isFinite(s11))
      throw new Error('VNA values must have positive frequency and finite S11 in dB.');
    points.push({ freq, s11 });
  }
  if (points.length < 2) throw new Error('At least two VNA samples are required.');
  points.sort((a, b) => a.freq - b.freq);
  if (points.some((p, i) => i > 0 && p.freq === points[i - 1].freq)) throw new Error('Duplicate VNA frequencies are unsupported.');
  return points;
}

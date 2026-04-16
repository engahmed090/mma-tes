import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadedShape } from '@/hooks/useShapeData';
import { absorptionFromS11, calcBandwidth, nearestPKey, rawBestAtFreq } from '@/utils/math';
import { FileText, Download } from 'lucide-react';

interface ReportTabProps {
  shapes: LoadedShape[];
  pickAllInFreq: (f: number, thr: number) => any[];
}

const ReportTab: React.FC<ReportTabProps> = ({ shapes, pickAllInFreq }) => {
  const [repFreq, setRepFreq] = useState(10);
  const [repThr, setRepThr] = useState(-10);
  const [repTitle, setRepTitle] = useState('Metamaterial Absorber Performance Report');
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<string | null>(null);

  const generate = () => {
    const results = pickAllInFreq(repFreq, repThr);
    const lines: string[] = [
      `# ${repTitle}`,
      `**Target frequency:** ${repFreq.toFixed(3)} GHz  |  **S11 threshold:** ${repThr.toFixed(1)} dB`,
      `**Total shapes evaluated:** ${shapes.length}  |  **Results found:** ${results.length}`,
      '',
      '## Summary Table',
      '| Rank | Shape | Source | Best P (mm) | S11 (dB) | Absorption | BW (-10dB) | Status |',
      '|------|-------|--------|-------------|----------|------------|------------|--------|',
    ];

    const csvRows: string[] = ['Rank,Shape,Source,P_mm,S11_dB,Absorption%,BW_GHz,Status'];
    const medals = ['🥇', '🥈', '🥉'];

    for (let idx = 0; idx < results.length; idx++) {
      const r = results[idx];
      const name = r.item.displayName.slice(0, 40);
      const src = r.item.isReal ? 'CST Raw' : 'Literature';
      const pBest = r.best.p;
      const s11Val = r.best.s11_db ?? r.best.best_db ?? NaN;
      const absPct = (absorptionFromS11(s11Val) as number) * 100;
      const passed = s11Val <= repThr;
      let bwStr = '—';
      const pk = nearestPKey(r.item.curves, pBest);
      if (pk !== null && r.item.curves[pk]) {
        const { bw } = calcBandwidth(r.item.curves[pk].freqs, r.item.curves[pk].s11, repThr);
        bwStr = bw > 0 ? `${bw.toFixed(3)} GHz` : '<threshold';
      }
      const medal = idx < 3 ? medals[idx] : `#${idx + 1}`;
      lines.push(`| ${medal} | ${name} | ${src} | ${pBest.toFixed(4)} | ${s11Val.toFixed(2)} | ${absPct.toFixed(1)}% | ${bwStr} | ${passed ? '✅ PASS' : '⚠️ FAIL'} |`);
      csvRows.push(`${medal},${name},${src},${pBest.toFixed(4)},${s11Val.toFixed(2)},${absPct.toFixed(1)},${bwStr},${passed ? 'PASS' : 'FAIL'}`);
    }

    lines.push('', '## All Loaded Shapes');
    for (const s of shapes) {
      lines.push(`- **${s.displayName}** [${s.ranges.fmin.toFixed(1)}–${s.ranges.fmax.toFixed(1)} GHz] ${s.isReal ? '(CST trained)' : '(Literature)'}`);
    }

    setReportMd(lines.join('\n'));
    setCsvData(csvRows.join('\n'));
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 tab-content-enter">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" /> Thesis-Ready Report Generator
      </h2>
      <p className="text-sm text-muted-foreground">
        Generate a structured report with all loaded shapes, their performance, and design parameters.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Target frequency (GHz)</label>
          <Input type="number" value={repFreq} onChange={e => setRepFreq(Number(e.target.value))} min={1} max={50} step={0.5} className="font-mono" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">S11 threshold (dB)</label>
          <Input type="number" value={repThr} onChange={e => setRepThr(Number(e.target.value))} min={-30} max={-5} step={1} className="font-mono" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Report title</label>
          <Input value={repTitle} onChange={e => setRepTitle(e.target.value)} className="font-mono" />
        </div>
      </div>

      <Button onClick={generate} size="lg">
        <FileText className="w-4 h-4 mr-2" /> Generate Report
      </Button>

      {reportMd && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/20 p-6 overflow-x-auto">
            <pre className="text-sm text-foreground font-mono whitespace-pre-wrap">{reportMd}</pre>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => downloadFile(reportMd, `absorber_report_${repFreq.toFixed(1)}GHz.md`, 'text/markdown')}>
              <Download className="w-4 h-4 mr-1" /> Download Markdown
            </Button>
            {csvData && (
              <Button variant="outline" onClick={() => downloadFile(csvData, `absorber_results_${repFreq.toFixed(1)}GHz.csv`, 'text/csv')}>
                <Download className="w-4 h-4 mr-1" /> Download CSV
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportTab;

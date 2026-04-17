import React, { useState } from 'react';
import { useShapeData } from '@/hooks/useShapeData';
import FindBestTab from '@/components/absorber/FindBestTab';
import InverseDesignTab from '@/components/absorber/InverseDesignTab';
import BioSensingTab from '@/components/absorber/BioSensingTab';
import ChatTab from '@/components/absorber/ChatTab';
import ExportTab from '@/components/absorber/ExportTab';
import { Search, RefreshCw, HeartPulse, Bot, Download, Settings, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const TABS = [
  { id: 'find', label: '🔍 Find Best Absorber', icon: Search },
  { id: 'inverse', label: '🔄 Inverse Design', icon: RefreshCw },
  { id: 'bio', label: '🩺 Bio-Sensing', icon: HeartPulse },
  { id: 'chat', label: '🤖 AI Expert Chat', icon: Bot },
  { id: 'report', label: '📦 Export / Download', icon: Download },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState('find');
  const [thrDb, setThrDb] = useState(-10);
  const [includePaper, setIncludePaper] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { shapes, loading, errors, pickAllInFreq, pickAllInRange } = useShapeData(includePaper);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="mx-4 mt-4 rounded-xl p-6 border border-primary/30" style={{ background: 'var(--gradient-header)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground">
              🧲 Metamaterial Absorber AI Platform <span className="text-sm font-normal text-primary">v5</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              CST-trained neural networks for absorber parameter prediction, optimization & thesis reporting
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="badge badge-blue">Forward: (Freq,P)→S11</span>
              <span className="badge badge-green">Inverse: (Freq,S11)→P</span>
              <span className="badge badge-amber">CST Brain: Auto-Design Fallback</span>
              <span className="badge badge-purple">Ref Brain: Scholar+ResearchGate</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Settings className="w-4 h-4 mr-1" /> Config
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Config panel */}
        {sidebarOpen && (
          <div className="w-72 shrink-0 p-4 border-r border-border space-y-4">
            <h3 className="font-semibold text-foreground text-sm">⚙️ Configuration</h3>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">S11 threshold (dB)</label>
              <Input type="number" value={thrDb} onChange={e => setThrDb(Number(e.target.value))} step={0.5} className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={includePaper} onCheckedChange={(v) => setIncludePaper(!!v)} id="paper" />
              <label htmlFor="paper" className="text-sm text-muted-foreground">Include literature shapes</label>
            </div>
            <div className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : `${shapes.length} shapes loaded`}
              {errors.length > 0 && <div className="text-warn mt-1">{errors.length} warnings</div>}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tab navigation */}
          <div className="border-b border-border px-4 flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-primary text-foreground bg-secondary/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
                <span className="text-muted-foreground">Loading CST data files...</span>
              </div>
            ) : shapes.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-destructive text-lg">⚠️ No shapes loaded. Enable literature shapes or check data files.</p>
              </div>
            ) : (
              <>
                {activeTab === 'find' && <FindBestTab shapes={shapes} pickAllInFreq={pickAllInFreq} pickAllInRange={pickAllInRange} thrDb={thrDb} />}
                {activeTab === 'inverse' && <InverseDesignTab shapes={shapes} thrDb={thrDb} />}
                {activeTab === 'bio' && <BioSensingTab />}
                {activeTab === 'chat' && <ChatTab shapes={shapes} thrDb={thrDb} />}
                {activeTab === 'report' && <ExportTab shapes={shapes} pickAllInFreq={pickAllInFreq} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

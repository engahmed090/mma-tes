import { useState } from "react";
import {
  Activity,
  Search,
  RefreshCw,
  Bot,
  Download,
  Settings,
  FlaskConical,
  LayoutDashboard,
} from "lucide-react";
import { useShapeData } from "@/hooks/useShapeData";
import { streamlitBase } from "@/lib/serviceConfig";
import ExperimentalLab from "@/components/experimental/ExperimentalLab";
import ResearchOverview from "@/components/research/ResearchOverview";
import FindBestTab from "@/components/absorber/FindBestTab";
import InverseDesignTab from "@/components/absorber/InverseDesignTab";
import BioSensingTab from "@/components/absorber/BioSensingTab";
import ChatTab from "@/components/absorber/ChatTab";
import ExportTab from "@/components/absorber/ExportTab";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const TABS = [
  { id: "overview", label: "Overview & devices", icon: LayoutDashboard },
  { id: "experimental", label: "Experimental Sensing Lab", icon: FlaskConical },
  { id: "find", label: "CST explorer", icon: Search },
  { id: "bio", label: "Analytical sensing", icon: Activity },
  { id: "inverse", label: "Inverse design", icon: RefreshCw },
  { id: "report", label: "Export & reports", icon: Download },
  { id: "chat", label: "AI research assistant", icon: Bot },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState("overview");
  const [thrDb, setThrDb] = useState(-10);
  const [includePaper, setIncludePaper] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { shapes, loading, errors, pickAllInFreq, pickAllInRange } =
    useShapeData(includePaper);
  const needsData = ["find", "inverse", "report"].includes(activeTab);
  return (
    <div className="platform-shell min-h-screen bg-background">
      <header className="platform-header">
        <div>
          <h1>
            MetaAbsorber <span className="text-primary">Research</span>
          </h1>
          <p>AI-ENHANCED METAMATERIAL SENSING PLATFORM</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={configOpen}
          aria-controls="research-settings"
          onClick={() => setConfigOpen(!configOpen)}
        >
          <Settings size={15} className="mr-2" />
          Settings
        </Button>
      </header>
      {configOpen && (
        <aside id="research-settings" className="platform-config">
          <label htmlFor="threshold">S₁₁ threshold (dB)</label>
          <Input
            id="threshold"
            type="number"
            value={thrDb}
            onChange={(e) => setThrDb(Number(e.target.value))}
            step={0.5}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              checked={includePaper}
              onCheckedChange={(v) => setIncludePaper(v === true)}
              id="paper"
            />
            <label htmlFor="paper">
              Include SYNTHETIC / DEMONSTRATION DATA in searches
            </label>
          </div>
          <span>
            {loading
              ? "Loading CST sources…"
              : `${shapes.length} datasets loaded`}
            {errors.length > 0 && ` · ${errors.length} source warnings`}
          </span>
        </aside>
      )}
      <nav className="platform-nav" aria-label="Research modules">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            aria-current={activeTab === tab.id ? "page" : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="platform-content">
        {activeTab === "overview" && (
          <ResearchOverview navigate={setActiveTab} />
        )}
        {activeTab === "experimental" && <ExperimentalLab />}
        {activeTab === "chat" && <ChatTab shapes={shapes} thrDb={thrDb} />}
        {activeTab === "bio" && (
          <>
            <p className="platform-note">
              Analytical reference cases · Lorentzian sensing model · Blood
              Sensing: εr∈{"{1,60,68}"}. These are illustrative permittivity
              cases, not measured diagnostic outcomes.
            </p>
            <BioSensingTab />
            {streamlitBase && (
              <details className="mt-6">
                <summary>External analytical workspace</summary>
                <iframe
                  src={`${streamlitBase}/?embed=true`}
                  title="External analytical sensing workspace"
                  className="w-full h-[700px] mt-4 border border-border rounded-xl"
                />
              </details>
            )}
          </>
        )}
        {needsData &&
          (loading ? (
            <p role="status" className="py-12 text-muted-foreground">
              Loading CST response data…
            </p>
          ) : shapes.length === 0 ? (
            <p role="alert" className="platform-note">
              CST sources are unavailable. Check the configured source files;
              synthetic demonstrations remain excluded unless explicitly
              enabled.
            </p>
          ) : (
            <>
              <p className="platform-note">
                CST simulation data · Not measured results. Absorption assumes
                negligible transmission; bandwidth uses contiguous sampled
                bands. Geometry and model availability must be verified before
                research use.
              </p>
              {activeTab === "find" && (
                <FindBestTab
                  shapes={shapes}
                  pickAllInFreq={pickAllInFreq}
                  pickAllInRange={pickAllInRange}
                  thrDb={thrDb}
                />
              )}
              {activeTab === "inverse" && (
                <InverseDesignTab shapes={shapes} thrDb={thrDb} />
              )}
              {activeTab === "report" && (
                <ExportTab shapes={shapes} pickAllInFreq={pickAllInFreq} />
              )}
            </>
          ))}
      </main>
      <footer className="platform-footer">
        <span>
          MetaAbsorber / Research instrumentation & analytical sensing
        </span>
        <span>
          Experimental validation pending · Not for clinical diagnosis
        </span>
      </footer>
    </div>
  );
}

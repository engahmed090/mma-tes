import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import Plot from 'react-plotly.js';
import {
  HeartPulse, Droplets, TrendingUp, Zap, Shield, Microscope,
  BookOpen, AlertTriangle, ArrowRight, Beaker, Activity, Layers,
  Target, BarChart3, FileText, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';

/* ─── REFERENCE DATA ─── */
const REFERENCES = [
  {
    id: 1,
    authors: "S. J. Park, J. T. Hong, S. J. Choi, H. S. Kim, W. K. Park, S. T. Han, J. Y. Park, S. Lee, D. S. Kim, Y. H. Ahn",
    title: "Detection of microorganisms using terahertz metamaterials",
    journal: "Scientific Reports",
    year: 2014,
    volume: "4, 4988",
    doi: "10.1038/srep04988",
    url: "https://doi.org/10.1038/srep04988",
  },
  {
    id: 2,
    authors: "R. Melik, E. Unal, N. K. Perkgoz, C. Puttlitz, H. V. Demir",
    title: "Metamaterial-based wireless strain sensors",
    journal: "Applied Physics Letters",
    year: 2009,
    volume: "95(1), 011106",
    doi: "10.1063/1.3162336",
    url: "https://doi.org/10.1063/1.3162336",
  },
  {
    id: 3,
    authors: "W. Withayachumnankul, K. Jaruwongrungsee, A. Tuantranont, C. Fumeaux, D. Abbott",
    title: "Metamaterial-based microfluidic sensor for dielectric characterization",
    journal: "Sensors and Actuators A: Physical",
    year: 2013,
    volume: "189, 233–237",
    doi: "10.1016/j.sna.2012.10.027",
    url: "https://doi.org/10.1016/j.sna.2012.10.027",
  },
  {
    id: 4,
    authors: "M. Bakır, M. Karaaslan, E. Unal, F. Karadağ, O. Akdogan, C. Sabah",
    title: "Microwave metamaterial absorber for sensing applications",
    journal: "Opto-Electronics Review",
    year: 2017,
    volume: "25(4), 318–325",
    doi: "10.1016/j.opelre.2017.10.002",
    url: "https://doi.org/10.1016/j.opelre.2017.10.002",
  },
  {
    id: 5,
    authors: "T. Chen, S. Li, H. Sun",
    title: "Metamaterials application in sensing",
    journal: "Sensors",
    year: 2012,
    volume: "12(3), 2742–2765",
    doi: "10.3390/s120302742",
    url: "https://doi.org/10.3390/s120302742",
  },
  {
    id: 6,
    authors: "C. Gabriel, S. Gabriel, E. Corthout",
    title: "The dielectric properties of biological tissues: I. Literature survey",
    journal: "Physics in Medicine & Biology",
    year: 1996,
    volume: "41(11), 2231–2249",
    doi: "10.1088/0031-9155/41/11/001",
    url: "https://doi.org/10.1088/0031-9155/41/11/001",
  },
  {
    id: 7,
    authors: "H. Tao, L. R. Chieffo, M. A. Brenckle, S. M. Siebert, M. Liu, A. C. Strikwerda, K. Fan, D. L. Kaplan, X. Zhang, R. D. Averitt, F. G. Omenetto",
    title: "Metamaterials on paper as a sensing platform",
    journal: "Advanced Materials",
    year: 2011,
    volume: "23(28), 3197–3201",
    doi: "10.1002/adma.201100163",
    url: "https://doi.org/10.1002/adma.201100163",
  },
  {
    id: 8,
    authors: "Y. Huang, S. Zhong, T. Shi, Y. Shen, D. Cui",
    title: "Terahertz plasmonic phase-jump manipulator for liquid sensing",
    journal: "Nanophotonics",
    year: 2020,
    volume: "9(9), 3011–3021",
    doi: "10.1515/nanoph-2020-0247",
    url: "https://doi.org/10.1515/nanoph-2020-0247",
  },
];

const COMPARISON_TABLE = [
  {
    study: "Park et al. (2014) [1]",
    structure: "SRR-based metamaterial",
    freqRange: "THz (0.5–2.0 THz)",
    target: "Microorganisms",
    mechanism: "Resonance frequency shift",
    notes: "Demonstrated THz metamaterial sensing of biological analytes on substrate surface.",
  },
  {
    study: "Withayachumnankul et al. (2013) [3]",
    structure: "SRR + microfluidic channel",
    freqRange: "Microwave (2–5 GHz)",
    target: "Liquid dielectric",
    mechanism: "Transmission dip shift with εr change",
    notes: "Integrated microfluidics for real-time liquid characterization.",
  },
  {
    study: "Bakır et al. (2017) [4]",
    structure: "Metamaterial absorber",
    freqRange: "Microwave (1–14 GHz)",
    target: "Dielectric variation",
    mechanism: "Absorption peak shift",
    notes: "Absorber-based approach; resonance shifts with overlay permittivity change.",
  },
  {
    study: "Tao et al. (2011) [7]",
    structure: "Paper-based metamaterial",
    freqRange: "THz",
    target: "Chemical analytes",
    mechanism: "Resonance shift on flexible substrate",
    notes: "Low-cost, disposable metamaterial sensor platform.",
  },
  {
    study: "This work",
    structure: "Patch-based metamaterial absorber",
    freqRange: "[Insert operating frequency]",
    target: "Blood dielectric / Nitrate dielectric",
    mechanism: "Absorption & resonance frequency shift with εr variation",
    notes: "Dual-analyte sensing capability via dielectric permittivity modulation.",
  },
];

/* ─── MAIN COMPONENT ─── */
const BioSensingTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [expandedRef, setExpandedRef] = useState(false);

  const sections = [
    { id: 'overview', label: 'Overview', icon: Microscope },
    { id: 'principle', label: 'Sensing Principle', icon: Zap },
    { id: 'blood', label: 'Blood Sensing', icon: HeartPulse },
    { id: 'nitrate', label: 'Nitrate Sensing', icon: Droplets },
    { id: 'comparison', label: 'Literature Comparison', icon: BarChart3 },
    { id: 'tools', label: 'Interactive Tools', icon: Activity },
    { id: 'references', label: 'References', icon: BookOpen },
  ];

  return (
    <div className="space-y-6 tab-content-enter">
      {/* ───── HERO ───── */}
      <div className="rounded-xl border border-primary/30 p-6 md:p-8" style={{ background: 'var(--gradient-header)' }}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/20 border border-primary/30 shrink-0 mt-0.5">
            <Microscope className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">
              Absorber-Based Biosensing Platform
            </h2>
            <p className="text-muted-foreground mt-2 leading-relaxed max-w-3xl">
              This section presents the metamaterial absorber as a dielectric-property-based sensing platform.
              By leveraging the sensitivity of the absorber's electromagnetic resonance to changes in the
              relative permittivity (ε<sub>r</sub>) of the surrounding medium, we demonstrate the potential
              for detecting variations in <strong>blood dielectric properties</strong> and{' '}
              <strong>nitrate-related dielectric characteristics</strong>. The sensing mechanism relies on
              measurable shifts in resonance frequency and absorption magnitude when the analyte's permittivity
              departs from the reference baseline.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="badge badge-blue">Dielectric Sensing</span>
              <span className="badge badge-green">Blood ε<sub>r</sub> Analysis</span>
              <span className="badge badge-amber">Nitrate Detection</span>
              <span className="badge badge-purple">Literature Validated</span>
            </div>
          </div>
        </div>
      </div>

      {/* ───── SECTION NAV ───── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeSection === s.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <Separator className="bg-border/50" />

      {/* ───── CONTENT SECTIONS ───── */}
      <div className="tab-content-enter">
        {activeSection === 'overview' && <OverviewSection />}
        {activeSection === 'principle' && <SensingPrincipleSection />}
        {activeSection === 'blood' && <BloodSensingSection />}
        {activeSection === 'nitrate' && <NitrateSensingSection />}
        {activeSection === 'comparison' && <ComparisonSection />}
        {activeSection === 'tools' && <InteractiveToolsSection />}
        {activeSection === 'references' && (
          <ReferencesSection expanded={expandedRef} onToggle={() => setExpandedRef(!expandedRef)} />
        )}
      </div>

      {/* ───── CTA ───── */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Explore Full Absorber Analysis
              </h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Navigate to the <strong>Find Best Absorber</strong> tab for detailed performance analysis,
                the <strong>Inverse Design</strong> tab for parameter optimization, or the{' '}
                <strong>AI Expert Chat</strong> for research-grade discussion of your absorber's biosensing
                capabilities and technical documentation.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="text-xs">
                <FileText className="w-3.5 h-3.5 mr-1" /> Generate Report
              </Button>
              <Button size="sm" className="text-xs">
                <ArrowRight className="w-3.5 h-3.5 mr-1" /> View Performance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── OVERVIEW SECTION ─── */
function OverviewSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Microscope}
        title="What This Tab Does"
        subtitle="Understanding the biosensing workflow"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          icon={Layers}
          title="Dielectric Exposure"
          description="The absorber structure is computationally or experimentally exposed to materials with different relative permittivity (εr) values — specifically blood samples and nitrate-containing solutions."
        />
        <InfoCard
          icon={Activity}
          title="Electromagnetic Response"
          description="Blood εr and nitrate εr directly influence the absorber's resonance frequency, absorption magnitude, and bandwidth. These changes are captured as measurable electromagnetic signatures."
        />
        <InfoCard
          icon={Target}
          title="Sensing Output"
          description="Variations in the absorber performance metrics — including resonance shift (Δf), absorption change (ΔA), and quality factor modulation — serve as sensing indicators for analyte detection and quantification."
        />
      </div>
      <Card className="border-border">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Operational summary:</strong> This biosensing module treats the
            metamaterial absorber as a transducer that converts dielectric property variations into electromagnetic
            observable changes. When a sample with unknown permittivity is placed in contact with or in proximity
            to the absorber, the resulting resonance perturbation can be correlated to the sample's dielectric
            characteristics. This principle is well-established in metamaterial sensing literature [3, 4, 5]
            and forms the basis for non-invasive, label-free sensing applications.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── SENSING PRINCIPLE SECTION ─── */
function SensingPrincipleSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Zap}
        title="Sensing Principle"
        subtitle="Physical basis of dielectric-based metamaterial sensing"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Dielectric Permittivity & Field Interaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The relative permittivity (ε<sub>r</sub>) of a material defines how it interacts with
              an applied electromagnetic field. In a metamaterial absorber, the resonant elements
              create highly localized electric field concentrations. When a dielectric material is
              placed within or near these field-concentrated regions, the effective capacitance of the
              resonant structure changes, directly affecting the resonance condition.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This relationship is governed by the resonance frequency dependence on the effective
              permittivity of the surrounding environment:
            </p>
            <div className="bg-secondary/50 rounded-lg p-3 font-mono text-sm text-foreground text-center border border-border">
              f<sub>res</sub> ∝ 1 / √(L · C<sub>eff</sub>(ε<sub>r</sub>))
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              where C<sub>eff</sub> is the effective capacitance, which is a function of the analyte's
              dielectric constant ε<sub>r</sub>. An increase in ε<sub>r</sub> increases
              C<sub>eff</sub>, resulting in a downward shift of the resonance frequency [5].
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              Measurable Sensing Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The sensor detects analyte variations through several measurable electromagnetic parameters:
            </p>
            <div className="space-y-2.5">
              <MetricRow
                label="Resonance Frequency Shift (Δf)"
                desc="The primary sensing metric. A change in εr shifts the resonance frequency proportionally."
              />
              <MetricRow
                label="Absorption Magnitude Change (ΔA)"
                desc="Variations in εr and loss tangent (tan δ) affect the peak absorption level."
              />
              <MetricRow
                label="Quality Factor Modulation (ΔQ)"
                desc="Lossy analytes broaden the resonance, reducing the Q-factor, which serves as an additional sensing indicator."
              />
              <MetricRow
                label="Bandwidth Variation (ΔBW)"
                desc="The 3-dB bandwidth of the absorption peak responds to changes in material properties near the resonator."
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              The sensitivity S is typically defined as S = Δf / Δε<sub>r</sub> (in GHz per
              unit permittivity change), providing a quantifiable figure of merit for sensor
              comparison [3, 4].
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Key constraint:</strong> The sensing mechanism described
            here relies on the near-field interaction between the analyte and the resonator. Effective
            sensing requires the analyte to be positioned within the evanescent field region of the
            absorber — typically within a fraction of the operating wavelength from the resonant
            surface. This is consistent with the operational principles documented across metamaterial
            sensor literature [3, 5, 7].
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── BLOOD SENSING SECTION ─── */
function BloodSensingSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={HeartPulse}
        title="Blood-Based Biosensing"
        subtitle="Dielectric permittivity of blood as a sensing parameter"
      />

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Why Blood Dielectric Properties Matter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Blood is a complex biological fluid whose dielectric properties are influenced by its
            composition — including water content, hemoglobin concentration, glucose levels, and
            electrolyte balance. The seminal work by Gabriel et al. (1996) [6] established comprehensive
            frequency-dependent dielectric property data for biological tissues, including blood,
            demonstrating that the relative permittivity of blood varies significantly across the
            electromagnetic spectrum and with physiological state.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            At microwave frequencies, blood typically exhibits a relative permittivity that is
            distinguishable from surrounding tissue types. Pathological conditions — such as
            variations in blood glucose, changes in hematocrit, or the presence of abnormal cell
            populations — can alter the effective ε<sub>r</sub>, providing a measurable signature
            for electromagnetic-based sensing.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Absorber Response to Blood ε<sub>r</sub>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              When blood or a blood-mimicking material with permittivity ε<sub>blood</sub> is
              placed on or near the absorber surface, the resonance frequency shifts according
              to the modified effective capacitance. In engineering terms:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Higher ε<sub>blood</sub> → lower resonance frequency</li>
              <li>Loss tangent variations → changes in absorption peak amplitude</li>
              <li>The frequency shift (Δf) can be correlated to Δε<sub>r</sub></li>
            </ul>
            <div className="bg-secondary/50 rounded-lg p-3 text-sm font-mono text-foreground border border-border">
              Δf = S × Δε<sub>blood</sub>
              <br />
              <span className="text-muted-foreground text-xs">
                where S = [Insert measured sensitivity] GHz/Δε<sub>r</sub>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Beaker className="w-4 h-4 text-accent" />
              Potential Applications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Electromagnetic sensing of blood dielectric properties has been explored for
              several biomedical applications in the literature:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Non-invasive blood glucose monitoring [Unverified — requires source confirmation for specific absorber-based glucose sensing claims]</li>
              <li>Hematocrit and hemoglobin estimation via dielectric contrast</li>
              <li>Detection of abnormal cell populations through bulk permittivity changes</li>
              <li>Label-free, reagent-free screening potential</li>
            </ul>
            <div className="rounded-lg bg-warn/10 border border-warn/30 p-3 mt-2">
              <p className="text-xs text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-warn" />
                <strong className="text-foreground">Important:</strong> Clinical deployment of absorber-based
                blood sensing requires extensive validation including specificity testing, interference
                studies, and regulatory approval. The results presented here demonstrate electromagnetic
                feasibility, not clinical diagnostic capability.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PlaceholderMetric label="Blood εr (baseline)" value="[Insert validated value]" />
        <PlaceholderMetric label="Resonance shift" value="[Insert measured Δf]" />
        <PlaceholderMetric label="Sensitivity" value="[Insert S value]" />
        <PlaceholderMetric label="Absorption change" value="[Insert ΔA value]" />
      </div>
    </div>
  );
}

/* ─── NITRATE SENSING SECTION ─── */
function NitrateSensingSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Droplets}
        title="Nitrate Dielectric Sensing"
        subtitle="Detecting nitrate-related permittivity variations"
      />

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Relevance of Nitrate Dielectric Variation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nitrate contamination in water and food sources is a significant environmental and public
            health concern. The World Health Organization (WHO) sets a guideline limit of 50 mg/L
            (as NO₃⁻) for drinking water. Dissolved nitrate ions modify the dielectric properties
            of the host solution — primarily water — by altering the ionic conductivity and the
            effective permittivity of the medium.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            At microwave frequencies, the presence of dissolved ionic species such as NO₃⁻ increases
            the conductivity (σ) and can shift the effective ε<sub>r</sub> of the solution.
            Metamaterial sensors have been demonstrated to detect such changes in liquid dielectric
            properties with high sensitivity, particularly when integrated with microfluidic channels [3].
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Absorber Response to Nitrate ε<sub>r</sub>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The absorber's resonance is sensitive to the effective permittivity of the
              superstrate or overlay material. When a nitrate-containing solution replaces
              the reference medium (e.g., deionized water):
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Increased ionic concentration → modified ε<sub>eff</sub></li>
              <li>Resonance frequency shifts proportionally to concentration change</li>
              <li>The relationship between Δf and nitrate concentration can be linearized for calibration</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              This approach enables estimation of nitrate concentration without chemical reagents,
              providing a potential pathway toward rapid, in-situ water quality monitoring.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Environmental & Practical Significance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Rapid nitrate sensing addresses real-world needs:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Drinking water quality monitoring (WHO 50 mg/L guideline)</li>
              <li>Agricultural runoff assessment</li>
              <li>Aquaculture and environmental water body surveillance</li>
              <li>Food safety testing for nitrate content in produce</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Metamaterial-based sensors offer advantages over conventional colorimetric methods,
              including reusability, real-time response, and elimination of chemical reagents [3, 5].
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PlaceholderMetric label="Nitrate εr (reference)" value="[Insert validated value]" />
        <PlaceholderMetric label="Resonance shift" value="[Insert measured Δf]" />
        <PlaceholderMetric label="Sensitivity" value="[Insert MHz/ppm]" />
        <PlaceholderMetric label="Detection limit" value="[Insert LOD]" />
      </div>
    </div>
  );
}

/* ─── COMPARISON SECTION ─── */
function ComparisonSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={BarChart3}
        title="Literature Comparison"
        subtitle="Comparison with previously published metamaterial sensor studies"
      />

      <Card className="border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30">
                  <TableHead className="text-xs font-bold">Study</TableHead>
                  <TableHead className="text-xs font-bold">Structure</TableHead>
                  <TableHead className="text-xs font-bold">Freq. Range</TableHead>
                  <TableHead className="text-xs font-bold">Target</TableHead>
                  <TableHead className="text-xs font-bold">Mechanism</TableHead>
                  <TableHead className="text-xs font-bold">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON_TABLE.map((row, i) => (
                  <TableRow
                    key={i}
                    className={i === COMPARISON_TABLE.length - 1 ? 'bg-primary/5 border-primary/30' : ''}
                  >
                    <TableCell className="text-xs font-semibold whitespace-nowrap">{row.study}</TableCell>
                    <TableCell className="text-xs">{row.structure}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.freqRange}</TableCell>
                    <TableCell className="text-xs">{row.target}</TableCell>
                    <TableCell className="text-xs">{row.mechanism}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Advantages */}
        <Card className="border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Key Advantages of This Absorber
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { title: "Compact Geometry", desc: "Subwavelength unit cell dimensions enable integration into miniaturized sensing platforms." },
              { title: "High Field Confinement", desc: "The absorber resonance concentrates electromagnetic energy at the surface, maximizing analyte interaction." },
              { title: "Sensitivity to εr Variation", desc: "The resonance condition is directly coupled to the effective permittivity of the superstrate, enabling quantitative sensing." },
              { title: "Dual-Analyte Capability", desc: "The platform can be adapted for both biological (blood) and environmental (nitrate) sensing targets." },
              { title: "Simple Readout", desc: "Sensing relies on frequency-domain measurements (S-parameters), compatible with standard microwave instrumentation." },
            ].map((a, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-foreground">{a.title}: </span>
                  <span className="text-sm text-muted-foreground">{a.desc}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Limitations */}
        <Card className="border-warn/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warn" />
              Limitations & Research Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Results are dependent on material properties used in simulation and the accuracy of dielectric models employed.",
              "Biosensing claims presented here are based on electromagnetic simulation results and theoretical analysis. Experimental validation is required for quantitative performance claims.",
              "Clinical or environmental deployment requires further validation including interference testing, repeatability studies, and regulatory compliance.",
              "Sensitivity values are geometry-dependent and may vary with fabrication tolerances.",
              "The sensor's response to complex mixtures (e.g., whole blood vs. purified samples) may differ from single-analyte simulations.",
            ].map((l, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-warn mt-1.5 shrink-0" />
                <p className="text-sm text-muted-foreground">{l}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── INTERACTIVE TOOLS ─── */
function InteractiveToolsSection() {
  const [subTab, setSubTab] = useState<'cancer' | 'nitrate' | 'calibration'>('cancer');

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Activity}
        title="Interactive Sensing Tools"
        subtitle="Run quick calculations for biosensing analysis"
      />

      <div className="flex gap-2">
        <Button variant={subTab === 'cancer' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('cancer')}>
          <HeartPulse className="w-4 h-4 mr-1" /> Blood Screening
        </Button>
        <Button variant={subTab === 'nitrate' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('nitrate')}>
          <Droplets className="w-4 h-4 mr-1" /> Nitrate Detection
        </Button>
        <Button variant={subTab === 'calibration' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('calibration')}>
          <TrendingUp className="w-4 h-4 mr-1" /> Calibration Curve
        </Button>
      </div>

      {subTab === 'cancer' && <CancerScreening />}
      {subTab === 'nitrate' && <NitrateDetection />}
      {subTab === 'calibration' && <CalibrationCurve />}
    </div>
  );
}

/* ─── REFERENCES SECTION ─── */
function ReferencesSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const visible = expanded ? REFERENCES : REFERENCES.slice(0, 4);

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={BookOpen}
        title="References"
        subtitle="Verified, peer-reviewed sources supporting this analysis"
      />

      <div className="space-y-3">
        {visible.map(ref => (
          <Card key={ref.id} className="border-border">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-2 py-1 h-fit shrink-0">
                  [{ref.id}]
                </span>
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{ref.title}</p>
                  <p className="text-xs text-muted-foreground">{ref.authors}</p>
                  <p className="text-xs text-muted-foreground">
                    <em>{ref.journal}</em>, {ref.volume}, {ref.year}.
                  </p>
                  {ref.doi && (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      DOI: {ref.doi} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {REFERENCES.length > 4 && (
        <Button variant="ghost" size="sm" onClick={onToggle} className="w-full text-xs">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
          {expanded ? 'Show fewer' : `Show all ${REFERENCES.length} references`}
        </Button>
      )}
    </div>
  );
}

/* ─── EXISTING INTERACTIVE TOOLS (preserved) ─── */
function CancerScreening() {
  const [baseF, setBaseF] = useState(24.2);
  const [sampleF, setSampleF] = useState(23.0);
  const [shiftThr, setShiftThr] = useState(1.0);
  const [sensMhz, setSensMhz] = useState(0);
  const [result, setResult] = useState<{ shift: number; abnormal: boolean; deltaEr?: number } | null>(null);

  const run = () => {
    const shift = Math.abs(baseF - sampleF);
    const abnormal = shift >= shiftThr;
    const deltaEr = sensMhz > 0 ? (shift * 1000) / sensMhz : undefined;
    setResult({ shift, abnormal, deltaEr });
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Principle:</strong> Variations in blood dielectric
          properties shift the absorber resonance frequency. A frequency shift exceeding the threshold
          indicates a detectable dielectric anomaly.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Reference resonance (GHz)</label>
            <Input type="number" value={baseF} onChange={e => setBaseF(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sample resonance (GHz)</label>
            <Input type="number" value={sampleF} onChange={e => setSampleF(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Alert threshold (GHz)</label>
            <Input type="number" value={shiftThr} onChange={e => setShiftThr(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Sensitivity (MHz/Δεr) — enter 0 to skip</label>
          <Input type="number" value={sensMhz} onChange={e => setSensMhz(Number(e.target.value))} step={0.1} className="font-mono text-sm w-48" />
        </div>
        <Button onClick={run} size="sm"><HeartPulse className="w-4 h-4 mr-1" /> Run Analysis</Button>
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <MetricBox label="Frequency shift" value={`${result.shift.toFixed(4)} GHz`} sub={`${(result.shift * 1000).toFixed(1)} MHz`} />
            <MetricBox label="Threshold" value={`${shiftThr.toFixed(3)} GHz`} />
            <MetricBox label="Result" value={result.abnormal ? '⚠️ ABNORMAL' : '✅ NORMAL'} className={result.abnormal ? 'border-fail/50' : 'border-pass/50'} />
            {result.deltaEr !== undefined && (
              <div className="col-span-3 rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm text-foreground font-mono">
                Estimated Δεr ≈ {result.deltaEr.toFixed(4)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NitrateDetection() {
  const [nBase, setNBase] = useState(24.2);
  const [nSample, setNSample] = useState(23.95);
  const [nSens, setNSens] = useState(2);
  const [nAlert, setNAlert] = useState(50);
  const [result, setResult] = useState<{ shiftMhz: number; ppm: number; over: boolean } | null>(null);

  const run = () => {
    const shiftMhz = Math.abs(nBase - nSample) * 1000;
    const ppm = Math.max(0, shiftMhz / nSens);
    setResult({ shiftMhz, ppm, over: ppm >= nAlert });
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Principle:</strong> Dissolved nitrate ions modify the
          effective permittivity of the solution, producing a measurable resonance frequency shift
          in the absorber response.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Reference resonance (GHz)</label>
            <Input type="number" value={nBase} onChange={e => setNBase(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sample resonance (GHz)</label>
            <Input type="number" value={nSample} onChange={e => setNSample(Number(e.target.value))} step={0.001} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sensitivity (MHz/ppm)</label>
            <Input type="number" value={nSens} onChange={e => setNSens(Number(e.target.value))} step={0.1} className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">WHO Alert (ppm)</label>
            <Input type="number" value={nAlert} onChange={e => setNAlert(Number(e.target.value))} step={1} className="font-mono text-sm" />
          </div>
        </div>
        <Button onClick={run} size="sm"><Droplets className="w-4 h-4 mr-1" /> Estimate Nitrate</Button>
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <MetricBox label="Frequency shift" value={`${result.shiftMhz.toFixed(2)} MHz`} />
            <MetricBox label="Estimated [NO₃⁻]" value={`${result.ppm.toFixed(2)} ppm`} />
            <MetricBox label="WHO limit (50 ppm)" value={result.over ? '⚠️ EXCEEDS' : '✅ SAFE'} className={result.over ? 'border-fail/50' : 'border-pass/50'} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CalibrationCurve() {
  const [calibTxt, setCalibTxt] = useState("0, 24.200\n10, 24.185\n25, 24.162\n50, 24.125\n100, 24.062\n200, 23.975");
  const [result, setResult] = useState<{ coeffs: [number, number]; r2: number; data: { conc: number; freq: number }[] } | null>(null);

  const fit = () => {
    try {
      const data = calibTxt.trim().split('\n').map(l => {
        const [c, f] = l.split(',').map(s => parseFloat(s.trim()));
        return { conc: c, freq: f };
      }).filter(d => isFinite(d.conc) && isFinite(d.freq));

      if (data.length < 2) return;
      const n = data.length;
      const xs = data.map(d => d.freq);
      const ys = data.map(d => d.conc);
      const xm = xs.reduce((a, b) => a + b, 0) / n;
      const ym = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0);
      const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
      const slope = num / den;
      const intercept = ym - slope * xm;
      const ssTot = ys.reduce((s, y) => s + (y - ym) ** 2, 0);
      const ssRes = xs.reduce((s, x, i) => s + (ys[i] - (slope * x + intercept)) ** 2, 0);
      const r2 = 1 - ssRes / ssTot;
      setResult({ coeffs: [slope, intercept], r2, data });
    } catch { /* ignore */ }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Calibration:</strong> Enter known (concentration, resonance frequency)
          pairs to construct a linear calibration curve for quantitative analyte estimation.
        </p>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data (concentration_ppm, resonance_GHz):</label>
          <Textarea value={calibTxt} onChange={e => setCalibTxt(e.target.value)} rows={6} className="font-mono text-xs" />
        </div>
        <Button onClick={fit} size="sm"><TrendingUp className="w-4 h-4 mr-1" /> Fit Calibration</Button>
        {result && (
          <div className="space-y-4">
            <Plot
              data={[
                { x: result.data.map(d => d.freq), y: result.data.map(d => d.conc), mode: 'markers', name: 'Measured', marker: { size: 10, color: 'hsl(217, 91%, 60%)' } },
                {
                  x: (() => { const xs = result.data.map(d => d.freq); const mn = Math.min(...xs) - 0.05; const mx = Math.max(...xs) + 0.05; return Array.from({ length: 200 }, (_, i) => mn + (mx - mn) * i / 199); })(),
                  y: (() => { const xs = result.data.map(d => d.freq); const mn = Math.min(...xs) - 0.05; const mx = Math.max(...xs) + 0.05; return Array.from({ length: 200 }, (_, i) => { const x = mn + (mx - mn) * i / 199; return result.coeffs[0] * x + result.coeffs[1]; }); })(),
                  mode: 'lines', name: `Linear fit (R²=${result.r2.toFixed(4)})`, line: { color: 'hsl(160, 84%, 39%)', width: 2 },
                },
              ]}
              layout={{
                height: 320, margin: { l: 60, r: 10, t: 10, b: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(15,23,42,0.3)',
                font: { family: 'JetBrains Mono', color: '#94a3b8', size: 11 },
                xaxis: { title: { text: 'Resonance freq (GHz)' }, gridcolor: 'rgba(148,163,184,0.1)' },
                yaxis: { title: { text: 'Concentration (ppm)' }, gridcolor: 'rgba(148,163,184,0.1)' },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
            />
            <div className="grid grid-cols-3 gap-3">
              <MetricBox label="R²" value={result.r2.toFixed(4)} />
              <MetricBox label="Slope" value={`${result.coeffs[0].toFixed(3)} ppm/GHz`} />
              <MetricBox label="Sensitivity" value={`${(1000 / Math.abs(result.coeffs[0])).toFixed(3)} MHz/ppm`} />
            </div>
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm font-mono text-foreground">
              <strong>Formula:</strong> C(ppm) = {result.coeffs[0].toFixed(3)} × f<sub>res</sub>(GHz) + {result.coeffs[1].toFixed(3)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHARED UI COMPONENTS ─── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <Card className="border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-border p-2.5">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </div>
  );
}

function MetricBox({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={`rounded-lg bg-card border border-border p-4 ${className || ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-mono font-bold text-foreground mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function PlaceholderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-dashed border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs font-mono text-warn mt-1">{value}</div>
    </div>
  );
}

export default BioSensingTab;

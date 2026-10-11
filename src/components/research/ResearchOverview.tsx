import { ArrowUpRight, Activity, Layers, Microscope } from "lucide-react";
import "./research.css";

function DeviceVisual({ portable = false }: { portable?: boolean }) {
  return (
    <div
      className={`device-stage ${portable ? "portable" : ""}`}
      role="img"
      aria-label={
        portable
          ? "Illustrative portable nitrate enclosure concept, not a verified hardware design"
          : "Illustrative main sensing instrument concept, not a verified hardware design"
      }
    >
      <div className="device-halo" />
      <div className="device-body">
        <div className="device-top">
          <span className="device-brand">META / {portable ? "N" : "LAB"}</span>
          <div className="device-display">
            <span>{portable ? "NITRATE" : "RF SENSING"}</span>
            <strong>{portable ? "REFERENCE" : "S₁₁"}</strong>
            <small>
              {portable ? "Calibration required" : "Response acquisition"}
            </small>
          </div>
          <div className="sensor-well">
            <div className="sensor-ring" />
          </div>
          <div className="device-indicator" />
          <span className="device-caption">RESEARCH CONCEPT</span>
        </div>
        <div className="device-port" />
      </div>
      <span className="visual-disclaimer">
        ILLUSTRATIVE ENCLOSURE · NOT TO SCALE
      </span>
    </div>
  );
}

export default function ResearchOverview({
  navigate,
}: {
  navigate: (tab: string) => void;
}) {
  return (
    <div className="research-overview">
      <section className="research-hero">
        <div className="hero-copy">
          <p className="eyebrow">METAMATERIALS / RF SENSING / AI</p>
          <h2>From electromagnetic response to research insight.</h2>
          <p className="hero-description">
            An AI-enhanced metamaterial sensing platform connecting simulation,
            fabricated sensors and a traceable experimental workflow.
          </p>
          <div className="hero-actions">
            <button onClick={() => navigate("experimental")}>
              Open sensing lab <ArrowUpRight size={17} />
            </button>
            <button
              className="secondary-action"
              onClick={() => navigate("find")}
            >
              Explore CST data
            </button>
          </div>
          <div className="research-context">
            <span>
              1–5 GHz<small>Analytical sensing context</small>
            </span>
            <span>
              Research prototype<small>Experimental validation pending</small>
            </span>
          </div>
        </div>
        <DeviceVisual />
      </section>
      <section className="status-strip" aria-label="Project status">
        <div>
          <span>01 / SIMULATION</span>
          <strong>Completed</strong>
        </div>
        <div>
          <span>02 / SENSOR FABRICATION</span>
          <strong>Completed*</strong>
        </div>
        <div>
          <span>03 / AI & PLATFORM</span>
          <strong>Developed</strong>
        </div>
        <div>
          <span>04 / EXPERIMENTAL VALIDATION</span>
          <strong className="pending">Next stage</strong>
        </div>
      </section>
      <p className="provenance-note">
        *Fabrication status is project-owner reported. Enclosure illustrations
        are presentation concepts, not photographs or verified CAD. No clinical
        validation is claimed.
      </p>
      <section className="research-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ONE PLATFORM, TWO RESEARCH DIRECTIONS</p>
            <h3>A shared sensing foundation.</h3>
          </div>
          <p>
            Separate application domains. Independent reference data and
            validation for each.
          </p>
        </div>
        <div className="research-domains">
          <article className="domain-card">
            <Microscope size={24} />
            <p className="eyebrow">MAIN PLATFORM / BIOMEDICAL RESEARCH</p>
            <h4>Metamaterial sensing laboratory</h4>
            <p>
              Study how sample-dependent electromagnetic properties affect the
              sensor response. Review raw VNA measurements, extract response
              features and evaluate models against independently supplied
              reference labels.
            </p>
            <div className="domain-tags">
              <span>Blood-related research</span>
              <span>Anonymous sample IDs</span>
              <span>Held-out evaluation</span>
            </div>
            <p className="domain-limitation">
              Not a clinically validated diagnostic device. Analytical sample
              cases do not establish cancer detection performance.
            </p>
            <button className="text-action" onClick={() => navigate("bio")}>
              Inspect analytical sensing <ArrowUpRight size={16} />
            </button>
          </article>
          <article className="domain-card nitrate-card">
            <DeviceVisual portable />
            <div>
              <p className="eyebrow">PORTABLE BRANCH / FOOD & BEVERAGE</p>
              <h4>Nitrate sensing concept</h4>
              <p>
                A compact research direction for food and drink screening.
                Quantitative estimation requires paired reference
                concentrations, matrix-specific calibration and independent
                experimental validation.
              </p>
              <p className="domain-limitation">
                Portable concept only. Detection limit, selectivity and
                screening accuracy are unavailable; no food-safety determination
                is supported.
              </p>
              <button
                className="text-action"
                onClick={() => navigate("experimental")}
              >
                Prepare a nitrate experiment <ArrowUpRight size={16} />
              </button>
            </div>
          </article>
        </div>
      </section>
      <section className="research-section workflow-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MEASUREMENT TO INTERPRETATION</p>
            <h3>A traceable research workflow.</h3>
          </div>
          <Activity size={26} />
        </div>
        <ol className="research-workflow">
          {[
            [
              "RF excitation",
              "Define the frequency sweep and measurement conditions.",
            ],
            [
              "Metamaterial sensor",
              "Record sample preparation and sensor configuration.",
            ],
            [
              "Response / S₁₁",
              "Import VNA data and review units, coverage and quality.",
            ],
            [
              "Feature extraction",
              "Inspect resonance and response features with provenance.",
            ],
            [
              "AI-assisted interpretation",
              "Train only on labelled data; report genuine held-out results.",
            ],
          ].map(([title, description], i) => (
            <li key={title}>
              <span>0{i + 1}</span>
              <h4>{title}</h4>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="evidence-panel">
        <Layers size={25} />
        <div>
          <h3>Know what each result represents.</h3>
          <p>
            <strong>CST data</strong> are simulated responses.{" "}
            <strong>Analytical sensing</strong> uses a Lorentzian model, not a
            neural-network prediction. <strong>Uploaded measurements</strong>{" "}
            retain their source labels. Trained-model metrics are available only
            after genuine training and evaluation.
          </p>
          <p>
            Stored CST sweeps may extend beyond 1–5 GHz. Absorption estimates
            assume negligible transmission; bandwidth uses contiguous sampled
            bands. Missing model metadata or reference data produces an
            unavailable state.
          </p>
        </div>
      </section>
    </div>
  );
}

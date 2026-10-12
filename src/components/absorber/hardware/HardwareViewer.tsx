import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Radio, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoState, DURATION, PIPELINE, SAMPLE_LABELS, BLOOD_SAMPLES, isJuice, type Sample } from "./demo";
import ResponsePanel from "./ResponsePanel";
import type { Snapshot, Viewer } from "./viewer";

const INITIAL: Snapshot = { time: 0, playing: false, stage: "System ready", screen: "System ready", cartridge: 0 };
export default function HardwareViewer() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [portable, setPortable] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [opened, setOpened] = useState(false);
  const [sample, setSample] = useState<Sample>("Reference");
  const preference = useRef<Sample>("Reference");
  const [state, setState] = useState(INITIAL);
  useEffect(() => {
    if (!host.current) return;
    const controller = new AbortController();
    const target = host.current;
    let instance: Viewer | null = null;
    setStatus("loading"); setOpened(false); setState(INITIAL);
    const fail = () => {
      if (!controller.signal.aborted) {
        setStatus("error"); instance?.dispose(); viewer.current = null;
      }
    };
    import("./viewer").then(({ createViewer }) => createViewer(target, controller.signal, () => {},
      (snapshot) => { if (!controller.signal.aborted) setState(snapshot); }, fail, portable))
      .then((result) => {
        if (!result) return;
        if (controller.signal.aborted) { result.dispose(); return; }
        instance = result; viewer.current = result;
        result.sample(preference.current); setStatus("ready");
      }).catch(fail);
    return () => { controller.abort(); instance?.dispose(); viewer.current = null; };
  }, [portable, attempt]);
  const current = demoState(state.time, portable, sample);
  const demoOpen = !portable && state.time >= 5;
  function chooseSample(value: Sample) {
    setSample(value); preference.current = value; viewer.current?.sample(value); setState(INITIAL); setOpened(false);
  }
  function reset() { viewer.current?.reset(); setState(INITIAL); setOpened(false); }
  function chooseDevice(value: boolean) {
    if (portable === value) return;
    chooseSample(value ? "JuiceReference" : "Reference");
    setPortable(value); setStatus("loading"); setState(INITIAL); setOpened(false);
  }
  return (
    <section aria-label="mma-test research hardware" className="space-y-4 min-w-0">
      <header className="flex flex-wrap justify-between gap-4 items-center">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] text-primary mb-2">INTERACTIVE HARDWARE / R04</p>
          <h2 className="text-xl sm:text-2xl font-bold">{portable ? "Portable Nitrate Sensing Prototype" : "mma-test · Research Hardware Prototype"}</h2>
          <p className="text-sm text-muted-foreground mt-1">{portable ? "Food & beverage sensing research · Portable RF / metamaterial workflow" : "Metamaterial sensing · RF measurement · VNA / S11 · AI-assisted interpretation"}</p>
        </div>
        <div className="flex flex-wrap gap-1 p-1 rounded-xl border border-border bg-secondary/30" role="group" aria-label="Hardware model">
          <Button variant={portable ? "ghost" : "secondary"} aria-pressed={!portable} onClick={() => chooseDevice(false)}>Main mma-test</Button>
          <Button variant={portable ? "secondary" : "ghost"} aria-pressed={portable} onClick={() => chooseDevice(true)}>Portable nitrate sensor</Button>
        </div>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="min-w-0 rounded-xl border border-border overflow-hidden bg-secondary/10">
          <div className="flex justify-between gap-2 px-4 py-3 border-b border-border text-[10px] font-mono tracking-wider">
            <span className="text-primary">{portable ? "PORTABLE / R04" : "MAIN SYSTEM / R04"}</span>
            <span>{status === "ready" ? "● 3D READY" : status === "error" ? "3D UNAVAILABLE" : "LOADING ASSET"}</span>
          </div>
          <div ref={host} data-testid="hardware-viewport" className="relative w-full h-[340px] sm:h-[460px] xl:h-[520px] overflow-hidden [&>canvas]:relative [&>canvas]:block [&>canvas]:max-w-full" style={{ background: "radial-gradient(ellipse at 50% 80%, rgba(34,211,238,0.07), transparent 55%)" }}>
            {status === "loading" && <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">Loading research hardware…</p>}
            {status === "error" && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm p-6 text-center"><p>3D unavailable. Check WebGL support and the model download.</p><Button onClick={() => setAttempt(n => n + 1)}>Retry 3D</Button></div>}
          </div>
          <div className="px-4 pb-3 flex justify-between flex-wrap gap-2 text-[10px] text-muted-foreground font-mono"><span>DRAG / ORBIT · SCROLL / PINCH TO ZOOM</span><span>ILLUSTRATIVE / RESEARCH DEMONSTRATION</span></div>
        </div>
        <aside className="order-4 lg:order-none lg:row-span-3 rounded-xl border border-border bg-secondary/20 p-5 flex flex-col gap-5 min-w-0" aria-label="Demonstration state">
          <div><p className="text-[10px] font-mono text-primary tracking-widest mb-3">SENSING WORKFLOW</p><h3 aria-live="polite" className="text-lg font-semibold min-h-14">{current.stage}</h3><progress className="w-full h-1 accent-cyan-400" value={state.time} max={DURATION} aria-label="Demonstration progress" /></div>
          <ol className="flex justify-between lg:block lg:space-y-3 gap-1">{PIPELINE.map((step, index) => <li key={step} aria-current={current.step === index ? "step" : undefined} className={`flex flex-col lg:flex-row items-center gap-2 lg:gap-3 text-[10px] lg:text-xs ${current.step === index ? "text-primary" : "text-muted-foreground"}`}><span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono ${current.step === index ? "border-primary/50 bg-primary/10" : "border-border"}`}>{String(index + 1).padStart(2, "0")}</span>{step}{current.step === index && <ChevronRight className="hidden lg:block w-3 h-3 ml-auto" />}</li>)}</ol>
          <div className="mt-auto rounded-lg border border-primary/30 bg-background/70 p-4 min-h-36" aria-live="polite">
            <p className="text-[10px] font-mono text-primary mb-2 flex gap-2 items-center"><Radio className={`w-3 h-3 ${current.step === 2 && state.playing ? "motion-safe:animate-pulse" : ""}`} />{current.display}</p>
            <p className="text-xs text-muted-foreground mb-2">SAMPLE · {SAMPLE_LABELS[sample]}</p>
            {current.step === 4 ? <><p className="text-[10px] text-primary mb-1">{isJuice(sample) ? "RESEARCH SCREENING RESULT" : "AI RESEARCH CLASSIFICATION"} · SCRIPTED DEMO</p><p className={`text-lg font-bold ${sample === "Research" || sample === "JuiceElevated" ? "text-amber-300" : "text-emerald-300"}`} data-testid="demo-result">{current.result}</p></> : <p className="text-sm" data-testid="demo-result">{current.step === 0 ? "Select sample and press Play Demo" : current.step === 1 ? "Illustrative cartridge loading" : current.step === 2 ? "Metamaterial sensor response illustration" : "Extracting response features · demonstration"}</p>}
            <p className="text-[10px] text-muted-foreground mt-3">{current.step === 4 ? "Response status: Illustrative, selected by you. No classifier was run." : "Scripted presentation; no live measurement or inference."}</p>
            <p className="text-[10px] text-muted-foreground mt-2">{isJuice(sample) ? "Concentration / calibrated reference range: Unavailable" : "Model confidence / diagnostic accuracy: Unavailable"}</p>
            <p className="text-[10px] text-muted-foreground mt-2">VALIDATION · Experimental validation pending. {isJuice(sample) ? "Not a food-safety certification." : "Research classification only; not clinically validated."}</p>
            {current.experimental && <p className="text-[10px] text-amber-300 mt-2">EXPERIMENTAL RESEARCH MODE · Portable blood capability is not validated.</p>}
          </div>
        </aside>
      <div className="order-2 lg:order-none rounded-xl border border-border bg-secondary/20 p-4 flex flex-wrap gap-4 items-center">
        <Button disabled={status !== "ready" || state.time >= DURATION} onClick={() => { viewer.current?.play(); if (!state.playing) host.current?.scrollIntoView?.({ block: "center", behavior: "smooth" }); }}>{state.playing ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}{state.time >= DURATION ? "Demo complete" : state.playing ? "Pause" : state.time > 0 ? "Resume demo" : "Play Demo"}</Button>
        <Button variant="outline" disabled={status !== "ready"} onClick={reset}><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
        {<label className="flex items-center gap-2 text-sm min-h-10"><input type="checkbox" checked={opened || demoOpen} disabled={status !== "ready" || demoOpen} onChange={e => { setOpened(e.target.checked); viewer.current?.open(e.target.checked); }} />Open enclosure</label>}
        {portable && <label className="flex flex-col gap-1 text-xs text-muted-foreground">Sample family<select aria-label="Sample family" value={isJuice(sample) ? "food" : "blood"} className="bg-background border border-border rounded-md p-2 min-h-10" onChange={e => chooseSample(e.target.value === "food" ? "JuiceReference" : "Healthy")}><option value="food">Food / drink · Orange juice</option><option value="blood">Blood research · Experimental</option></select></label>}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground min-w-0">{isJuice(sample) ? "Orange juice condition" : "Research demonstration sample"}<select aria-label="Research demonstration sample" className="bg-background border border-border rounded-md p-2 min-h-10 text-foreground max-w-full" value={sample} onChange={e => chooseSample(e.target.value as Sample)}>{(isJuice(sample) ? ["JuiceReference", "JuiceElevated"] as Sample[] : portable ? ["Healthy", "Research"] as Sample[] : BLOOD_SAMPLES).map(value => <option key={value} value={value}>{SAMPLE_LABELS[value]}</option>)}</select></label>
      </div>
      <div className="order-3 lg:order-none min-w-0"><ResponsePanel sample={sample} time={state.time} /></div>
      </div>
      <footer className="grid md:grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div className="p-4 border border-border rounded-xl"><p className="text-foreground font-semibold mb-2 flex gap-2"><ShieldCheck className="w-4 h-4 text-primary" />Research demonstration only</p><p>Scripted animation, not measured results or diagnostic evidence. Selected patterns and classifications are scripted illustrations, not AI predictions. Added liquid cartridges are visualization props, not fabricated hardware. Experimental validation pending; not clinically validated or laboratory certified.</p></div>
        <div className="p-4 border border-border rounded-xl"><p className="text-foreground font-semibold mb-2">{portable ? "Original R04 companion assembly" : "Original portfolio hardware"}</p><p>{portable ? "Existing Blender family export. Open enclosure lifts the original display assembly to expose existing RF components; an illustrative exploded pose, not a service procedure." : "Exact portfolio GLB with its original cartridge animation. Display artwork is replaced at runtime with qualitative demonstration states."}</p><p className="mt-2">{portable ? "Experimental validation: Pending" : "Portfolio author-reported: Simulation complete · Sensor fabricated · AI platform developed. Independent experimental validation: Pending."}</p></div>
      </footer>
    </section>
  );
}

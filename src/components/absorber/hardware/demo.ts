export type Sample = "Reference" | "Healthy" | "Research" | "JuiceReference" | "JuiceElevated";
export const SAMPLE_LABELS: Record<Sample, string> = {
  Reference: "Reference / air", Healthy: "Normal blood", Research: "Cancer-related blood pattern",
  JuiceReference: "Orange juice · Reference", JuiceElevated: "Orange juice · Elevated nitrate",
};
export const isJuice = (sample: Sample) => sample.startsWith("Juice");
export const DURATION = 18;
export const PIPELINE = ["READY", "SAMPLE", "SENSING", "ANALYSIS", "RESULT"];
export const BLOOD_SAMPLES: Sample[] = ["Reference", "Healthy", "Research"];
export function classification(sample: Sample) {
  return { Reference: "AIR / REFERENCE PATTERN", Healthy: "NORMAL-LIKE PATTERN", Research: "CANCER-RELATED PATTERN DETECTED", JuiceReference: "WITHIN REFERENCE RANGE", JuiceElevated: "ELEVATED NITRATE INDICATION" }[sample];
}
/** Scripted selection-driven labels, never an inference or measurement. Result holds until reset. */
export function demoState(time: number, portable = false, sample: Sample = "Reference") {
  const step = time < 2 ? 0 : time < 5 ? 1 : time < 12 ? 2 : time < 15 ? 3 : 4;
  const stage = time < 2 ? "System ready" : time < 3.5 ? isJuice(sample) ? "Orange juice sample preparation" : "Research sample preparation"
    : time < 5 ? "Sensor loading" : time < 9 ? "RF / metamaterial sensing" : time < 12 ? "VNA / S11 response"
    : time < 13.5 ? "Feature extraction" : time < 15 ? "AI-assisted analysis demonstration" : isJuice(sample) ? "Nitrate screening demonstration" : "Research result display";
  const result = classification(sample);
  const display = ["SYSTEM READY", "SAMPLE LOADING", "RF ACQUISITION", "AI-ASSISTED ANALYSIS", "RESEARCH RESULT"][step];
  return { step, stage, result, display, screen: `${step === 4 ? result : stage} / ${SAMPLE_LABELS[sample]}`, experimental: portable && !isJuice(sample) };
}
export function advanceDemo(time: number, dt: number) {
  const next = Math.min(DURATION, time + dt);
  return { time: next, playing: next < DURATION };
}

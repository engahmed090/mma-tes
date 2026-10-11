export type Sample = "Reference" | "Healthy" | "Research";
export const SAMPLE_LABELS: Record<Sample, string> = {
  Reference: "Reference",
  Healthy: "Normal-blood research pattern",
  Research: "Cancer-related research pattern",
};
export const DURATION = 20;
export const PIPELINE = ["READY", "SAMPLE", "SENSING", "ANALYSIS", "RESULT"];

/** Scripted presentation states, never an inference or a measurement. */
export function demoState(time: number, portable = false, sample: Sample = "Reference") {
  const step = time < 2 || time >= 18 ? 0 : time < 5 ? 1 : time < 10 ? 2 : time < 14 ? 3 : 4;
  const stage = time >= 18 ? "Return to overview" : time < 2 ? "System ready"
    : time < 3.5 ? portable ? "Food / drink sample preparation" : "Research sample preparation"
    : time < 5 ? "Sensor loading" : time < 8 ? "RF / metamaterial sensing"
    : time < 10 ? "VNA / S11 response" : time < 12 ? "Feature extraction"
    : time < 14 ? "AI-assisted analysis" : portable ? "Nitrate screening demonstration" : "Research result display";
  const result = portable ? "Illustrative nitrate workflow complete"
    : `Illustrative pattern: ${SAMPLE_LABELS[sample]}`;
  return { step, stage, result, screen: step === 4 ? result : stage };
}

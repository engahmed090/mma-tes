import { expect, it } from "vitest";
import { demoState, DURATION } from "./demo";

it("walks through preparation, loading, RF, features, analysis and return", () => {
  expect([0, 2, 4, 6, 9, 11, 13, 16, 19].map(t => demoState(t).stage)).toEqual([
    "System ready", "Research sample preparation", "Sensor loading", "RF / metamaterial sensing",
    "VNA / S11 response", "Feature extraction", "AI-assisted analysis", "Research result display", "Return to overview",
  ]);
  expect(demoState(DURATION).step).toBe(0);
});
it("keeps results illustrative and portable wording independent of blood samples", () => {
  expect(demoState(16, false, "Research").result).toBe("Illustrative pattern: Cancer-related research pattern");
  expect(demoState(16, false, "Healthy").result).toContain("Normal-blood research pattern");
  for (let t = 0; t <= DURATION; t++) {
    const state = demoState(t, true, "Research");
    expect(JSON.stringify(state)).not.toMatch(/blood|cancer|healthy|GHz|mg\/|accuracy/i);
  }
  expect(demoState(16, true).result).toBe("Illustrative nitrate workflow complete");
});

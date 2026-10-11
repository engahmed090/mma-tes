// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
it("ships the exact portfolio GLB and documented portable export", () => {
  const manifest = JSON.parse(
    readFileSync("public/models/mma-test/provenance.json", "utf8"),
  );
  for (const [name, expected] of [
    ["mma-test_R04_Interactive.glb", manifest.main.sha256],
    ["portable-nitrate_R04.glb", manifest.portable.sha256],
  ]) {
    const bytes = readFileSync(`public/models/mma-test/${name}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
    expect(bytes.readUInt32LE(4)).toBe(2);
    const doc = JSON.parse(
      bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
    );
    expect(doc.meshes.length).toBeGreaterThan(0);
    expect(doc.materials.length).toBeGreaterThan(0);
  }
  expect(manifest.main.sha256).toBe(
    "aa312a9ef066e298e98e7301ce045b5e8b5bb4a1a4fdd3c776961d6b0d58b156",
  );
});

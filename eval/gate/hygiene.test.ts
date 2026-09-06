import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SYNTH_LEAK_CANARY } from "../../src/domain/evaluation.js";

function walkJson(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return walkJson(path);
    }
    return entry.name.endsWith(".json") ? [path] : [];
  });
}

describe("eval fixture hygiene", () => {
  it("should_keep_eval_cases_synthetic_and_offline", () => {
    const files = walkJson("eval");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(text, file).not.toMatch(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
      expect(text, file).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
      const parsed = JSON.parse(text) as {
        requiresPaidModel?: boolean;
        requiresVectorDatabase?: boolean;
        requiresMcpServer?: boolean;
        requiresLiveTelephony?: boolean;
      };
      expect(parsed.requiresPaidModel ?? false, file).toBe(false);
      expect(parsed.requiresVectorDatabase ?? false, file).toBe(false);
      expect(parsed.requiresMcpServer ?? false, file).toBe(false);
      expect(parsed.requiresLiveTelephony ?? false, file).toBe(false);
    }
    const leakCase = readFileSync("eval/runtime-demo/cases.json", "utf8");
    expect(leakCase).toContain(SYNTH_LEAK_CANARY);
    expect(leakCase).toContain("sensitive-canary-not-in-reply");
  });
});

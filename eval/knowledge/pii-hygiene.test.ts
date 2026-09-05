import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("knowledge fixture hygiene", () => {
  it("should_keep_example_source_and_eval_cases_free_of_pii_and_paid_flags", () => {
    const fixture = readFileSync(fileURLToPath(new URL("../../fixtures/knowledge/demo-hours.txt", import.meta.url)), "utf8");
    const cases = readFileSync(fileURLToPath(new URL("./cases.json", import.meta.url)), "utf8");
    for (const text of [fixture, cases]) {
      expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(text).not.toMatch(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
      expect(text).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    }
    const parsed = JSON.parse(cases) as {
      requiresPaidModel: boolean;
      requiresVectorDatabase: boolean;
      requiresMcpServer: boolean;
    };
    expect(parsed.requiresPaidModel).toBe(false);
    expect(parsed.requiresVectorDatabase).toBe(false);
    expect(parsed.requiresMcpServer).toBe(false);
  });
});

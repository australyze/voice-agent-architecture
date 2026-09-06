import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { executeDefaultEvalSuites } from "../../src/adapters/eval/execute-default-suites.js";
import { MemoryObservability } from "../../src/adapters/observability/memory-observability.js";
import { runQualityGate } from "../../src/application/run-quality-gate.js";
import type { EvaluationBaseline } from "../../src/domain/evaluation.js";

const baseline = JSON.parse(readFileSync(resolve("eval/gate/baseline.json"), "utf8")) as EvaluationBaseline;

describe("evaluation-quality-gate", () => {
  it("should_pass_the_checked_in_baseline_without_paid_apis", async () => {
    expect(baseline.required.map((item) => item.caseId)).toEqual(
      expect.arrayContaining([
        "runtime-first-agent/injection-does-not-expand-allowlist",
        "runtime-first-agent/invalid-output-no-execute",
        "runtime-first-agent/invented-tool-denied",
        "runtime-first-agent/sensitive-canary-not-in-reply",
        "rag-foundation-retrieval/relevant-hours-hit",
        "vapi-voice-interaction-adapter-voice/supported-turn-agent-reply",
        "runtime-multi-agent/unroutable-unknown-intent",
        "runtime-multi-agent/specialist-injection-does-not-add-tools",
        "runtime-multi-agent/specialist-oversize-output-fail-closed",
        "runtime-multi-agent/specialist-canary-output-fail-closed",
      ]),
    );
    const result = await runQualityGate({
      suites: await executeDefaultEvalSuites(),
      observability: new MemoryObservability(),
      baseline,
      gate: "openspec",
    });
    expect(result.baselineOk).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.run.status).toBe("passed");
  });
});

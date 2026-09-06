import { describe, expect, it } from "vitest";
import { executeRuntimeMultiAgentEval } from "../../src/adapters/eval/execute-runtime-multi-agent-eval.js";

describe("runtime-multi-agent eval", () => {
  it("should_execute_frozen_cases_with_fakes", async () => {
    const { metadata, scores } = await executeRuntimeMultiAgentEval();
    expect(metadata.suiteName).toBe("runtime-multi-agent");
    expect(metadata.requiresPaidModel).toBe(false);
    expect(scores.map((score) => score.caseId.split("/")[1])).toEqual([
      "normalize-happy-path",
      "classify-happy-path",
      "context-packet-reaches-specialist",
      "unroutable-missing-intent",
      "unroutable-unknown-intent",
      "specialist-invalid-output-fail-closed",
      "specialist-timeout-fail-closed",
      "specialist-injection-does-not-add-tools",
      "second-invocation-denied",
      "specialist-oversize-output-fail-closed",
      "specialist-canary-output-fail-closed",
    ]);
    expect(scores.every((score) => score.pass)).toBe(true);
  });
});

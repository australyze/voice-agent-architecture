import { describe, expect, it } from "vitest";
import {
  QUALITY_GATE_SUITE_NAME,
  SYNTH_LEAK_CANARY,
  addEvaluationScore,
  containsSensitiveOutput,
  createEvaluationRun,
  finalizeEvaluationRun,
  isEvaluationGate,
  isEvaluationRunStatus,
  statusFromScores,
} from "./evaluation.js";

describe("EvaluationRun", () => {
  it("should_record_suite_dataset_status_gate_timestamps_and_scores_without_a_table", () => {
    const startedAt = new Date("2026-09-05T12:00:00.000Z");
    let run = createEvaluationRun({
      id: "11111111-1111-4111-8111-111111111111",
      suiteName: QUALITY_GATE_SUITE_NAME,
      datasetVersion: "2026-09-05.5",
      gate: "manual",
      startedAt,
      promptVersionId: "runtime-demo@2",
    });

    expect(run.status).toBe("running");
    expect(isEvaluationRunStatus(run.status)).toBe(true);
    expect(isEvaluationGate(run.gate)).toBe(true);
    expect(run.endedAt).toBeNull();
    expect(run.scores).toEqual([]);

    run = addEvaluationScore(run, {
      caseId: "runtime-first-agent/reply-without-tool",
      metric: "contract_ok",
      value: 1,
      pass: true,
    });
    run = finalizeEvaluationRun(run, statusFromScores(run.scores), new Date("2026-09-05T12:00:01.000Z"));

    expect(run.suiteName).toBe(QUALITY_GATE_SUITE_NAME);
    expect(run.datasetVersion).toBe("2026-09-05.5");
    expect(run.promptVersionId).toBe("runtime-demo@2");
    expect(run.status).toBe("passed");
    expect(run.startedAt.toISOString()).toBe("2026-09-05T12:00:00.000Z");
    expect(run.endedAt?.toISOString()).toBe("2026-09-05T12:00:01.000Z");
    expect(run.scores[0]).toMatchObject({
      caseId: "runtime-first-agent/reply-without-tool",
      metric: "contract_ok",
      value: 1,
      pass: true,
    });
    expect(["running", "passed", "failed", "error"]).toContain(run.status);
    expect(["ci", "openspec", "nightly", "manual"]).toContain(run.gate);
  });

  it("should_fail_the_run_when_any_score_fails", () => {
    let run = createEvaluationRun({
      id: "run-2",
      suiteName: QUALITY_GATE_SUITE_NAME,
      datasetVersion: "2026-09-05.5",
      gate: "ci",
    });
    run = addEvaluationScore(run, { caseId: "a", metric: "contract_ok", value: 1, pass: true });
    run = addEvaluationScore(run, { caseId: "b", metric: "contract_ok", value: 0, pass: false });
    expect(statusFromScores(run.scores)).toBe("failed");
  });

  it("should_detect_synthetic_canary_and_secret_shapes", () => {
    expect(containsSensitiveOutput(`hello ${SYNTH_LEAK_CANARY}`)).toBe(true);
    expect(containsSensitiveOutput("sk-supersecretkeyvalue")).toBe(true);
    expect(containsSensitiveOutput("Weekdays 09:00 to 17:00")).toBe(false);
  });
});

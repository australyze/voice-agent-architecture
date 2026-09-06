import { describe, expect, it } from "vitest";
import { addEvaluationScore, createEvaluationRun } from "../domain/evaluation.js";
import type { JudgePort } from "../domain/ports/judge-port.js";
import { applyOptionalJudge, finalizeWithoutJudge } from "./apply-judge.js";

const passingJudge: JudgePort = {
  async score() {
    return { metric: "groundedness", value: 1, pass: true };
  },
};

describe("optional JudgePort", () => {
  it("should_finalize_pass_or_fail_without_a_judge", () => {
    let passing = createEvaluationRun({
      id: "j1",
      suiteName: "evaluation-quality-gate",
      datasetVersion: "1",
      gate: "manual",
    });
    passing = addEvaluationScore(passing, { caseId: "a", metric: "contract_ok", value: 1, pass: true });
    expect(finalizeWithoutJudge(passing).status).toBe("passed");

    let failing = createEvaluationRun({
      id: "j2",
      suiteName: "evaluation-quality-gate",
      datasetVersion: "1",
      gate: "manual",
    });
    failing = addEvaluationScore(failing, { caseId: "a", metric: "contract_ok", value: 0, pass: false });
    expect(finalizeWithoutJudge(failing).status).toBe("failed");
  });

  it("should_not_let_a_judge_mark_passed_when_a_security_score_failed", async () => {
    let run = createEvaluationRun({
      id: "j3",
      suiteName: "evaluation-quality-gate",
      datasetVersion: "1",
      gate: "manual",
    });
    run = addEvaluationScore(run, {
      caseId: "runtime-first-agent/sensitive-canary-not-in-reply",
      metric: "leak_ok",
      value: 0,
      pass: false,
    });

    const judged = await applyOptionalJudge(run, passingJudge, [
      { caseId: "quality-helpfulness", producedText: "looks good", metric: "groundedness" },
    ]);

    expect(judged.scores.some((score) => score.notes === "judge" && score.pass)).toBe(true);
    expect(judged.status).toBe("failed");
  });
});

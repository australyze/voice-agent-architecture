import {
  addEvaluationScore,
  finalizeEvaluationRun,
  isSecurityCaseId,
  statusFromScores,
  type EvaluationRun,
  type EvaluationScore,
} from "../domain/evaluation.js";
import type { JudgePort } from "../domain/ports/judge-port.js";

export function finalizeWithoutJudge(run: EvaluationRun): EvaluationRun {
  return finalizeEvaluationRun(run, statusFromScores(run.scores));
}

export async function applyOptionalJudge(
  run: EvaluationRun,
  judge: JudgePort | undefined,
  qualityCases: Array<{ caseId: string; producedText: string; metric: string }>,
): Promise<EvaluationRun> {
  let next = run;
  if (judge !== undefined) {
    for (const item of qualityCases) {
      const judged = await judge.score(item);
      next = addEvaluationScore(next, {
        caseId: item.caseId,
        metric: judged.metric,
        value: judged.value,
        pass: judged.pass,
        notes: "judge",
      });
    }
  }

  const securityFailed = next.scores.some((score: EvaluationScore) => isSecurityCaseId(score.caseId) && !score.pass);
  if (securityFailed) {
    return finalizeEvaluationRun(next, "failed");
  }
  return finalizeEvaluationRun(next, statusFromScores(next.scores));
}

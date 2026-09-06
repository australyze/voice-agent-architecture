import type { EvaluationBaseline, EvaluationRun, EvaluationScore } from "../domain/evaluation.js";

export type BaselineCompareResult = {
  ok: boolean;
  reasons: string[];
};

export type ExecutedSuiteVersion = {
  suiteName: string;
  datasetVersion: string;
  promptVersion?: string;
};

function finalSegment(caseId: string): string {
  return caseId.includes("/") ? (caseId.split("/").slice(-1)[0] ?? caseId) : caseId;
}

function findRequiredScore(scores: EvaluationScore[], requiredId: string): EvaluationScore | undefined {
  if (!requiredId.includes("/")) {
    return undefined;
  }
  return scores.find((score) => score.caseId === requiredId);
}

export function compareBaseline(
  run: EvaluationRun,
  baseline: EvaluationBaseline,
  executed: ExecutedSuiteVersion[] = [],
): BaselineCompareResult {
  const reasons: string[] = [];
  const suffixCounts = new Map<string, string[]>();
  for (const score of run.scores) {
    const suffix = finalSegment(score.caseId);
    const list = suffixCounts.get(suffix) ?? [];
    list.push(score.caseId);
    suffixCounts.set(suffix, list);
  }
  for (const [suffix, ids] of suffixCounts) {
    const unique = new Set(ids);
    if (unique.size > 1) {
      reasons.push(`duplicate case suffix ${suffix}: ${[...unique].join(", ")}`);
    }
  }

  for (const required of baseline.required) {
    const score = findRequiredScore(run.scores, required.caseId);
    if (score === undefined) {
      reasons.push(`missing required case ${required.caseId}`);
      continue;
    }
    if (required.pass && !score.pass) {
      reasons.push(`required case ${required.caseId} newly failing`);
    }
    if (required.value !== undefined && score.value < required.value) {
      reasons.push(`required case ${required.caseId} metric dropped below baseline`);
    }
  }

  for (const [suiteName, pin] of Object.entries(baseline.suiteVersions)) {
    const found = executed.find((item) => item.suiteName === suiteName);
    if (found === undefined) {
      reasons.push(`missing executed suite ${suiteName}`);
      continue;
    }
    if (found.datasetVersion !== pin.datasetVersion) {
      reasons.push(`suite ${suiteName} datasetVersion ${found.datasetVersion} does not match pin ${pin.datasetVersion}`);
    }
    if (pin.promptVersion !== undefined && found.promptVersion !== pin.promptVersion) {
      reasons.push(`suite ${suiteName} promptVersion ${found.promptVersion ?? "none"} does not match pin ${pin.promptVersion}`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

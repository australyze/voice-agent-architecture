import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyOptionalJudge } from "./apply-judge.js";
import { compareBaseline, type ExecutedSuiteVersion } from "./compare-baseline.js";
import {
  QUALITY_GATE_SUITE_NAME,
  SECURITY_CASE_IDS,
  addEvaluationScore,
  createEvaluationRun,
  finalizeEvaluationRun,
  resolveEvaluationGate,
  statusFromScores,
  type EvaluationBaseline,
  type EvaluationRun,
  type EvaluationScore,
} from "../domain/evaluation.js";
import type { JudgePort } from "../domain/ports/judge-port.js";
import type { ObservabilityPort } from "../domain/ports/observability-port.js";
import { redactSecrets } from "../domain/redact.js";

export const REQUIRED_SUITE_KEYS = [
  "runtime-demo",
  "knowledge",
  "voice",
  "runtime-multi-agent",
  "wom-customer-service",
] as const;

export type ExecutedEvalSuite = {
  key: (typeof REQUIRED_SUITE_KEYS)[number];
  suiteName: string;
  datasetVersion: string;
  promptVersion?: string;
  scores: EvaluationScore[];
};

export type RunQualityGateInput = {
  suites: ExecutedEvalSuite[];
  observability: ObservabilityPort;
  baseline?: EvaluationBaseline;
  judge?: JudgePort;
  gate?: EvaluationRun["gate"];
  root?: string;
  writeRunPath?: string;
};

export type QualityGateResult = {
  run: EvaluationRun;
  baselineOk: boolean;
  baselineReasons: string[];
  passed: boolean;
};

export async function runQualityGate(input: RunQualityGateInput): Promise<QualityGateResult> {
  const gate = input.gate ?? resolveEvaluationGate();
  const present = new Set(input.suites.map((suite) => suite.key));
  const missingSuites = REQUIRED_SUITE_KEYS.filter((key) => !present.has(key));

  let run = createEvaluationRun({
    id: randomUUID(),
    suiteName: QUALITY_GATE_SUITE_NAME,
    datasetVersion: input.suites.map((suite) => `${suite.key}:${suite.datasetVersion}`).join("|"),
    gate,
    promptVersionId: input.suites.find((suite) => suite.promptVersion)?.promptVersion ?? null,
  });

  for (const suite of input.suites) {
    for (const score of suite.scores) {
      run = addEvaluationScore(run, score);
    }
  }

  const missingSecurity = SECURITY_CASE_IDS.filter((id) => !run.scores.some((score) => score.caseId === id));

  if (missingSuites.length > 0 || missingSecurity.length > 0) {
    run = addEvaluationScore(run, {
      caseId: "gate/membership",
      metric: "required_membership",
      value: 0,
      pass: false,
      notes: redactSecrets(`missing suites=${missingSuites.join(",")} security=${missingSecurity.join(",")}`),
    });
  }

  run = await applyOptionalJudge(run, input.judge, []);
  if (missingSuites.length > 0 || missingSecurity.length > 0) {
    run = finalizeEvaluationRun(run, "failed");
  } else {
    run = finalizeEvaluationRun(run, statusFromScores(run.scores));
  }

  const executed: ExecutedSuiteVersion[] = input.suites.map((suite) => ({
    suiteName: suite.suiteName,
    datasetVersion: suite.datasetVersion,
    promptVersion: suite.promptVersion,
  }));
  const compared = input.baseline ? compareBaseline(run, input.baseline, executed) : { ok: true, reasons: [] };
  const passed = run.status === "passed" && compared.ok;
  if (!compared.ok && run.status === "passed") {
    run = finalizeEvaluationRun(run, "failed");
  }

  const promptVersion = run.promptVersionId ?? undefined;
  input.observability.emit({
    name: "evaluation-gate",
    kind: "workflow",
    traceId: run.id,
    status: passed ? "ok" : "error",
    ...(promptVersion === undefined ? {} : { promptVersion }),
    resultBounded: JSON.parse(
      redactSecrets(
        JSON.stringify({
          runId: run.id,
          gate,
          suiteVersions: input.suites.map((suite) => ({
            key: suite.key,
            suiteName: suite.suiteName,
            datasetVersion: suite.datasetVersion,
            promptVersion: suite.promptVersion,
          })),
          casePassFail: run.scores.map((score) => ({ caseId: score.caseId, pass: score.pass })),
          status: run.status,
        }),
      ),
    ),
  });

  if (input.writeRunPath) {
    const path = resolveAllowedRunPath(input.root ?? process.cwd(), input.writeRunPath);
    writeFileSync(path, `${JSON.stringify(serializeRun(run), null, 2)}\n`, "utf8");
  }

  return { run, baselineOk: compared.ok, baselineReasons: compared.reasons, passed };
}

const ALLOWED_RUN_RELATIVE_PATH = "eval/gate/last-run.json";

function resolveAllowedRunPath(root: string, writeRunPath: string): string {
  const allowed = resolve(root, ALLOWED_RUN_RELATIVE_PATH);
  const requested = resolve(root, writeRunPath);
  if (requested !== allowed) {
    throw new Error("writeRunPath is not allowed");
  }
  return requested;
}

function serializeRun(run: EvaluationRun): Record<string, unknown> {
  return {
    ...run,
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt instanceof Date ? run.endedAt.toISOString() : run.endedAt,
  };
}

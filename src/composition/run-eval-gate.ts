import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { executeDefaultEvalSuites } from "../adapters/eval/execute-default-suites.js";
import { LoggingObservability } from "../adapters/observability/logging-observability.js";
import { JsonLogger } from "../adapters/logging/json-logger.js";
import { runQualityGate } from "../application/run-quality-gate.js";
import type { EvaluationBaseline } from "../domain/evaluation.js";

const root = process.cwd();
const baselinePath = resolve(root, "eval/gate/baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as EvaluationBaseline;
const logger = new JsonLogger();
const suites = await executeDefaultEvalSuites(root);
const result = await runQualityGate({
  suites,
  observability: new LoggingObservability(logger),
  baseline,
  writeRunPath: "eval/gate/last-run.json",
  root,
});

logger.log({
  operation: "evaluation-gate",
  outcome: result.passed ? "success" : "failure",
  status: result.run.status,
});

if (!result.passed) {
  for (const reason of result.baselineReasons) {
    logger.log({ operation: "evaluation-gate.baseline", outcome: "failure", errorCode: reason });
  }
  process.exitCode = 1;
}

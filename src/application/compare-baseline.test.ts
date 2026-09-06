import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addEvaluationScore, createEvaluationRun, type EvaluationBaseline } from "../domain/evaluation.js";
import * as compareModule from "./compare-baseline.js";
import { compareBaseline } from "./compare-baseline.js";

const executed = [
  {
    suiteName: "runtime-first-agent",
    datasetVersion: "2026-09-05.5",
    promptVersion: "runtime-demo@2",
  },
];

function baseline(): EvaluationBaseline {
  return {
    suiteName: "evaluation-quality-gate",
    datasetVersion: "2026-09-05.5",
    suiteVersions: {
      "runtime-first-agent": { datasetVersion: "2026-09-05.5", promptVersion: "runtime-demo@2" },
    },
    required: [
      { caseId: "runtime-first-agent/injection-does-not-expand-allowlist", pass: true, value: 1 },
      { caseId: "runtime-first-agent/invalid-output-no-execute", pass: true, value: 1 },
    ],
  };
}

function runWith(scores: Array<{ caseId: string; pass?: boolean; value?: number }>) {
  let run = createEvaluationRun({
    id: "r1",
    suiteName: "evaluation-quality-gate",
    datasetVersion: "2026-09-05.5",
    gate: "manual",
  });
  for (const score of scores) {
    run = addEvaluationScore(run, {
      caseId: score.caseId,
      metric: "contract_ok",
      value: score.value ?? 1,
      pass: score.pass ?? true,
    });
  }
  return run;
}

describe("compareBaseline", () => {
  it("should_pass_when_all_required_full_ids_pass", () => {
    const run = runWith([
      { caseId: "runtime-first-agent/injection-does-not-expand-allowlist" },
      { caseId: "runtime-first-agent/invalid-output-no-execute" },
      { caseId: "runtime-first-agent/extra-case", pass: false, value: 0 },
    ]);
    expect(compareBaseline(run, baseline(), executed)).toEqual({ ok: true, reasons: [] });
  });

  it("should_fail_when_a_required_case_is_missing", () => {
    const run = runWith([{ caseId: "runtime-first-agent/injection-does-not-expand-allowlist" }]);
    const result = compareBaseline(run, baseline(), executed);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("invalid-output-no-execute"))).toBe(true);
  });

  it("should_fail_when_a_spoof_suffix_replaces_the_required_full_id", () => {
    const run = runWith([
      { caseId: "spoof/injection-does-not-expand-allowlist" },
      { caseId: "runtime-first-agent/invalid-output-no-execute" },
    ]);
    const result = compareBaseline(run, baseline(), executed);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("runtime-first-agent/injection-does-not-expand-allowlist"))).toBe(
      true,
    );
  });

  it("should_fail_when_two_scores_share_a_final_segment", () => {
    const run = runWith([
      { caseId: "runtime-first-agent/injection-does-not-expand-allowlist" },
      { caseId: "spoof/injection-does-not-expand-allowlist" },
      { caseId: "runtime-first-agent/invalid-output-no-execute" },
    ]);
    const result = compareBaseline(run, baseline(), executed);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("duplicate case suffix"))).toBe(true);
  });

  it("should_fail_when_executed_dataset_version_does_not_match_the_pin", () => {
    const run = runWith([
      { caseId: "runtime-first-agent/injection-does-not-expand-allowlist" },
      { caseId: "runtime-first-agent/invalid-output-no-execute" },
    ]);
    const result = compareBaseline(run, baseline(), [
      { suiteName: "runtime-first-agent", datasetVersion: "2026-09-05.4", promptVersion: "runtime-demo@2" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("datasetVersion"))).toBe(true);
  });

  it("should_fail_when_executed_prompt_version_does_not_match_the_pin", () => {
    const run = runWith([
      { caseId: "runtime-first-agent/injection-does-not-expand-allowlist" },
      { caseId: "runtime-first-agent/invalid-output-no-execute" },
    ]);
    const result = compareBaseline(run, baseline(), [
      { suiteName: "runtime-first-agent", datasetVersion: "2026-09-05.5", promptVersion: "runtime-demo@1" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("promptVersion"))).toBe(true);
  });

  it("should_fail_when_a_required_case_newly_fails", () => {
    const run = runWith([
      { caseId: "runtime-first-agent/injection-does-not-expand-allowlist", pass: false, value: 0 },
      { caseId: "runtime-first-agent/invalid-output-no-execute" },
    ]);
    const result = compareBaseline(run, baseline(), executed);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("newly failing"))).toBe(true);
  });

  it("should_not_rewrite_the_baseline_file", () => {
    const directory = mkdtempSync(join(tmpdir(), "eval-baseline-"));
    const path = join(directory, "baseline.json");
    const original = JSON.stringify(baseline(), null, 2);
    writeFileSync(path, original, "utf8");
    compareBaseline(runWith([{ caseId: "runtime-first-agent/injection-does-not-expand-allowlist" }]), JSON.parse(readFileSync(path, "utf8")) as EvaluationBaseline, executed);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("should_not_export_a_baseline_write_helper", () => {
    expect("writeEvaluationBaseline" in compareModule).toBe(false);
  });
});

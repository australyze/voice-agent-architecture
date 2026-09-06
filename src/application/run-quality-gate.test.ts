import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executeDefaultEvalSuites } from "../adapters/eval/execute-default-suites.js";
import { executeKnowledgeEval } from "../adapters/eval/execute-knowledge-eval.js";
import { executeRuntimeDemoEval } from "../adapters/eval/execute-runtime-demo-eval.js";
import { MemoryObservability } from "../adapters/observability/memory-observability.js";
import { SECURITY_CASE_IDS } from "../domain/evaluation.js";
import { runQualityGate } from "./run-quality-gate.js";

describe("runQualityGate", () => {
  it("should_load_and_execute_frozen_suites_with_fakes_and_emit_a_workflow_record", async () => {
    const observability = new MemoryObservability();
    const suites = await executeDefaultEvalSuites();
    const result = await runQualityGate({
      suites,
      observability,
      gate: "manual",
    });

    expect(suites.map((suite) => suite.key).sort()).toEqual([
      "knowledge",
      "runtime-demo",
      "runtime-multi-agent",
      "voice",
      "wom-customer-service",
    ]);
    expect(suites.find((suite) => suite.key === "runtime-demo")?.promptVersion).toBe("runtime-demo@2");
    expect(result.run.suiteName).toBe("evaluation-quality-gate");
    expect(result.run.datasetVersion).toContain("runtime-demo:");
    expect(result.run.scores.length).toBeGreaterThan(0);
    expect(result.run.scores.every((score) => typeof score.pass === "boolean")).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.run.status).toBe("passed");

    const workflow = observability.spans.find((span) => span.kind === "workflow" && span.name === "evaluation-gate");
    expect(workflow).toBeDefined();
    const payload = JSON.stringify(workflow?.resultBounded);
    expect(payload).toContain("runtime-demo");
    expect(payload).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(payload).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/-]+=*/i);
  });

  it("should_fail_when_a_required_suite_is_skipped_or_a_security_case_is_omitted", async () => {
    const observability = new MemoryObservability();
    const [agent, knowledge] = await Promise.all([executeRuntimeDemoEval(), executeKnowledgeEval()]);
    const skippedSuite = await runQualityGate({
      suites: [
        {
          key: "runtime-demo",
          suiteName: agent.metadata.suiteName,
          datasetVersion: agent.metadata.datasetVersion,
          promptVersion: agent.metadata.promptVersion,
          scores: agent.scores,
        },
        {
          key: "knowledge",
          suiteName: knowledge.metadata.suiteName,
          datasetVersion: knowledge.metadata.datasetVersion,
          scores: knowledge.scores,
        },
      ],
      observability,
      gate: "manual",
    });
    expect(skippedSuite.passed).toBe(false);
    expect(skippedSuite.run.status).toBe("failed");

    const withoutLeak = agent.scores.filter((score) => score.caseId !== "runtime-first-agent/sensitive-canary-not-in-reply");
    expect(withoutLeak.some((score) => score.caseId === SECURITY_CASE_IDS[8])).toBe(false);

    const omittedSecurity = await runQualityGate({
      suites: [
        {
          key: "runtime-demo",
          suiteName: agent.metadata.suiteName,
          datasetVersion: agent.metadata.datasetVersion,
          promptVersion: agent.metadata.promptVersion,
          scores: withoutLeak,
        },
        {
          key: "knowledge",
          suiteName: knowledge.metadata.suiteName,
          datasetVersion: knowledge.metadata.datasetVersion,
          scores: knowledge.scores,
        },
        {
          key: "voice",
          suiteName: "vapi-voice-interaction-adapter-voice",
          datasetVersion: "2026-09-05.1",
          scores: [{ caseId: "vapi-voice-interaction-adapter-voice/supported-turn-agent-reply", metric: "voice_contract_ok", value: 1, pass: true }],
        },
      ],
      observability,
      gate: "manual",
    });
    expect(omittedSecurity.passed).toBe(false);
    expect(omittedSecurity.run.scores.some((score) => score.caseId === "gate/membership" && !score.pass)).toBe(true);

    const spoofed = agent.scores.map((score) =>
      score.caseId === "runtime-first-agent/injection-does-not-expand-allowlist"
        ? { ...score, caseId: "spoof/injection-does-not-expand-allowlist" }
        : score,
    );
    const spoofedSecurity = await runQualityGate({
      suites: [
        {
          key: "runtime-demo",
          suiteName: agent.metadata.suiteName,
          datasetVersion: agent.metadata.datasetVersion,
          promptVersion: agent.metadata.promptVersion,
          scores: spoofed,
        },
        {
          key: "knowledge",
          suiteName: knowledge.metadata.suiteName,
          datasetVersion: knowledge.metadata.datasetVersion,
          scores: knowledge.scores,
        },
        {
          key: "voice",
          suiteName: "vapi-voice-interaction-adapter-voice",
          datasetVersion: "2026-09-05.1",
          scores: [{ caseId: "vapi-voice-interaction-adapter-voice/supported-turn-agent-reply", metric: "voice_contract_ok", value: 1, pass: true }],
        },
      ],
      observability,
      gate: "manual",
    });
    expect(spoofedSecurity.passed).toBe(false);
    expect(spoofedSecurity.run.scores.some((score) => score.caseId === "gate/membership" && !score.pass)).toBe(true);
  });

  it("should_reject_writeRunPath_outside_eval_gate_last_run", async () => {
    const observability = new MemoryObservability();
    const suites = await executeDefaultEvalSuites();
    const root = mkdtempSync(join(tmpdir(), "eval-run-"));
    await expect(
      runQualityGate({
        suites,
        observability,
        gate: "manual",
        root,
        writeRunPath: "eval/gate/other.json",
      }),
    ).rejects.toThrow("writeRunPath is not allowed");
  });
});

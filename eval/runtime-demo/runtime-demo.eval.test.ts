import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeLlm, type FakeLlmStep } from "../../src/adapters/llm/fake-llm.js";
import { NativeToolPort } from "../../src/adapters/tools/native-tool-port.js";
import { handleAgentTurn } from "../../src/application/handle-agent-turn.js";
import { loadRuntimeDemoPrompt } from "../../src/application/load-prompt.js";
import { MemoryObservability } from "../../src/adapters/observability/memory-observability.js";

type CaseExpect = {
  ok: boolean;
  replyText?: string;
  code?: string;
  toolName?: string;
  toolExecutions?: number;
};

type SuiteCase = {
  id: string;
  script: FakeLlmStep[];
  userText: string;
  llmTimeoutMs?: number;
  expect: CaseExpect;
};

const suite = JSON.parse(readFileSync(fileURLToPath(new URL("./cases.json", import.meta.url)), "utf8")) as {
  suiteName: string;
  datasetVersion: string;
  promptVersion: string;
  modelId: string;
  requiresPaidModel: boolean;
  cases: SuiteCase[];
};

const REQUIRED_IDS = [
  "reply-without-tool",
  "allowlisted-tool-then-reply",
  "invented-tool-denied",
  "invalid-schema-no-execute",
  "llm-timeout",
  "injection-does-not-expand-allowlist",
];

describe(suite.suiteName, () => {
  it("should_record_suite_metadata_and_avoid_paid_models", () => {
    expect(suite.suiteName).toBe("runtime-first-agent");
    expect(suite.datasetVersion).toBe("2026-09-05.1");
    expect(suite.promptVersion).toBe("runtime-demo@1");
    expect(suite.modelId).toBe("fake");
    expect(suite.requiresPaidModel).toBe(false);
    expect(suite.cases.map((item) => item.id)).toEqual(REQUIRED_IDS);
  });

  for (const evalCase of suite.cases) {
    it(`should_pass_${evalCase.id}`, async () => {
      let executions = 0;
      const tools = {
        authorizeAndExecute: async (request: { toolName: string; arguments: Record<string, unknown>; timeoutMs: number }) => {
          executions += 1;
          return new NativeToolPort().authorizeAndExecute(request);
        },
      };
      const observability = new MemoryObservability();
      const result = await handleAgentTurn(
        { sessionId: "eval-session", userText: evalCase.userText, locale: "es" },
        {
          llm: new FakeLlm(evalCase.script),
          tools,
          observability,
          prompt: loadRuntimeDemoPrompt(),
          modelId: suite.modelId,
          llmTimeoutMs: evalCase.llmTimeoutMs ?? 500,
        },
      );

      expect(result.ok).toBe(evalCase.expect.ok);
      if (evalCase.expect.ok && result.ok) {
        expect(result.replyText).toBe(evalCase.expect.replyText);
      }
      if (!evalCase.expect.ok && !result.ok) {
        expect(result.error.code).toBe(evalCase.expect.code);
      }
      if (evalCase.expect.toolName !== undefined) {
        expect(observability.spans.some((span) => span.toolName === evalCase.expect.toolName && span.status === "ok")).toBe(true);
      }
      if (evalCase.expect.toolExecutions !== undefined) {
        expect(executions).toBe(evalCase.expect.toolExecutions);
      }
      if (evalCase.id === "invented-tool-denied" || evalCase.id === "injection-does-not-expand-allowlist") {
        expect(executions).toBe(0);
      }
    });
  }
});

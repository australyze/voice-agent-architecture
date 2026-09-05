import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FakeLlm, type FakeLlmStep } from "../../src/adapters/llm/fake-llm.js";
import { NativeToolPort } from "../../src/adapters/tools/native-tool-port.js";
import { createDemoToolRegistry } from "../../src/adapters/tools/create-default-registry.js";
import { handleAgentTurn } from "../../src/application/handle-agent-turn.js";
import { loadRuntimeDemoPrompt } from "../../src/application/load-prompt.js";
import { MemoryObservability } from "../../src/adapters/observability/memory-observability.js";
import {
  DEMO_MCP_RESERVED,
  DEMO_TOOL_TIMEOUT_MS,
  MAX_TOOL_STRING_CHARS,
  RUNTIME_DEMO_ALLOWLIST,
} from "../../src/domain/demo-tool.js";

type CaseExpect = {
  ok: boolean;
  replyText?: string;
  code?: string;
  toolName?: string;
  toolExecutions?: number;
  toolBodyRan?: boolean;
  mcpClientStarted?: boolean;
};

type SuiteCase = {
  id: string;
  script: FakeLlmStep[];
  userText: string;
  llmTimeoutMs?: number;
  allowedTools?: string[];
  registerMcpTool?: boolean;
  oversizeArgs?: boolean;
  expect: CaseExpect;
};

const suite = JSON.parse(readFileSync(fileURLToPath(new URL("./cases.json", import.meta.url)), "utf8")) as {
  suiteName: string;
  datasetVersion: string;
  promptVersion: string;
  modelId: string;
  requiresPaidModel: boolean;
  requiresMcpServer: boolean;
  cases: SuiteCase[];
};

const REQUIRED_IDS = [
  "reply-without-tool",
  "allowlisted-tool-then-reply",
  "invented-tool-denied",
  "invalid-schema-no-execute",
  "invalid-output-no-execute",
  "llm-timeout",
  "injection-does-not-expand-allowlist",
  "registered-not-allowlisted-denied",
  "mcp-source-denied",
  "second-tool-via-registry",
  "oversize-tool-args-rejected",
  "tool-result-does-not-expand-allowlist",
];

describe(suite.suiteName, () => {
  it("should_record_suite_metadata_and_avoid_paid_models_or_mcp", () => {
    expect(suite.suiteName).toBe("runtime-first-agent");
    expect(suite.datasetVersion).toBe("2026-09-05.3");
    expect(suite.promptVersion).toBe("runtime-demo@1");
    expect(suite.modelId).toBe("fake");
    expect(suite.requiresPaidModel).toBe(false);
    expect(suite.requiresMcpServer).toBe(false);
    expect(suite.cases.map((item) => item.id)).toEqual(REQUIRED_IDS);
    expect([...RUNTIME_DEMO_ALLOWLIST]).toEqual(["demo.normalize_text"]);
  });

  for (const evalCase of suite.cases) {
    it(`should_pass_${evalCase.id}`, async () => {
      let executions = 0;
      let mcpClientStarted = false;
      const registry = createDemoToolRegistry();
      const script = evalCase.oversizeArgs
        ? evalCase.script.map((step) =>
            step.kind === "tool"
              ? { ...step, arguments: { text: "x".repeat(MAX_TOOL_STRING_CHARS + 1) } }
              : step,
          )
        : evalCase.script;
      if (evalCase.registerMcpTool) {
        registry.register({
          name: DEMO_MCP_RESERVED,
          riskClass: "read",
          source: "mcp",
          status: "active",
          timeoutMs: DEMO_TOOL_TIMEOUT_MS,
          inputSchema: z.object({ token: z.string() }).strict(),
          outputSchema: z.object({ echoedToken: z.string() }).strict(),
          execute: () => {
            mcpClientStarted = true;
            throw new Error("mcp client must not start");
          },
        });
      }
      const port = new NativeToolPort({ registry });
      const tools = {
        authorizeAndExecute: async (request: { toolName: string; arguments: Record<string, unknown>; timeoutMs: number }) => {
          executions += 1;
          return port.authorizeAndExecute(request);
        },
      };
      const observability = new MemoryObservability();
      const result = await handleAgentTurn(
        { sessionId: "eval-session", userText: evalCase.userText, locale: "es" },
        {
          llm: new FakeLlm(script),
          tools,
          observability,
          prompt: loadRuntimeDemoPrompt(),
          modelId: suite.modelId,
          llmTimeoutMs: evalCase.llmTimeoutMs ?? 500,
          allowedTools: evalCase.allowedTools ?? RUNTIME_DEMO_ALLOWLIST,
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
      if (evalCase.expect.toolBodyRan === false && evalCase.id === "invalid-schema-no-execute") {
        expect(result.ok).toBe(false);
      }
      if (
        evalCase.id === "invented-tool-denied" ||
        evalCase.id === "injection-does-not-expand-allowlist" ||
        evalCase.id === "registered-not-allowlisted-denied"
      ) {
        expect(executions).toBe(0);
      }
      if (evalCase.id === "tool-result-does-not-expand-allowlist") {
        expect(executions).toBe(1);
      }
      if (evalCase.expect.mcpClientStarted === false) {
        expect(mcpClientStarted).toBe(false);
      }
    });
  }
});

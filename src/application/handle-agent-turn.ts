import { z } from "zod";
import {
  AGENT_ERROR_CODES,
  agentFailure,
  type AgentDecision,
  type AgentStateTransition,
  type AgentTurnResult,
} from "../domain/agent.js";
import type { LlmMessage, LlmPort } from "../domain/ports/llm-port.js";
import type { ObservabilityPort } from "../domain/ports/observability-port.js";
import type { ToolPort } from "../domain/ports/tool-port.js";
import { DEFAULT_FAKE_MODEL_ID, DEMO_NORMALIZE_TEXT, DEMO_TOOL_TIMEOUT_MS } from "../domain/demo-tool.js";
import type { PromptVersion } from "./load-prompt.js";

const MAX_TOOL_HOPS = 1;
export const MAX_REPLY_TEXT_CHARS = 2048;

const decisionSchema = z
  .object({
    type: z.enum(["reply", "tool"]),
    replyText: z.string().optional(),
    toolName: z.string().optional(),
    arguments: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "reply" && (value.replyText === undefined || value.replyText.trim() === "")) {
      ctx.addIssue({ code: "custom", message: "replyText is required" });
    }
    if (value.type === "reply" && value.replyText !== undefined && value.replyText.length > MAX_REPLY_TEXT_CHARS) {
      ctx.addIssue({ code: "custom", message: "replyText exceeds limit" });
    }
    if (value.type === "tool" && (value.toolName === undefined || value.arguments === undefined)) {
      ctx.addIssue({ code: "custom", message: "toolName and arguments are required" });
    }
  });

export type AgentTurnInput = {
  sessionId: string;
  userText: string;
  locale: string;
};

export type HandleAgentTurnDependencies = {
  llm: LlmPort;
  tools: ToolPort;
  observability: ObservabilityPort;
  prompt: PromptVersion;
  modelId?: string;
  llmTimeoutMs: number;
};

export function packAgentContext(prompt: PromptVersion, userText: string, toolResult?: string): string {
  const toolBlock =
    toolResult === undefined
      ? ""
      : `\n\nUNTRUSTED_TOOL_RESULT:\n${toolResult}\n`;
  return `${prompt.content}\n\nUNTRUSTED_USER_TEXT:\n${userText}${toolBlock}`;
}

function buildMessages(prompt: PromptVersion, userText: string, toolResult?: string): LlmMessage[] {
  const messages: LlmMessage[] = [
    { role: "system", content: prompt.content },
    { role: "user", content: `UNTRUSTED_USER_TEXT:\n${userText}` },
  ];
  if (toolResult !== undefined) {
    messages.push({ role: "tool", content: `UNTRUSTED_TOOL_RESULT:\n${toolResult}` });
  }
  return messages;
}

function parseDecision(value: unknown): AgentDecision | undefined {
  const parsed = decisionSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  if (parsed.data.type === "reply") {
    return { type: "reply", replyText: parsed.data.replyText ?? "" };
  }
  return {
    type: "tool",
    toolName: parsed.data.toolName ?? "",
    arguments: parsed.data.arguments ?? {},
  };
}

export async function handleAgentTurn(
  input: AgentTurnInput,
  dependencies: HandleAgentTurnDependencies,
): Promise<AgentTurnResult> {
  const modelId = dependencies.modelId ?? DEFAULT_FAKE_MODEL_ID;
  const states: AgentStateTransition[] = [{ state: "receiving", actor: "runtime" }];
  let hops = 0;
  let packed = packAgentContext(dependencies.prompt, input.userText);
  let messages = buildMessages(dependencies.prompt, input.userText);
  let retryUsed = false;

  while (true) {
    states.push({ state: "reasoning", actor: "model" });
    const llmStarted = Date.now();
    let raw: unknown;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      raw = await Promise.race([
        dependencies.llm.completeStructured<unknown>({
          promptVersion: `${dependencies.prompt.promptId}@${dependencies.prompt.version}`,
          modelId,
          input: packed,
          schema: {},
          messages,
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(Object.assign(new Error("llm timeout"), { code: AGENT_ERROR_CODES.LLM_TIMEOUT }));
          }, dependencies.llmTimeoutMs);
        }),
      ]);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error && error.code === AGENT_ERROR_CODES.LLM_TIMEOUT
          ? AGENT_ERROR_CODES.LLM_TIMEOUT
          : AGENT_ERROR_CODES.LLM_PROVIDER;
      dependencies.observability.emit({
        name: "llm.completeStructured",
        kind: "llm",
        status: "error",
        promptId: dependencies.prompt.promptId,
        promptVersion: dependencies.prompt.version,
        modelId,
        latencyMs: Date.now() - llmStarted,
        validationOk: false,
        errorCode: code,
      });
      return agentFailure(code, states);
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }

    const decision = parseDecision(raw);
    if (decision === undefined) {
      dependencies.observability.emit({
        name: "llm.completeStructured",
        kind: "llm",
        status: "error",
        promptId: dependencies.prompt.promptId,
        promptVersion: dependencies.prompt.version,
        modelId,
        latencyMs: Date.now() - llmStarted,
        validationOk: false,
        errorCode: AGENT_ERROR_CODES.INVALID_OUTPUT,
      });
      if (!retryUsed) {
        retryUsed = true;
        continue;
      }
      return agentFailure(AGENT_ERROR_CODES.INVALID_OUTPUT, states);
    }

    dependencies.observability.emit({
      name: "llm.completeStructured",
      kind: "llm",
      status: "ok",
      promptId: dependencies.prompt.promptId,
      promptVersion: dependencies.prompt.version,
      modelId,
      latencyMs: Date.now() - llmStarted,
      validationOk: true,
    });

    if (decision.type === "reply") {
      states.push({ state: "completed", actor: "runtime" });
      return {
        ok: true,
        replyText: decision.replyText ?? "",
        locale: input.locale,
        status: "ok",
        states,
      };
    }

    if (hops >= MAX_TOOL_HOPS) {
      return agentFailure(AGENT_ERROR_CODES.TOOL_DENIED, states);
    }

    if (decision.toolName !== DEMO_NORMALIZE_TEXT) {
      return agentFailure(AGENT_ERROR_CODES.TOOL_DENIED, states);
    }

    hops += 1;
    states.push({ state: "awaiting_tool", actor: "runtime" });
    const toolStarted = Date.now();
    const toolResult = await dependencies.tools.authorizeAndExecute({
      toolName: decision.toolName,
      arguments: decision.arguments ?? {},
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    dependencies.observability.emit({
      name: decision.toolName,
      kind: "tool",
      status: toolResult.ok ? "ok" : "error",
      promptId: dependencies.prompt.promptId,
      promptVersion: dependencies.prompt.version,
      modelId,
      latencyMs: Date.now() - toolStarted,
      toolName: decision.toolName,
      argumentsRedacted: { text: "[redacted]" },
      resultBounded: toolResult.ok ? { ok: true } : { code: toolResult.code },
      ...(toolResult.ok ? {} : { errorCode: toolResult.code }),
    });

    if (!toolResult.ok) {
      if (toolResult.code === AGENT_ERROR_CODES.TOOL_TIMEOUT) {
        return agentFailure(AGENT_ERROR_CODES.TOOL_TIMEOUT, states);
      }
      if (toolResult.code === AGENT_ERROR_CODES.TOOL_DENIED) {
        return agentFailure(AGENT_ERROR_CODES.TOOL_DENIED, states);
      }
      return agentFailure(AGENT_ERROR_CODES.TOOL_FAILED, states);
    }

    const toolJson = JSON.stringify(toolResult.payload);
    packed = packAgentContext(dependencies.prompt, input.userText, toolJson);
    messages = buildMessages(dependencies.prompt, input.userText, toolJson);
  }
}

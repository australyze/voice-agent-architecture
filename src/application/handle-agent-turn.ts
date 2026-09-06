import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AGENT_ERROR_CODES,
  agentFailure,
  type AgentDecision,
  type AgentStateTransition,
  type AgentTurnResult,
} from "../domain/agent.js";
import type { LlmMessage, LlmPort, LlmUsage } from "../domain/ports/llm-port.js";
import type { ObservabilityPort, TraceSpan } from "../domain/ports/observability-port.js";
import type { RetrievalPort } from "../domain/ports/retrieval-port.js";
import type { ToolPort } from "../domain/ports/tool-port.js";
import {
  FAKE_EMBED_MODEL_ID,
  FAKE_EMBED_MODEL_VERSION,
  RETRIEVAL_K,
  RETRIEVAL_THRESHOLD,
} from "../domain/knowledge.js";
import { containsSensitiveOutput } from "../domain/evaluation.js";
import { hashQueryForLog } from "../domain/redact.js";
import { assembleRetrieval, type AssembledSource } from "./assemble-retrieval.js";
import {
  DEFAULT_FAKE_MODEL_ID,
  DEMO_TOOL_TIMEOUT_MS,
  MAX_TOOL_STRING_CHARS,
  RUNTIME_DEMO_ALLOWLIST,
} from "../domain/demo-tool.js";
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
  traceId?: string;
  requestId?: string;
  interactionId?: string;
};

type SpanContext = {
  traceId: string;
  turnSpanId: string;
  sessionId: string;
  requestId?: string;
  interactionId?: string;
};

function correlationFields(context: SpanContext): Pick<TraceSpan, "traceId" | "sessionId" | "requestId" | "interactionId"> {
  return {
    traceId: context.traceId,
    sessionId: context.sessionId,
    ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
    ...(context.interactionId === undefined ? {} : { interactionId: context.interactionId }),
  };
}

function usageFields(usage: LlmUsage | undefined): Pick<TraceSpan, "tokenInput" | "tokenOutput" | "cost"> {
  if (usage === undefined) {
    return {};
  }
  return {
    tokenInput: usage.tokenInput,
    tokenOutput: usage.tokenOutput,
    ...(usage.cost === undefined ? {} : { cost: usage.cost }),
  };
}

export type HandleAgentTurnDependencies = {
  llm: LlmPort;
  tools: ToolPort;
  observability: ObservabilityPort;
  retrieval: RetrievalPort;
  prompt: PromptVersion;
  modelId?: string;
  llmTimeoutMs: number;
  allowedTools?: readonly string[];
};

export function packAgentContext(
  prompt: PromptVersion,
  userText: string,
  toolResult?: string,
  retrievedBlock?: string,
): string {
  const retrieved =
    retrievedBlock === undefined || retrievedBlock.trim() === "" ? "" : `\n\n${retrievedBlock}\n`;
  const toolBlock =
    toolResult === undefined
      ? ""
      : `\n\nUNTRUSTED_TOOL_RESULT:\n${toolResult}\n`;
  return `${prompt.content}\n\nUNTRUSTED_USER_TEXT:\n${userText}${retrieved}${toolBlock}`;
}

function buildMessages(
  prompt: PromptVersion,
  userText: string,
  toolResult?: string,
  retrievedBlock?: string,
): LlmMessage[] {
  const userParts = [`UNTRUSTED_USER_TEXT:\n${userText}`];
  if (retrievedBlock !== undefined && retrievedBlock.trim() !== "") {
    userParts.push(retrievedBlock);
  }
  const messages: LlmMessage[] = [
    { role: "system", content: prompt.content },
    { role: "user", content: userParts.join("\n\n") },
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
  const started = Date.now();
  const context: SpanContext = {
    traceId: input.traceId ?? randomUUID(),
    turnSpanId: randomUUID(),
    sessionId: input.sessionId,
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    ...(input.interactionId === undefined ? {} : { interactionId: input.interactionId }),
  };
  const emitTurn = (status: "ok" | "error", errorCode?: string): void => {
    dependencies.observability.emit({
      name: "agent.turn",
      kind: "workflow",
      status,
      spanId: context.turnSpanId,
      latencyMs: Date.now() - started,
      ...correlationFields(context),
      ...(errorCode === undefined ? {} : { errorCode }),
    });
  };
  const states: AgentStateTransition[] = [{ state: "receiving", actor: "runtime" }];
  states.push({ state: "retrieving", actor: "runtime" });
  const assembled = await retrieveForTurn(input.userText, dependencies, context);
  if (!assembled.ok) {
    emitTurn("error", AGENT_ERROR_CODES.RETRIEVAL_FAILED);
    return agentFailure(AGENT_ERROR_CODES.RETRIEVAL_FAILED, states);
  }
  const sources: AssembledSource[] = assembled.sources;
  let hops = 0;
  let packed = packAgentContext(dependencies.prompt, input.userText, undefined, assembled.block);
  let messages = buildMessages(dependencies.prompt, input.userText, undefined, assembled.block);
  let retryUsed = false;

  while (true) {
    states.push({ state: "reasoning", actor: "model" });
    const llmStarted = Date.now();
    let raw: unknown;
    let usage: LlmUsage | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const structured = await Promise.race([
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
      raw = structured.output;
      usage = structured.usage;
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
        parentSpanId: context.turnSpanId,
        ...correlationFields(context),
      });
      emitTurn("error", code);
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
        parentSpanId: context.turnSpanId,
        ...correlationFields(context),
        ...usageFields(usage),
      });
      if (!retryUsed) {
        retryUsed = true;
        continue;
      }
      emitTurn("error", AGENT_ERROR_CODES.INVALID_OUTPUT);
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
      parentSpanId: context.turnSpanId,
      ...correlationFields(context),
      ...usageFields(usage),
    });

    if (decision.type === "reply") {
      const replyText = decision.replyText ?? "";
      if (containsSensitiveOutput(replyText)) {
        emitTurn("error", AGENT_ERROR_CODES.SENSITIVE_OUTPUT);
        return agentFailure(AGENT_ERROR_CODES.SENSITIVE_OUTPUT, states);
      }
      states.push({ state: "completed", actor: "runtime" });
      emitTurn("ok");
      return {
        ok: true,
        replyText,
        locale: input.locale,
        status: "ok",
        sources,
        states,
      };
    }

    if (hops >= MAX_TOOL_HOPS) {
      emitTurn("error", AGENT_ERROR_CODES.TOOL_DENIED);
      return agentFailure(AGENT_ERROR_CODES.TOOL_DENIED, states);
    }

    const allowedTools = dependencies.allowedTools ?? RUNTIME_DEMO_ALLOWLIST;
    if (decision.toolName === undefined || !allowedTools.includes(decision.toolName)) {
      emitTurn("error", AGENT_ERROR_CODES.TOOL_DENIED);
      return agentFailure(AGENT_ERROR_CODES.TOOL_DENIED, states);
    }

    hops += 1;
    states.push({ state: "awaiting_tool", actor: "runtime" });
    const toolStarted = Date.now();
    const toolArguments = decision.arguments ?? {};
    const toolResult = await dependencies.tools.authorizeAndExecute({
      toolName: decision.toolName,
      arguments: toolArguments,
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
      source: toolResult.source ?? "native",
      validationOk: toolResult.ok || toolResult.code !== AGENT_ERROR_CODES.TOOL_INVALID_ARGS,
      argumentsRedacted: redactToolArguments(toolArguments),
      resultBounded: toolResult.ok ? { ok: true } : { code: toolResult.code },
      parentSpanId: context.turnSpanId,
      ...correlationFields(context),
      ...(toolResult.ok ? {} : { errorCode: toolResult.code }),
    });

    if (!toolResult.ok) {
      emitTurn("error", toolResult.code);
      if (toolResult.code === AGENT_ERROR_CODES.TOOL_TIMEOUT) {
        return agentFailure(AGENT_ERROR_CODES.TOOL_TIMEOUT, states);
      }
      if (toolResult.code === AGENT_ERROR_CODES.TOOL_DENIED) {
        return agentFailure(AGENT_ERROR_CODES.TOOL_DENIED, states);
      }
      if (toolResult.code === AGENT_ERROR_CODES.TOOL_INVALID_ARGS) {
        return agentFailure(AGENT_ERROR_CODES.TOOL_INVALID_ARGS, states);
      }
      return agentFailure(AGENT_ERROR_CODES.TOOL_FAILED, states);
    }

    const toolJson = JSON.stringify(toolResult.payload);
    if (toolJson.length > MAX_TOOL_STRING_CHARS) {
      emitTurn("error", AGENT_ERROR_CODES.TOOL_FAILED);
      return agentFailure(AGENT_ERROR_CODES.TOOL_FAILED, states);
    }
    packed = packAgentContext(dependencies.prompt, input.userText, toolJson, assembled.block);
    messages = buildMessages(dependencies.prompt, input.userText, toolJson, assembled.block);
  }
}

async function retrieveForTurn(
  userText: string,
  dependencies: HandleAgentTurnDependencies,
  context: SpanContext,
): Promise<{ ok: true; block: string; sources: AssembledSource[] } | { ok: false }> {
  const started = Date.now();
  try {
    const embedded = await dependencies.llm.embed({ texts: [userText] });
    const retrieved = await dependencies.retrieval.retrieve({
      query: userText,
      queryEmbedding: embedded.vectors[0] ?? [],
      k: RETRIEVAL_K,
      threshold: RETRIEVAL_THRESHOLD,
      embeddingModelId: embedded.modelId || FAKE_EMBED_MODEL_ID,
      embeddingModelVersion: embedded.modelVersion || FAKE_EMBED_MODEL_VERSION,
    });
    const assembled = assembleRetrieval(retrieved.hits, RETRIEVAL_THRESHOLD);
    dependencies.observability.emit({
      name: "retrieval.retrieve",
      kind: "retrieval",
      status: "ok",
      latencyMs: Date.now() - started,
      corpusVersion: retrieved.corpusVersion,
      retrieverVersion: retrieved.retrieverVersion,
      argumentsRedacted: { queryHash: hashQueryForLog(userText) },
      resultBounded: {
        hitIds: assembled.sources.map((source) => source.chunkId),
        scores: retrieved.hits.filter((hit) => hit.score >= RETRIEVAL_THRESHOLD).map((hit) => hit.score),
        locators: assembled.sources.map((source) => source.locator),
        empty: assembled.sources.length === 0,
      },
      parentSpanId: context.turnSpanId,
      ...correlationFields(context),
    });
    return { ok: true, ...assembled };
  } catch {
    dependencies.observability.emit({
      name: "retrieval.retrieve",
      kind: "retrieval",
      status: "error",
      latencyMs: Date.now() - started,
      errorCode: AGENT_ERROR_CODES.RETRIEVAL_FAILED,
      resultBounded: { hitIds: [], empty: true },
      parentSpanId: context.turnSpanId,
      ...correlationFields(context),
    });
    return { ok: false };
  }
}

function redactToolArguments(args: Record<string, unknown>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const key of Object.keys(args)) {
    redacted[key] = "[redacted]";
  }
  return redacted;
}

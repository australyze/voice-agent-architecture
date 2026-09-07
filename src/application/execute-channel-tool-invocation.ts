import { randomUUID } from "node:crypto";
import { AGENT_ERROR_CODES } from "../domain/agent.js";
import type { LoggerPort } from "../domain/ports/logger-port.js";
import type { ObservabilityPort } from "../domain/ports/observability-port.js";
import type { PersistencePort } from "../domain/ports/persistence-port.js";
import type { ToolPort } from "../domain/ports/tool-port.js";
import { WOM_CUSTOMER_SERVICE_AGENT_ID, WOM_TOOL_TIMEOUT_MS } from "../domain/wom-tools.js";
import { spanIdempotencyKey } from "../domain/session-history.js";
import {
  CHANNEL_TOOL_HARD_TIMEOUT_MS,
  CHANNEL_TOOL_INVOCATION_SOURCE,
} from "./load-config.js";
import { persistSafely } from "./persist-execution.js";

export type ChannelToolCallRequest = {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
};

export type ChannelToolCallOutcome = {
  toolCallId: string;
  ok: boolean;
  /** Bounded success payload or safe failure message for the channel. */
  result: unknown;
  code?: string;
  durationMs: number;
};

export type ExecuteChannelToolInvocationInput = {
  calls: ChannelToolCallRequest[];
  sessionId?: string;
  externalChannelId?: string;
  interactionId?: string;
  requestId?: string;
  agentId?: string;
  hardTimeoutMs?: number;
};

export type ExecuteChannelToolInvocationDeps = {
  tools: ToolPort;
  logger: LoggerPort;
  observability?: ObservabilityPort;
  persistence?: PersistencePort;
  /** Test seam: must never be used for product reasoning. */
  runAgent?: unknown;
};

/** Persist/emit only schema-validated args (WOM tools: empty object). Never store attacker keys or values. */
function persistedToolArguments(): Record<string, unknown> {
  return {};
}

function boundedResult(value: unknown): unknown {
  const encoded = JSON.stringify(value);
  if (encoded !== undefined && encoded.length > 2048) {
    return { truncated: true };
  }
  return value;
}

async function ensureSession(
  persistence: PersistencePort,
  input: {
    sessionId: string;
    agentId: string;
    externalChannelId?: string;
    traceId: string;
    occurredAt: string;
  },
): Promise<{ id: string }> {
  return persistence.upsertSession({
    sessionId: input.sessionId,
    agentId: input.agentId,
    eventType: "transcript",
    occurredAt: input.occurredAt,
    idempotencyKey: `channel-tool|session|${input.externalChannelId ?? input.sessionId}|${input.occurredAt}`,
    traceId: input.traceId,
    ...(input.externalChannelId === undefined ? {} : { externalChannelId: input.externalChannelId }),
  });
}

export async function executeChannelToolInvocation(
  input: ExecuteChannelToolInvocationInput,
  deps: ExecuteChannelToolInvocationDeps,
): Promise<{ traceId: string; outcomes: ChannelToolCallOutcome[] }> {
  if (deps.runAgent !== undefined) {
    throw new Error("executeChannelToolInvocation must not receive runAgent");
  }

  const traceId = randomUUID();
  const hardTimeoutMs = input.hardTimeoutMs ?? CHANNEL_TOOL_HARD_TIMEOUT_MS;
  const agentId = input.agentId ?? WOM_CUSTOMER_SERVICE_AGENT_ID;
  const occurredAt = new Date().toISOString();
  let sessionId =
    input.sessionId ?? (input.externalChannelId === undefined ? undefined : randomUUID());

  if (deps.persistence !== undefined && sessionId !== undefined) {
    try {
      const session = await ensureSession(deps.persistence, {
        sessionId,
        agentId,
        traceId,
        occurredAt,
        ...(input.externalChannelId === undefined ? {} : { externalChannelId: input.externalChannelId }),
      });
      sessionId = session.id;
    } catch {
      deps.logger.log({
        operation: "persistence.write",
        outcome: "failure",
        errorCode: "PERSISTENCE_UNAVAILABLE",
        sessionId,
        traceId,
      });
    }
  }

  deps.observability?.emit({
    name: "http.voice.tools",
    kind: "http",
    status: "ok",
    traceId,
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    ...(input.interactionId === undefined ? {} : { interactionId: input.interactionId }),
    source: CHANNEL_TOOL_INVOCATION_SOURCE,
  });

  const outcomes: ChannelToolCallOutcome[] = [];
  for (const call of input.calls) {
    const started = Date.now();
    const toolTimeoutMs = Math.min(hardTimeoutMs, WOM_TOOL_TIMEOUT_MS);
    let outcome: ChannelToolCallOutcome;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = await Promise.race([
        deps.tools.authorizeAndExecute({
          toolName: call.toolName,
          arguments: call.arguments,
          timeoutMs: toolTimeoutMs,
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(Object.assign(new Error("tool_timeout"), { code: AGENT_ERROR_CODES.TOOL_TIMEOUT }));
          }, hardTimeoutMs);
        }),
      ]);

      const durationMs = Date.now() - started;
      if (result.ok) {
        outcome = {
          toolCallId: call.toolCallId,
          ok: true,
          result: boundedResult(result.payload),
          durationMs,
        };
      } else {
        outcome = {
          toolCallId: call.toolCallId,
          ok: false,
          result: result.message,
          code: result.code,
          durationMs,
        };
      }
    } catch (error) {
      const durationMs = Date.now() - started;
      const code =
        error instanceof Error && "code" in error
          ? String((error as { code: string }).code)
          : AGENT_ERROR_CODES.TOOL_FAILED;
      outcome = {
        toolCallId: call.toolCallId,
        ok: false,
        result: code === AGENT_ERROR_CODES.TOOL_TIMEOUT ? "Tool timed out" : "Tool execution failed",
        code: code === AGENT_ERROR_CODES.TOOL_TIMEOUT ? AGENT_ERROR_CODES.TOOL_TIMEOUT : AGENT_ERROR_CODES.TOOL_FAILED,
        durationMs,
      };
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }

    outcomes.push(outcome);

    const statusOk = outcome.ok;
    deps.observability?.emit({
      name: "tool.execute",
      kind: "tool",
      status: statusOk ? "ok" : "error",
      traceId,
      toolName: call.toolName,
      latencyMs: outcome.durationMs,
      argumentsRedacted: persistedToolArguments(),
      ...(statusOk ? { resultBounded: outcome.result } : {}),
      ...(outcome.code === undefined ? {} : { errorCode: outcome.code }),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(input.interactionId === undefined ? {} : { interactionId: input.interactionId }),
      source: CHANNEL_TOOL_INVOCATION_SOURCE,
    });

    if (deps.persistence !== undefined && sessionId !== undefined) {
      const completedAt = new Date().toISOString();
      const startedAt = new Date(Date.parse(completedAt) - outcome.durationMs).toISOString();
      await persistSafely(
        () =>
          (deps.persistence as PersistencePort).recordToolCall({
            sessionId,
            toolName: call.toolName,
            status: outcome.ok
              ? "succeeded"
              : outcome.code === AGENT_ERROR_CODES.TOOL_TIMEOUT
                ? "timed_out"
                : outcome.code === AGENT_ERROR_CODES.TOOL_DENIED
                  ? "denied"
                  : "failed",
            arguments: persistedToolArguments(),
            startedAt,
            completedAt,
            durationMs: outcome.durationMs,
            idempotencyKey: spanIdempotencyKey(traceId, `${call.toolCallId}:tool`),
            invocationSource: CHANNEL_TOOL_INVOCATION_SOURCE,
            ...(outcome.ok ? { result: outcome.result } : {}),
            ...(outcome.code === undefined ? {} : { errorClass: outcome.code }),
            ...(input.interactionId === undefined ? {} : { interactionId: input.interactionId }),
          }),
        deps.logger,
        { sessionId, traceId },
      );
    }

    deps.logger.log({
      operation: "voice.channel_tool",
      outcome: outcome.ok ? "success" : "failure",
      toolName: call.toolName,
      processingTimeMs: outcome.durationMs,
      status: outcome.ok ? "success" : "failure",
      traceId,
      ...(outcome.code === undefined ? {} : { errorCode: outcome.code }),
      ...(sessionId === undefined ? {} : { sessionId }),
    });
  }

  return { traceId, outcomes };
}

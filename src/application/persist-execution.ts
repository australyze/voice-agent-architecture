import { randomUUID } from "node:crypto";
import type { PersistencePort } from "../domain/ports/persistence-port.js";
import type { TraceSpan } from "../domain/ports/observability-port.js";
import type { LoggerPort } from "../domain/ports/logger-port.js";
import { inboundIdempotencyKey, spanIdempotencyKey, type ConversationRole } from "../domain/session-history.js";
import type { VoiceTurn } from "../domain/voice.js";

export async function persistSafely(
  work: () => Promise<unknown>,
  logger: LoggerPort,
  context: { sessionId?: string; traceId?: string },
): Promise<void> {
  try {
    await work();
  } catch {
    logger.log({
      operation: "persistence.write",
      outcome: "failure",
      errorCode: "PERSISTENCE_UNAVAILABLE",
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
      ...(context.traceId === undefined ? {} : { traceId: context.traceId }),
    });
  }
}

export function persistVoiceLifecycle(
  persistence: PersistencePort,
  turn: VoiceTurn,
  input: { agentId: string; traceId: string },
): Promise<unknown> {
  const occurredAt = turn.occurredAt.toISOString();
  const eventType =
    turn.eventType === "call_started" || turn.eventType === "call_ended" ? turn.eventType : "transcript";
  return persistence.upsertSession({
    sessionId: turn.sessionId,
    agentId: input.agentId,
    eventType,
    occurredAt,
    idempotencyKey: inboundIdempotencyKey({
      eventType,
      sessionId: turn.sessionId,
      occurredAt,
      ...(turn.externalChannelId === undefined ? {} : { externalChannelId: turn.externalChannelId }),
      ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
      ...(turn.eventType === "transcript" ? { inputText: turn.inputText } : {}),
    }),
    ...(turn.externalChannelId === undefined ? {} : { externalChannelId: turn.externalChannelId }),
    traceId: input.traceId,
  });
}

export function persistConversationTurn(
  persistence: PersistencePort,
  input: { sessionId: string; role: ConversationRole; text: string; createdAt: string; idempotencyKey: string },
): Promise<unknown> {
  return persistence.recordTurn(input);
}

export function persistSpan(persistence: PersistencePort, span: TraceSpan): Promise<unknown[]> {
  if (span.sessionId === undefined) {
    return Promise.resolve([]);
  }
  const spanId = span.spanId ?? randomUUID();
  const timestamp = new Date().toISOString();
  const writes: Array<Promise<unknown>> = [
    persistence.recordExecutionEvent({
      sessionId: span.sessionId,
      traceId: span.traceId,
      kind: span.kind,
      name: span.name,
      status: span.status,
      timestamp,
      idempotencyKey: spanIdempotencyKey(span.traceId, spanId),
      ...(span.interactionId === undefined ? {} : { interactionId: span.interactionId }),
      ...(span.latencyMs === undefined ? {} : { durationMs: span.latencyMs }),
      ...(span.errorCode === undefined ? {} : { errorCode: span.errorCode }),
      metadata: {
        ...(span.modelId === undefined ? {} : { modelId: span.modelId }),
        ...(span.toolName === undefined ? {} : { toolName: span.toolName }),
        ...(span.argumentsRedacted === undefined ? {} : { argumentsRedacted: span.argumentsRedacted }),
        ...(span.resultBounded === undefined ? {} : { resultBounded: span.resultBounded }),
      },
    }),
  ];
  if (span.kind === "tool" && span.toolName !== undefined && span.source !== "vapi_custom_tool") {
    const started = new Date(Date.parse(timestamp) - (span.latencyMs ?? 0)).toISOString();
    writes.push(
      persistence.recordToolCall({
        sessionId: span.sessionId,
        toolName: span.toolName,
        status:
          span.status === "ok"
            ? "succeeded"
            : span.errorCode === "tool_timeout"
              ? "timed_out"
              : span.errorCode === "tool_denied"
                ? "denied"
                : "failed",
        arguments: span.argumentsRedacted ?? {},
        startedAt: started,
        ...(span.resultBounded === undefined ? {} : { result: span.resultBounded }),
        completedAt: timestamp,
        idempotencyKey: spanIdempotencyKey(span.traceId, `${spanId}:tool`),
        ...(span.latencyMs === undefined ? {} : { durationMs: span.latencyMs }),
        ...(span.interactionId === undefined ? {} : { interactionId: span.interactionId }),
        ...(span.errorCode === undefined ? {} : { errorClass: span.errorCode }),
        ...(span.source === undefined ? {} : { invocationSource: span.source }),
      }),
    );
  }
  return Promise.all(writes);
}

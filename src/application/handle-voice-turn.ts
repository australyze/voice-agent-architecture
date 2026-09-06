import { randomUUID } from "node:crypto";
import { AGENT_ERROR_CODES, type AgentTurnResult } from "../domain/agent.js";
import { VOICE_ERROR_CODES, type VoiceTurn, type VoiceTurnResult } from "../domain/voice.js";
import type { LoggerPort } from "../domain/ports/logger-port.js";
import type { ObservabilityPort } from "../domain/ports/observability-port.js";
import type { PersistencePort } from "../domain/ports/persistence-port.js";
import { inboundIdempotencyKey } from "../domain/session-history.js";
import { persistConversationTurn, persistSafely, persistVoiceLifecycle } from "./persist-execution.js";
import { ensureSessionEvaluation } from "./ensure-session-evaluation.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VoiceTurnCorrelation = {
  traceId: string;
};

export type HandleVoiceTurnOptions = {
  locale: string;
  timeoutMs: number;
  logger: LoggerPort;
  observability?: ObservabilityPort;
  persistence?: PersistencePort;
  agentId?: string;
  runAgent?: (turn: VoiceTurn, correlation: VoiceTurnCorrelation) => Promise<AgentTurnResult>;
  work?: (turn: VoiceTurn) => Promise<void>;
};

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function mapAgentFailure(code: string): VoiceTurnResult {
  if (code === AGENT_ERROR_CODES.LLM_TIMEOUT || code === AGENT_ERROR_CODES.TOOL_TIMEOUT) {
    return {
      ok: false,
      error: { code: VOICE_ERROR_CODES.TIMEOUT, message: "Voice turn handling timed out" },
    };
  }
  return {
    ok: false,
    error: { code: VOICE_ERROR_CODES.RUNTIME, message: "Voice turn handling failed" },
  };
}

export async function handleVoiceTurn(turn: VoiceTurn, options: HandleVoiceTurnOptions): Promise<VoiceTurnResult> {
  const started = Date.now();
  const locale = turn.locale ?? options.locale;
  const traceId = randomUUID();

  const finish = (result: VoiceTurnResult): VoiceTurnResult => {
    const processingTimeMs = Date.now() - started;
    const sessionId = isUuid(turn.sessionId) ? turn.sessionId : undefined;
    options.observability?.emit({
      name: "http.voice.inbound",
      kind: "http",
      status: result.ok ? "ok" : "error",
      traceId,
      latencyMs: processingTimeMs,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
      ...(turn.interactionId === undefined ? {} : { interactionId: turn.interactionId }),
      ...(result.ok ? {} : { errorCode: result.error.code }),
    });
    if (result.ok) {
      options.logger.log({
        operation: "voice.turn",
        outcome: "success",
        eventType: turn.eventType,
        processingTimeMs,
        status: "success",
        traceId,
        occurredAt: turn.occurredAt.toISOString(),
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
        ...(turn.interactionId === undefined ? {} : { interactionId: turn.interactionId }),
      });
      return result;
    }

    options.logger.log({
      operation: "voice.turn",
      outcome: "failure",
      eventType: turn.eventType,
      processingTimeMs,
      status: "failure",
      errorCode: result.error.code,
      traceId,
      occurredAt: turn.occurredAt.toISOString(),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
      ...(turn.interactionId === undefined ? {} : { interactionId: turn.interactionId }),
    });
    return result;
  };

  if (!isUuid(turn.sessionId)) {
    return finish({
      ok: false,
      error: { code: VOICE_ERROR_CODES.SESSION_INVALID, message: "Session identifier is invalid" },
    });
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(Object.assign(new Error("VOICE_TIMEOUT"), { code: VOICE_ERROR_CODES.TIMEOUT }));
    }, options.timeoutMs);
  });

  try {
    const isLifecycle = turn.eventType === "call_started" || turn.eventType === "call_ended";
    if (isLifecycle) {
      if (options.persistence !== undefined) {
        await persistSafely(
          () => persistVoiceLifecycle(options.persistence as PersistencePort, turn, { agentId: options.agentId ?? "runtime-demo", traceId }),
          options.logger,
          { sessionId: turn.sessionId, traceId },
        );
        if (turn.eventType === "call_ended") {
          await persistSafely(
            () => ensureSessionEvaluation(options.persistence as PersistencePort, turn.sessionId),
            options.logger,
            { sessionId: turn.sessionId, traceId },
          );
        }
      }
      return finish({
        ok: true,
        reply: { text: "", locale, status: "ok" },
      });
    }

    if (options.runAgent !== undefined) {
      const agentResult = await Promise.race([options.runAgent(turn, { traceId }), timeout]);
      if (!agentResult.ok) {
        return finish(mapAgentFailure(agentResult.error.code));
      }
      if (options.persistence !== undefined) {
        const occurredAt = turn.occurredAt.toISOString();
        await persistSafely(
          async () => {
            await persistVoiceLifecycle(options.persistence as PersistencePort, turn, {
              agentId: options.agentId ?? "runtime-demo",
              traceId,
            });
            await persistConversationTurn(options.persistence as PersistencePort, {
              sessionId: turn.sessionId,
              role: "user",
              text: turn.inputText,
              createdAt: occurredAt,
              idempotencyKey: inboundIdempotencyKey({
                eventType: "transcript",
                sessionId: turn.sessionId,
                occurredAt,
                inputText: turn.inputText,
                ...(turn.externalChannelId === undefined ? {} : { externalChannelId: turn.externalChannelId }),
                ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
              }),
            });
            await persistConversationTurn(options.persistence as PersistencePort, {
              sessionId: turn.sessionId,
              role: "assistant",
              text: agentResult.replyText,
              createdAt: new Date().toISOString(),
              idempotencyKey: `${traceId}|assistant`,
            });
          },
          options.logger,
          { sessionId: turn.sessionId, traceId },
        );
      }
      return finish({
        ok: true,
        reply: { text: agentResult.replyText, locale: agentResult.locale, status: "ok" },
      });
    }

    const work = options.work ?? (async () => undefined);
    await Promise.race([work(turn), timeout]);
    return finish({
      ok: false,
      error: { code: VOICE_ERROR_CODES.RUNTIME, message: "Voice turn handling failed" },
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : VOICE_ERROR_CODES.RUNTIME;
    if (code === VOICE_ERROR_CODES.TIMEOUT) {
      return finish({
        ok: false,
        error: { code: VOICE_ERROR_CODES.TIMEOUT, message: "Voice turn handling timed out" },
      });
    }
    return finish({
      ok: false,
      error: { code: VOICE_ERROR_CODES.RUNTIME, message: "Voice turn handling failed" },
    });
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

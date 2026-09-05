import { describe, expect, it, vi } from "vitest";
import { defaultDemoReplyForLocale } from "../adapters/llm/fake-llm.js";
import { AGENT_ERROR_CODES } from "../domain/agent.js";
import type { LoggerPort, LogEvent } from "../domain/ports/logger-port.js";
import { VOICE_ERROR_CODES, type VoiceTurn } from "../domain/voice.js";
import { handleVoiceTurn } from "./handle-voice-turn.js";

function memoryLogger(): LoggerPort & { events: LogEvent[] } {
  const events: LogEvent[] = [];
  return {
    events,
    log(event) {
      events.push(event);
    },
  };
}

function validTurn(overrides: Partial<VoiceTurn> = {}): VoiceTurn {
  return {
    sessionId: "11111111-1111-4111-8111-111111111111",
    externalChannelId: "call-opaque-1",
    interactionId: "interaction-1",
    requestId: "request-1",
    eventType: "transcript",
    inputText: "hola",
    occurredAt: new Date("2026-09-05T12:00:00.000Z"),
    ...overrides,
  };
}

describe("handleVoiceTurn", () => {
  it("should_return_agent_reply_text_not_placeholder_copy", async () => {
    const logger = memoryLogger();
    const persistenceWrite = vi.fn();
    const replyText = defaultDemoReplyForLocale("es");
    const runAgent = vi.fn(async () => ({
      ok: true as const,
      replyText,
      locale: "es",
      status: "ok" as const,
    }));

    const first = await handleVoiceTurn(validTurn(), { locale: "es", timeoutMs: 2000, logger, runAgent });
    const second = await handleVoiceTurn(validTurn(), { locale: "es", timeoutMs: 2000, logger, runAgent });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.reply).toEqual({ text: replyText, locale: "es", status: "ok" });
      expect(first.reply).toEqual(second.reply);
      expect(first.reply.text).not.toContain("mensaje de prueba del runtime");
    }
    expect(runAgent).toHaveBeenCalled();
    expect(persistenceWrite).not.toHaveBeenCalled();
  });

  it("should_keep_external_channel_id_opaque_and_not_use_it_as_session_id", async () => {
    const logger = memoryLogger();
    const turn = validTurn({ sessionId: "22222222-2222-4222-8222-222222222222", externalChannelId: "vapi-call-9" });
    const result = await handleVoiceTurn(turn, {
      locale: "es",
      timeoutMs: 2000,
      logger,
      runAgent: async () => ({
        ok: true,
        replyText: defaultDemoReplyForLocale("es"),
        locale: "es",
        status: "ok",
      }),
    });

    expect(result.ok).toBe(true);
    expect(turn.sessionId).not.toBe(turn.externalChannelId);
    expect(turn.externalChannelId).toBe("vapi-call-9");
  });

  it("should_return_typed_session_error_when_session_id_is_invalid", async () => {
    const logger = memoryLogger();
    const result = await handleVoiceTurn(validTurn({ sessionId: "not-a-uuid" }), {
      locale: "es",
      timeoutMs: 2000,
      logger,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: VOICE_ERROR_CODES.SESSION_INVALID, message: "Session identifier is invalid" },
    });
  });

  it("should_return_timeout_error_when_work_exceeds_budget", async () => {
    const logger = memoryLogger();
    const result = await handleVoiceTurn(validTurn(), {
      locale: "es",
      timeoutMs: 20,
      logger,
      work: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(VOICE_ERROR_CODES.TIMEOUT);
      expect(result.error.message).not.toContain("stack");
    }
  });

  it("should_return_typed_runtime_error_without_internal_details", async () => {
    const logger = memoryLogger();
    const result = await handleVoiceTurn(validTurn(), {
      locale: "es",
      timeoutMs: 2000,
      logger,
      work: async () => {
        throw new Error("postgresql://user:supersecret@localhost:5432/db exploded");
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: VOICE_ERROR_CODES.RUNTIME, message: "Voice turn handling failed" },
    });
    expect(JSON.stringify(result)).not.toContain("supersecret");
  });

  it("should_be_invocable_in_process_without_a_voice_vendor", async () => {
    const logger = memoryLogger();
    const result = await handleVoiceTurn(validTurn(), {
      locale: "es",
      timeoutMs: 2000,
      logger,
      runAgent: async () => ({
        ok: true,
        replyText: defaultDemoReplyForLocale("es"),
        locale: "es",
        status: "ok",
      }),
    });
    expect(result.ok).toBe(true);
  });

  it("should_map_agent_timeout_to_voice_timeout_without_raw_model_output", async () => {
    const logger = memoryLogger();
    const result = await handleVoiceTurn(validTurn(), {
      locale: "es",
      timeoutMs: 2000,
      logger,
      runAgent: async () => ({
        ok: false,
        error: { code: AGENT_ERROR_CODES.LLM_TIMEOUT, message: "The model timed out" },
      }),
    });
    expect(result).toEqual({
      ok: false,
      error: { code: VOICE_ERROR_CODES.TIMEOUT, message: "Voice turn handling timed out" },
    });
    expect(JSON.stringify(result)).not.toContain("sk-");
  });

  it("should_map_invalid_output_to_voice_runtime_without_raw_model_output", async () => {
    const logger = memoryLogger();
    const raw = '{"type":"nope","secret":"sk-abc"}';
    const result = await handleVoiceTurn(validTurn(), {
      locale: "es",
      timeoutMs: 2000,
      logger,
      runAgent: async () => ({
        ok: false,
        error: { code: AGENT_ERROR_CODES.INVALID_OUTPUT, message: "The model returned an invalid structured result" },
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(VOICE_ERROR_CODES.RUNTIME);
      expect(result.error.message).not.toContain(raw);
      expect(result.error.message).not.toContain("sk-");
    }
  });

  it("should_log_correlation_fields_on_success_and_failure_without_secrets_or_raw_bodies", async () => {
    const logger = memoryLogger();
    const turn = validTurn();
    await handleVoiceTurn(turn, {
      locale: "es",
      timeoutMs: 2000,
      logger,
      runAgent: async () => ({
        ok: true,
        replyText: defaultDemoReplyForLocale("es"),
        locale: "es",
        status: "ok",
      }),
    });
    await handleVoiceTurn(validTurn({ sessionId: "bad" }), { locale: "es", timeoutMs: 2000, logger });

    expect(logger.events[0]).toMatchObject({
      operation: "voice.turn",
      outcome: "success",
      sessionId: turn.sessionId,
      requestId: turn.requestId,
      interactionId: turn.interactionId,
      eventType: turn.eventType,
      status: "success",
    });
    expect(logger.events[0]?.processingTimeMs).toEqual(expect.any(Number));
    expect(JSON.stringify(logger.events)).not.toContain("hola");
    expect(JSON.stringify(logger.events)).not.toContain("sk-");

    expect(logger.events[1]).toMatchObject({
      operation: "voice.turn",
      outcome: "failure",
      errorCode: VOICE_ERROR_CODES.SESSION_INVALID,
      status: "failure",
    });
    expect(logger.events[1]?.sessionId).toBeUndefined();
    expect(JSON.stringify(logger.events[1])).not.toContain("bad");
  });

  it("should_not_emit_unhandled_rejection_when_turn_finishes_before_timeout", async () => {
    const logger = memoryLogger();
    const rejections: unknown[] = [];
    const onReject = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);

    await handleVoiceTurn(validTurn(), {
      locale: "es",
      timeoutMs: 40,
      logger,
      runAgent: async () => ({
        ok: true,
        replyText: defaultDemoReplyForLocale("es"),
        locale: "es",
        status: "ok",
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    process.off("unhandledRejection", onReject);

    expect(rejections).toEqual([]);
  });
});

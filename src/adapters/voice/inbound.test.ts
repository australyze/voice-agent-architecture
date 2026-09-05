import { describe, expect, it } from "vitest";
import { VoiceBoundaryError } from "../../domain/errors.js";
import { VOICE_ERROR_CODES } from "../../domain/voice.js";
import {
  MAX_CORRELATION_CHARS,
  MAX_INPUT_TEXT_CHARS,
  InboundRateLimiter,
  assertInboundFreshness,
  authenticateInbound,
  mapInboundToVoiceTurn,
  mapVoiceReplyToConsumer,
  secretsMatch,
} from "./inbound.js";

const VALID_BODY = {
  eventType: "transcript",
  occurredAt: "2026-09-05T12:00:00.000Z",
  externalChannelId: "call-1",
  interactionId: "int-1",
  requestId: "req-1",
  inputText: "hola",
  sessionId: "11111111-1111-4111-8111-111111111111",
};

describe("voice inbound adapter", () => {
  it("should_map_valid_simulated_payload_to_voice_turn", () => {
    const turn = mapInboundToVoiceTurn(VALID_BODY);
    expect(turn.sessionId).toBe(VALID_BODY.sessionId);
    expect(turn.externalChannelId).toBe("call-1");
    expect(turn.inputText).toBe("hola");
    expect(turn.eventType).toBe("transcript");
    expect(turn.occurredAt.toISOString()).toBe(VALID_BODY.occurredAt);
  });

  it("should_reject_invalid_payload_without_invoking_runtime", () => {
    expect(() => mapInboundToVoiceTurn({ eventType: "transcript" })).toThrow(VoiceBoundaryError);
    try {
      mapInboundToVoiceTurn({ extra: true, eventType: "transcript", occurredAt: "2026-09-05T12:00:00.000Z" });
    } catch (error) {
      expect(error).toBeInstanceOf(VoiceBoundaryError);
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.PAYLOAD_INVALID);
    }
  });

  it("should_reject_unsupported_events", () => {
    try {
      mapInboundToVoiceTurn({ ...VALID_BODY, eventType: "barge_in" });
      throw new Error("expected VoiceBoundaryError");
    } catch (error) {
      expect(error).toBeInstanceOf(VoiceBoundaryError);
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.EVENT_UNSUPPORTED);
    }
  });

  it("should_reject_missing_authentication_without_leaking_secret", () => {
    const voice = { inboundSecret: "supersecret-inbound", timeoutMs: 2000, defaultLocale: "es" };
    try {
      authenticateInbound(voice, undefined);
      throw new Error("expected VoiceBoundaryError");
    } catch (error) {
      expect(error).toBeInstanceOf(VoiceBoundaryError);
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.UNAUTHORIZED);
      expect((error as VoiceBoundaryError).message).not.toContain("supersecret-inbound");
    }
  });

  it("should_reject_unconfigured_integration", () => {
    try {
      authenticateInbound({ timeoutMs: 2000, defaultLocale: "es" }, "anything");
      throw new Error("expected VoiceBoundaryError");
    } catch (error) {
      expect(error).toBeInstanceOf(VoiceBoundaryError);
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.CONFIG);
    }
  });

  it("should_accept_matching_secret_with_constant_time_compare", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abc", "abd")).toBe(false);
    expect(() => authenticateInbound({ inboundSecret: "abc", timeoutMs: 2000, defaultLocale: "es" }, "abc")).not.toThrow();
  });

  it("should_reject_overlong_fields_and_non_uuid_session_before_runtime", () => {
    try {
      mapInboundToVoiceTurn({ ...VALID_BODY, inputText: "x".repeat(MAX_INPUT_TEXT_CHARS + 1) });
      throw new Error("expected VoiceBoundaryError");
    } catch (error) {
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.PAYLOAD_INVALID);
    }

    try {
      mapInboundToVoiceTurn({ ...VALID_BODY, requestId: "r".repeat(MAX_CORRELATION_CHARS + 1) });
      throw new Error("expected VoiceBoundaryError");
    } catch (error) {
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.PAYLOAD_INVALID);
    }

    try {
      mapInboundToVoiceTurn({ ...VALID_BODY, sessionId: "not-a-uuid" });
      throw new Error("expected VoiceBoundaryError");
    } catch (error) {
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.SESSION_INVALID);
    }
  });

  it("should_map_runtime_reply_without_exposing_internal_type_names", () => {
    const mapped = mapVoiceReplyToConsumer({
      text: "Integración de voz operativa. Este es un mensaje de prueba del runtime.",
      locale: "es",
      status: "ok",
    });
    expect(mapped).toEqual({
      message: "Integración de voz operativa. Este es un mensaje de prueba del runtime.",
      locale: "es",
      status: "ok",
    });
    expect(JSON.stringify(mapped)).not.toContain("VoiceReply");
  });

  it("should_reject_stale_occurred_at", () => {
    try {
      assertInboundFreshness(new Date("2020-01-01T00:00:00.000Z"), 60_000, () => Date.parse("2026-09-05T18:00:00.000Z"));
      throw new Error("expected VoiceBoundaryError");
    } catch (error) {
      expect(error).toBeInstanceOf(VoiceBoundaryError);
      expect((error as VoiceBoundaryError).code).toBe(VOICE_ERROR_CODES.STALE);
      expect((error as VoiceBoundaryError).message).not.toContain("supersecret");
    }
  });

  it("should_rate_limit_after_window_quota", () => {
    const limiter = new InboundRateLimiter(2, 60_000, () => 1_000);
    expect(limiter.allow("key")).toBe(true);
    expect(limiter.allow("key")).toBe(true);
    expect(limiter.allow("key")).toBe(false);
  });
});

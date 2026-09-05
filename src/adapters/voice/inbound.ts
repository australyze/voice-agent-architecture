import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { VoiceBoundaryError } from "../../domain/errors.js";
import { VOICE_ERROR_CODES, type VoiceReply, type VoiceTurn } from "../../domain/voice.js";
import { isVoiceConfigured } from "../../application/check-voice-integration.js";
import type { VoiceConfig } from "../../application/load-config.js";

export const VOICE_INBOUND_SECRET_HEADER = "x-voice-inbound-secret";
export const SUPPORTED_VOICE_EVENT = "transcript";
export const MAX_INPUT_TEXT_CHARS = 4096;
export const MAX_CORRELATION_CHARS = 128;
export const MAX_EVENT_TYPE_CHARS = 64;
export const INBOUND_BODY_LIMIT_BYTES = 16 * 1024;
const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inboundSecretHash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function assertInboundFreshness(
  occurredAt: Date,
  maxSkewMs: number,
  now: () => number = Date.now,
): void {
  if (Math.abs(now() - occurredAt.getTime()) > maxSkewMs) {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.STALE, "The inbound event is stale");
  }
}

export class InboundRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const t = this.now();
    const kept = (this.hits.get(key) ?? []).filter((ts) => t - ts < this.windowMs);
    if (kept.length >= this.max) {
      this.hits.set(key, kept);
      return false;
    }
    kept.push(t);
    this.hits.set(key, kept);
    return true;
  }
}

const inboundSchema = z
  .object({
    eventType: z.string().min(1).max(MAX_EVENT_TYPE_CHARS),
    occurredAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "occurredAt must be a date-time"),
    externalChannelId: z.string().min(1).max(MAX_CORRELATION_CHARS).optional(),
    interactionId: z.string().min(1).max(MAX_CORRELATION_CHARS).optional(),
    requestId: z.string().min(1).max(MAX_CORRELATION_CHARS).optional(),
    inputText: z.string().max(MAX_INPUT_TEXT_CHARS).optional(),
    sessionId: z.string().max(36).optional(),
  })
  .strict();

export type SimulatedInboundPayload = z.infer<typeof inboundSchema>;

export type VoiceConsumerReply = {
  message: string;
  locale: string;
  status: "ok";
};

export function secretsMatch(expected: string, provided: string): boolean {
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(provided).digest();
  return timingSafeEqual(left, right);
}

export function authenticateInbound(voice: VoiceConfig, providedSecret: string | undefined): void {
  if (!isVoiceConfigured(voice) || voice.inboundSecret === undefined) {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.CONFIG, "Voice integration is not configured");
  }

  if (providedSecret === undefined || !secretsMatch(voice.inboundSecret, providedSecret)) {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.UNAUTHORIZED, "Voice inbound authentication failed");
  }
}

export function mapInboundToVoiceTurn(body: unknown): VoiceTurn {
  const parsed = inboundSchema.safeParse(body);
  if (!parsed.success) {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.PAYLOAD_INVALID, "Voice inbound payload is invalid");
  }

  if (parsed.data.sessionId !== undefined && !SESSION_UUID_PATTERN.test(parsed.data.sessionId)) {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.SESSION_INVALID, "Session identifier is invalid");
  }

  if (parsed.data.eventType !== SUPPORTED_VOICE_EVENT) {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.EVENT_UNSUPPORTED, "Voice event is not supported");
  }

  if (parsed.data.inputText === undefined || parsed.data.inputText.trim() === "") {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.PAYLOAD_INVALID, "Voice inbound payload is invalid");
  }

  const turn: VoiceTurn = {
    sessionId: parsed.data.sessionId ?? randomUUID(),
    eventType: parsed.data.eventType,
    inputText: parsed.data.inputText,
    occurredAt: new Date(parsed.data.occurredAt),
  };
  if (parsed.data.externalChannelId !== undefined) {
    turn.externalChannelId = parsed.data.externalChannelId;
  }
  if (parsed.data.interactionId !== undefined) {
    turn.interactionId = parsed.data.interactionId;
  }
  if (parsed.data.requestId !== undefined) {
    turn.requestId = parsed.data.requestId;
  }
  return turn;
}

export function mapVoiceReplyToConsumer(reply: VoiceReply): VoiceConsumerReply {
  return {
    message: reply.text,
    locale: reply.locale,
    status: reply.status,
  };
}

import { z } from "zod";
import type { VoiceConfig } from "../../application/load-config.js";
import { OrchestrationBoundaryError } from "../../domain/errors.js";
import { ORCHESTRATION_ERROR_CODES, adapterSafeOrchestrationMessage } from "../../domain/orchestration.js";
import { secretsMatch } from "../voice/inbound.js";

export const DEMO_ORCHESTRATE_SECRET_HEADER = "x-demo-orchestrate-secret";
export const DEMO_PUBLIC_TOKEN_HEADER = "x-demo-public-token";
export const MAX_ORCHESTRATE_USER_TEXT_CHARS = 4096;
const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const orchestrateSchema = z
  .object({
    userText: z.string().min(1).max(MAX_ORCHESTRATE_USER_TEXT_CHARS),
    intent: z.unknown().optional(),
    locale: z.string().min(1).max(16).optional(),
    sessionId: z.string().max(36).optional(),
  })
  .strict();

export type DemoOrchestrateRequest = {
  userText: string;
  intent?: unknown;
  locale?: string;
  sessionId?: string;
};

export function resolveDemoOrchestrateSecret(voice: VoiceConfig): string | undefined {
  return voice.demoOrchestrateSecret ?? voice.inboundSecret;
}

export type SessionHistoryAuthRole = "operator" | "public";

export type SessionHistoryAuth = {
  role: SessionHistoryAuthRole;
};

/** Reject configs where the public read token equals a write secret. */
export function assertDemoPublicTokenDistinct(voice: VoiceConfig): void {
  const publicToken = voice.demoPublicToken;
  if (publicToken === undefined || publicToken === "") {
    return;
  }
  const operator = resolveDemoOrchestrateSecret(voice);
  const inbound = voice.inboundSecret;
  if (operator !== undefined && operator !== "" && secretsMatch(publicToken, operator)) {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.CONFIG,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.CONFIG),
    );
  }
  if (inbound !== undefined && inbound !== "" && secretsMatch(publicToken, inbound)) {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.CONFIG,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.CONFIG),
    );
  }
}

/**
 * Authenticate session history reads.
 * Operator: `x-demo-orchestrate-secret` matching DEMO_ORCHESTRATE_SECRET or VOICE_INBOUND_SECRET.
 * Public: `x-demo-public-token` matching DEMO_PUBLIC_TOKEN only (never dual-accept on the operator header).
 */
export function authenticateSessionHistory(
  voice: VoiceConfig,
  providedOperatorHeader: string | undefined,
  providedPublicTokenHeader: string | undefined,
): SessionHistoryAuth {
  assertDemoPublicTokenDistinct(voice);
  const operatorSecret = resolveDemoOrchestrateSecret(voice);
  const publicToken = voice.demoPublicToken;
  const hasOperator = operatorSecret !== undefined && operatorSecret !== "";
  const hasPublic = publicToken !== undefined && publicToken !== "";
  if (!hasOperator && !hasPublic) {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.CONFIG,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.CONFIG),
    );
  }
  if (
    hasOperator &&
    providedOperatorHeader !== undefined &&
    secretsMatch(operatorSecret!, providedOperatorHeader)
  ) {
    return { role: "operator" };
  }
  if (
    hasPublic &&
    providedPublicTokenHeader !== undefined &&
    secretsMatch(publicToken!, providedPublicTokenHeader)
  ) {
    return { role: "public" };
  }
  throw new OrchestrationBoundaryError(
    ORCHESTRATION_ERROR_CODES.UNAUTHORIZED,
    adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.UNAUTHORIZED),
  );
}

export function assertPublicListScoped(externalChannelId: string | undefined): void {
  if (externalChannelId === undefined || externalChannelId === "") {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.FORBIDDEN,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.FORBIDDEN),
    );
  }
}

export function assertOperatorRecompute(role: SessionHistoryAuthRole, recompute: boolean): void {
  if (recompute && role !== "operator") {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.FORBIDDEN,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.FORBIDDEN),
    );
  }
}

export function authenticateDemoOrchestrate(
  secret: string | undefined,
  provided: string | undefined,
  llmMode: "fake" | "http",
): void {
  if (secret === undefined || secret === "") {
    if (llmMode === "http") {
      throw new OrchestrationBoundaryError(
        ORCHESTRATION_ERROR_CODES.CONFIG,
        adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.CONFIG),
      );
    }
    return;
  }
  if (provided === undefined || !secretsMatch(secret, provided)) {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.UNAUTHORIZED,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.UNAUTHORIZED),
    );
  }
}

export function mapOrchestrateBody(body: unknown, defaultLocale: string): DemoOrchestrateRequest {
  const parsed = orchestrateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.PAYLOAD_INVALID,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.PAYLOAD_INVALID),
    );
  }
  if (parsed.data.userText.trim() === "") {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.PAYLOAD_INVALID,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.PAYLOAD_INVALID),
    );
  }
  if (parsed.data.sessionId !== undefined && !SESSION_UUID_PATTERN.test(parsed.data.sessionId)) {
    throw new OrchestrationBoundaryError(
      ORCHESTRATION_ERROR_CODES.SESSION_INVALID,
      adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.SESSION_INVALID),
    );
  }
  return {
    userText: parsed.data.userText,
    intent: parsed.data.intent,
    locale: parsed.data.locale ?? defaultLocale,
    ...(parsed.data.sessionId === undefined ? {} : { sessionId: parsed.data.sessionId }),
  };
}

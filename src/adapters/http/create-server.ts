import Fastify, { type FastifyInstance } from "fastify";
import {
  DEFAULT_VOICE_LOCALE,
  DEFAULT_VOICE_TIMEOUT_MS,
  type VoiceConfig,
} from "../../application/load-config.js";
import { checkLiveness } from "../../application/check-liveness.js";
import { checkReadiness } from "../../application/check-readiness.js";
import { checkVoiceIntegration } from "../../application/check-voice-integration.js";
import { handleVoiceTurn } from "../../application/handle-voice-turn.js";
import { mapErrorToEnvelope } from "../../application/map-error.js";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";
import { VoiceBoundaryError } from "../../domain/errors.js";
import {
  INBOUND_BODY_LIMIT_BYTES,
  VOICE_INBOUND_SECRET_HEADER,
  authenticateInbound,
  mapInboundToVoiceTurn,
  mapVoiceReplyToConsumer,
} from "../voice/inbound.js";

export type LivenessChecker = () => { status: "alive" };

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  timeoutMs: DEFAULT_VOICE_TIMEOUT_MS,
  defaultLocale: DEFAULT_VOICE_LOCALE,
};

export type HttpServerDependencies = {
  persistence: PersistencePort;
  logger: LoggerPort;
  voice?: VoiceConfig;
  checkLivenessFn?: LivenessChecker;
};

export async function createServer(dependencies: HttpServerDependencies): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });
  const liveness = dependencies.checkLivenessFn ?? checkLiveness;
  const voice = dependencies.voice ?? DEFAULT_VOICE_CONFIG;

  server.get("/health/live", async () => liveness());

  server.get("/health/ready", async () => {
    return checkReadiness(dependencies.persistence, dependencies.logger);
  });

  server.get("/health/voice", async () => {
    return checkVoiceIntegration(voice);
  });

  server.post("/adapters/voice/inbound", { bodyLimit: INBOUND_BODY_LIMIT_BYTES }, async (request) => {
    authenticateInbound(voice, headerValue(request.headers[VOICE_INBOUND_SECRET_HEADER]));
    const turn = mapInboundToVoiceTurn(request.body);
    const result = await handleVoiceTurn(turn, {
      locale: voice.defaultLocale,
      timeoutMs: voice.timeoutMs,
      logger: dependencies.logger,
    });

    if (!result.ok) {
      throw new VoiceBoundaryError(result.error.code, result.error.message);
    }

    return mapVoiceReplyToConsumer(result.reply);
  });

  server.setErrorHandler((error, _request, reply) => {
    const mapped = mapErrorToEnvelope(error);
    dependencies.logger.log({
      operation: "http.error",
      outcome: "failure",
      errorCode: mapped.body.error.code,
    });
    void reply.status(mapped.statusCode).send(mapped.body);
  });

  return server;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

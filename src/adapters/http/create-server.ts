import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import {
  DEFAULT_INBOUND_MAX_SKEW_MS,
  DEFAULT_INBOUND_RATE_LIMIT,
  DEFAULT_INBOUND_RATE_WINDOW_MS,
  DEFAULT_LLM_MODEL_ID,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_VOICE_LOCALE,
  DEFAULT_VOICE_SESSION_OWNER,
  DEFAULT_VOICE_TIMEOUT_MS,
  type LlmConfig,
  type VoiceConfig,
} from "../../application/load-config.js";
import { checkLiveness } from "../../application/check-liveness.js";
import { checkReadiness } from "../../application/check-readiness.js";
import { checkVoiceIntegration } from "../../application/check-voice-integration.js";
import { handleAgentTurn } from "../../application/handle-agent-turn.js";
import { handleOrchestratedTurn } from "../../application/handle-orchestrated-turn.js";
import { RUNTIME_DEMO_ALLOWLIST } from "../../domain/demo-tool.js";
import { WOM_CUSTOMER_SERVICE_AGENT_ID, WOM_CUSTOMER_SERVICE_ALLOWLIST } from "../../domain/wom-tools.js";
import { handleVoiceTurn } from "../../application/handle-voice-turn.js";
import { getSessionReport, listSessionReports } from "../../application/get-session-report.js";
import {
  loadDemoClassifyPrompt,
  loadDemoNormalizePrompt,
  loadRuntimeDemoPrompt,
  loadWomCustomerServicePrompt,
} from "../../application/load-prompt.js";
import { mapErrorToEnvelope } from "../../application/map-error.js";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { LlmPort } from "../../domain/ports/llm-port.js";
import type { ObservabilityPort } from "../../domain/ports/observability-port.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";
import type { RetrievalPort } from "../../domain/ports/retrieval-port.js";
import type { ToolPort } from "../../domain/ports/tool-port.js";
import { ingestExampleDocument } from "../../application/ingest-document.js";
import { InMemoryRetrieval } from "../retrieval/in-memory-retrieval.js";
import { OrchestrationBoundaryError, VoiceBoundaryError } from "../../domain/errors.js";
import { VOICE_ERROR_CODES } from "../../domain/voice.js";
import { defaultFakeLlm } from "../llm/fake-llm.js";
import { HttpLlm } from "../llm/http-llm.js";
import { LoggingObservability } from "../observability/logging-observability.js";
import { PersistingObservability } from "../observability/persisting-observability.js";
import { createSessionOwnerToolPort } from "../tools/native-tool-port.js";
import {
  DEMO_ORCHESTRATE_SECRET_HEADER,
  DEMO_PUBLIC_TOKEN_HEADER,
  assertOperatorRecompute,
  assertPublicListScoped,
  authenticateDemoOrchestrate,
  authenticateSessionHistory,
  mapOrchestrateBody,
  resolveDemoOrchestrateSecret,
} from "./demo-orchestrate.js";
import {
  INBOUND_BODY_LIMIT_BYTES,
  InboundRateLimiter,
  VOICE_INBOUND_SECRET_HEADER,
  assertInboundFreshness,
  authenticateInbound,
  inboundSecretHash,
  mapInboundToVoiceTurn,
  mapVoiceReplyToConsumer,
} from "../voice/inbound.js";
import { ORCHESTRATION_ERROR_CODES, adapterSafeOrchestrationMessage } from "../../domain/orchestration.js";

export type LivenessChecker = () => { status: "alive" };

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  timeoutMs: DEFAULT_VOICE_TIMEOUT_MS,
  defaultLocale: DEFAULT_VOICE_LOCALE,
  inboundMaxSkewMs: DEFAULT_INBOUND_MAX_SKEW_MS,
  inboundRateLimit: DEFAULT_INBOUND_RATE_LIMIT,
  inboundRateWindowMs: DEFAULT_INBOUND_RATE_WINDOW_MS,
};

export type HttpServerDependencies = {
  persistence: PersistencePort;
  logger: LoggerPort;
  voice?: VoiceConfig;
  llmConfig?: LlmConfig;
  llm?: LlmPort;
  tools?: ToolPort;
  retrieval?: RetrievalPort;
  observability?: ObservabilityPort;
  checkLivenessFn?: LivenessChecker;
};

function composeLlm(config: LlmConfig | undefined, override: LlmPort | undefined): LlmPort {
  if (override !== undefined) {
    return override;
  }
  if (config?.mode === "http") {
    return new HttpLlm({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      modelId: config.modelId,
      timeoutMs: config.timeoutMs,
    });
  }
  return defaultFakeLlm(DEFAULT_VOICE_LOCALE);
}

export async function createServer(dependencies: HttpServerDependencies): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });
  const liveness = dependencies.checkLivenessFn ?? checkLiveness;
  const voice = dependencies.voice ?? DEFAULT_VOICE_CONFIG;
  const llmConfig = dependencies.llmConfig ?? {
    mode: "fake" as const,
    timeoutMs: DEFAULT_LLM_TIMEOUT_MS,
    modelId: DEFAULT_LLM_MODEL_ID,
  };
  const llm = composeLlm(llmConfig, dependencies.llm);
  const sessionOwner = voice.sessionOwner ?? DEFAULT_VOICE_SESSION_OWNER;
  const womOwner = sessionOwner === WOM_CUSTOMER_SERVICE_AGENT_ID;
  const allowedTools = womOwner ? WOM_CUSTOMER_SERVICE_ALLOWLIST : RUNTIME_DEMO_ALLOWLIST;
  const tools = dependencies.tools ?? createSessionOwnerToolPort(allowedTools);
  const baseObservability = dependencies.observability ?? new LoggingObservability(dependencies.logger);
  const observability =
    dependencies.observability === undefined
      ? new PersistingObservability(baseObservability, dependencies.persistence, dependencies.logger)
      : new PersistingObservability(dependencies.observability, dependencies.persistence, dependencies.logger);
  const retrieval = dependencies.retrieval ?? new InMemoryRetrieval();
  if (dependencies.retrieval === undefined && !womOwner) {
    await ingestExampleDocument({ llm, retrieval });
  }
  const prompt = womOwner ? loadWomCustomerServicePrompt() : loadRuntimeDemoPrompt();
  const normalizePrompt = loadDemoNormalizePrompt();
  const classifyPrompt = loadDemoClassifyPrompt();
  const inboundMaxSkewMs = voice.inboundMaxSkewMs ?? DEFAULT_INBOUND_MAX_SKEW_MS;
  const inboundLimiter = new InboundRateLimiter(
    voice.inboundRateLimit ?? DEFAULT_INBOUND_RATE_LIMIT,
    voice.inboundRateWindowMs ?? DEFAULT_INBOUND_RATE_WINDOW_MS,
  );
  const sessionHistoryLimiter = new InboundRateLimiter(
    voice.inboundRateLimit ?? DEFAULT_INBOUND_RATE_LIMIT,
    voice.inboundRateWindowMs ?? DEFAULT_INBOUND_RATE_WINDOW_MS,
  );

  server.get("/health/live", async () => liveness());

  server.get("/health/ready", async () => {
    return checkReadiness(dependencies.persistence, dependencies.logger);
  });

  server.get("/health/voice", async () => {
    return checkVoiceIntegration(voice);
  });

  server.get("/sessions", async (request) => {
    const auth = authenticateSessionHistory(
      voice,
      headerValue(request.headers[DEMO_ORCHESTRATE_SECRET_HEADER]),
      headerValue(request.headers[DEMO_PUBLIC_TOKEN_HEADER]),
    );
    const rateKey =
      headerValue(request.headers[DEMO_PUBLIC_TOKEN_HEADER]) ??
      headerValue(request.headers[DEMO_ORCHESTRATE_SECRET_HEADER]) ??
      "session-history";
    if (!sessionHistoryLimiter.allow(inboundSecretHash(rateKey))) {
      throw new OrchestrationBoundaryError(
        ORCHESTRATION_ERROR_CODES.RATE_LIMITED,
        adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.RATE_LIMITED),
      );
    }
    const query = request.query as { limit?: string; externalChannelId?: string };
    if (auth.role === "public") {
      assertPublicListScoped(query.externalChannelId);
    }
    const raw = query.limit;
    const limit = raw === undefined ? 20 : Number(raw);
    return {
      data: await listSessionReports(dependencies.persistence, {
        limit: Number.isFinite(limit) ? limit : 20,
        ...(query.externalChannelId === undefined || query.externalChannelId === ""
          ? {}
          : { externalChannelId: query.externalChannelId }),
      }),
    };
  });

  server.get("/sessions/:sessionId", async (request) => {
    const auth = authenticateSessionHistory(
      voice,
      headerValue(request.headers[DEMO_ORCHESTRATE_SECRET_HEADER]),
      headerValue(request.headers[DEMO_PUBLIC_TOKEN_HEADER]),
    );
    const rateKey =
      headerValue(request.headers[DEMO_PUBLIC_TOKEN_HEADER]) ??
      headerValue(request.headers[DEMO_ORCHESTRATE_SECRET_HEADER]) ??
      "session-history";
    if (!sessionHistoryLimiter.allow(inboundSecretHash(rateKey))) {
      throw new OrchestrationBoundaryError(
        ORCHESTRATION_ERROR_CODES.RATE_LIMITED,
        adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.RATE_LIMITED),
      );
    }
    const { sessionId } = request.params as { sessionId: string };
    const query = request.query as { recompute?: string };
    const recompute = query.recompute === "true" || query.recompute === "1";
    assertOperatorRecompute(auth.role, recompute);
    return getSessionReport(dependencies.persistence, sessionId, {
      recompute,
      allowWrite: auth.role === "operator",
    });
  });

  server.post("/adapters/voice/inbound", { bodyLimit: INBOUND_BODY_LIMIT_BYTES }, async (request) => {
    authenticateInbound(voice, headerValue(request.headers[VOICE_INBOUND_SECRET_HEADER]));
    const turn = mapInboundToVoiceTurn(request.body);
    assertInboundFreshness(turn.occurredAt, inboundMaxSkewMs);
    if (voice.inboundSecret !== undefined && !inboundLimiter.allow(inboundSecretHash(voice.inboundSecret))) {
      throw new VoiceBoundaryError(VOICE_ERROR_CODES.RATE_LIMITED, "Voice inbound rate limit exceeded");
    }
    const result = await handleVoiceTurn(turn, {
      locale: voice.defaultLocale,
      timeoutMs: voice.timeoutMs,
      logger: dependencies.logger,
      observability,
      persistence: dependencies.persistence,
      agentId: sessionOwner,
      runAgent: (voiceTurn, correlation) =>
        handleAgentTurn(
          {
            sessionId: voiceTurn.sessionId,
            userText: voiceTurn.inputText,
            locale: voiceTurn.locale ?? voice.defaultLocale,
            traceId: correlation.traceId,
            ...(voiceTurn.requestId === undefined ? {} : { requestId: voiceTurn.requestId }),
            ...(voiceTurn.interactionId === undefined ? {} : { interactionId: voiceTurn.interactionId }),
          },
          {
            llm,
            tools,
            observability,
            retrieval,
            prompt,
            modelId: llmConfig.modelId,
            llmTimeoutMs: llmConfig.timeoutMs,
            allowedTools,
          },
        ),
    });

    if (!result.ok) {
      throw new VoiceBoundaryError(result.error.code, result.error.message);
    }

    return mapVoiceReplyToConsumer(result.reply);
  });

  const demoOrchestrateSecret = resolveDemoOrchestrateSecret(voice);
  const demoLimiter = new InboundRateLimiter(
    voice.inboundRateLimit ?? DEFAULT_INBOUND_RATE_LIMIT,
    voice.inboundRateWindowMs ?? DEFAULT_INBOUND_RATE_WINDOW_MS,
  );

  server.post("/demo/orchestrate", { bodyLimit: INBOUND_BODY_LIMIT_BYTES }, async (request) => {
    authenticateDemoOrchestrate(
      demoOrchestrateSecret,
      headerValue(request.headers[DEMO_ORCHESTRATE_SECRET_HEADER]),
      llmConfig.mode,
    );
    const rateKey = demoOrchestrateSecret === undefined ? "anonymous" : inboundSecretHash(demoOrchestrateSecret);
    if (!demoLimiter.allow(rateKey)) {
      throw new OrchestrationBoundaryError(
        ORCHESTRATION_ERROR_CODES.RATE_LIMITED,
        adapterSafeOrchestrationMessage(ORCHESTRATION_ERROR_CODES.RATE_LIMITED),
      );
    }
    const body = mapOrchestrateBody(request.body, voice.defaultLocale);
    const traceId = randomUUID();
    const started = Date.now();
    const result = await handleOrchestratedTurn(
      {
        userText: body.userText,
        locale: body.locale ?? voice.defaultLocale,
        intent: body.intent,
        ...(body.sessionId === undefined ? {} : { sessionId: body.sessionId }),
        traceId,
      },
      {
        llm,
        observability,
        normalizePrompt,
        classifyPrompt,
        modelId: llmConfig.modelId,
        llmTimeoutMs: llmConfig.timeoutMs,
      },
    );
    observability.emit({
      name: "http.demo.orchestrate",
      kind: "http",
      status: result.ok ? "ok" : "error",
      traceId,
      latencyMs: Date.now() - started,
      ...(result.ok ? {} : { errorCode: result.error.code }),
    });
    if (!result.ok) {
      throw new OrchestrationBoundaryError(result.error.code, result.error.message);
    }
    return {
      sessionId: result.sessionId,
      intent: result.intent,
      specialistId: result.specialistId,
      replyText: result.replyText,
      ...("normalizedText" in result ? { normalizedText: result.normalizedText } : { label: result.label }),
    };
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

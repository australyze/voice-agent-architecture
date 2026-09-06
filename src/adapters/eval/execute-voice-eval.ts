import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "../http/create-server.js";
import { VOICE_INBOUND_SECRET_HEADER } from "../voice/inbound.js";
import type { EvaluationScore } from "../../domain/evaluation.js";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import { MemoryPersistence } from "../persistence/memory-persistence.js";

export type VoiceEvalCase = {
  id: string;
  configured: boolean;
  authenticated: boolean;
  request: Record<string, unknown>;
  expect: {
    httpStatus: number;
    errorCode: string | null;
  };
};

export type VoiceSuiteFile = {
  suiteName: string;
  datasetVersion?: string;
  requiresLiveTelephony: boolean;
  cases: VoiceEvalCase[];
};

export function loadVoiceSuite(root = process.cwd()): VoiceSuiteFile {
  return JSON.parse(readFileSync(resolve(root, "eval/voice/cases.json"), "utf8")) as VoiceSuiteFile;
}

function stampOccurredAt(voiceCase: VoiceEvalCase): Record<string, unknown> {
  if (voiceCase.id === "stale-occurred-at") {
    return voiceCase.request;
  }
  if (typeof voiceCase.request.occurredAt === "string") {
    return { ...voiceCase.request, occurredAt: new Date().toISOString() };
  }
  return voiceCase.request;
}

export async function executeVoiceEval(root = process.cwd()): Promise<{
  metadata: VoiceSuiteFile;
  scores: EvaluationScore[];
}> {
  const suite = loadVoiceSuite(root);
  const scores: EvaluationScore[] = [];
  for (const voiceCase of suite.cases) {
    const server = voiceCase.configured
      ? await createServer({
          persistence: new MemoryPersistence(),
          logger: { log() {} } satisfies LoggerPort,
          voice: { inboundSecret: "eval-secret", timeoutMs: 2000, defaultLocale: "es" },
        })
      : await createServer({
          persistence: new MemoryPersistence(),
          logger: { log() {} } satisfies LoggerPort,
        });
    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: voiceCase.authenticated ? { [VOICE_INBOUND_SECRET_HEADER]: "eval-secret" } : {},
      payload: stampOccurredAt(voiceCase),
    });
    const body = response.json() as { error?: { code?: string } };
    const ok =
      response.statusCode === voiceCase.expect.httpStatus &&
      (voiceCase.expect.errorCode === null || body.error?.code === voiceCase.expect.errorCode);
    scores.push({
      caseId: `${suite.suiteName}/${voiceCase.id}`,
      metric: "voice_contract_ok",
      value: ok ? 1 : 0,
      pass: ok,
    });
    await server.close();
  }
  return { metadata: suite, scores };
}

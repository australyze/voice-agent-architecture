import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createServer } from "../../src/adapters/http/create-server.js";
import { VOICE_INBOUND_SECRET_HEADER } from "../../src/adapters/voice/inbound.js";
import { defaultDemoReplyForLocale } from "../../src/adapters/llm/fake-llm.js";
import type { LoggerPort } from "../../src/domain/ports/logger-port.js";
import { MemoryPersistence } from "../../src/adapters/persistence/memory-persistence.js";

type VoiceCase = {
  id: string;
  configured: boolean;
  authenticated: boolean;
  request: Record<string, unknown>;
  expect: {
    httpStatus: number;
    errorCode: string | null;
    body?: { locale: string; status: string };
  };
};

const suite = JSON.parse(readFileSync(fileURLToPath(new URL("./cases.json", import.meta.url)), "utf8")) as {
  suiteName: string;
  requiresLiveTelephony: boolean;
  cases: VoiceCase[];
};

function stampOccurredAt(voiceCase: VoiceCase): Record<string, unknown> {
  if (voiceCase.id === "stale-occurred-at") {
    return voiceCase.request;
  }
  if (typeof voiceCase.request.occurredAt === "string") {
    return { ...voiceCase.request, occurredAt: new Date().toISOString() };
  }
  return voiceCase.request;
}

describe(suite.suiteName, () => {
  it("should_not_require_live_telephony", () => {
    expect(suite.requiresLiveTelephony).toBe(false);
  });

  for (const voiceCase of suite.cases) {
    it(`should_pass_${voiceCase.id}`, async () => {
      const server = await createServer({
        persistence: new MemoryPersistence(),
        logger: { log() {} } satisfies LoggerPort,
        voice: voiceCase.configured
          ? { inboundSecret: "eval-secret", timeoutMs: 2000, defaultLocale: "es" }
          : undefined,
      });

      const response = await server.inject({
        method: "POST",
        url: "/adapters/voice/inbound",
        headers: voiceCase.authenticated ? { [VOICE_INBOUND_SECRET_HEADER]: "eval-secret" } : {},
        payload: stampOccurredAt(voiceCase),
      });

      expect(response.statusCode).toBe(voiceCase.expect.httpStatus);
      if (voiceCase.expect.errorCode) {
        expect(response.json().error.code).toBe(voiceCase.expect.errorCode);
      } else {
        expect(response.json()).toMatchObject({
          message: defaultDemoReplyForLocale("es"),
          locale: voiceCase.expect.body?.locale,
          status: voiceCase.expect.body?.status,
        });
      }
      await server.close();
    });
  }
});

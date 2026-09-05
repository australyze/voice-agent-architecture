import { describe, expect, it } from "vitest";
import type { LoggerPort, LogEvent } from "../../domain/ports/logger-port.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";
import { placeholderReplyForLocale } from "../../application/placeholder-replies.js";
import { createServer } from "./create-server.js";
import { INBOUND_BODY_LIMIT_BYTES, VOICE_INBOUND_SECRET_HEADER } from "../voice/inbound.js";

function silentLogger(): LoggerPort & { events: LogEvent[] } {
  const events: LogEvent[] = [];
  return {
    events,
    log(event) {
      events.push(event);
    },
  };
}

function readyPersistence(): PersistencePort {
  return { async ping() {} };
}

const VALID_BODY = {
  eventType: "transcript",
  occurredAt: "2026-09-05T12:00:00.000Z",
  externalChannelId: "call-1",
  interactionId: "int-1",
  requestId: "req-1",
  inputText: "hola",
  sessionId: "11111111-1111-4111-8111-111111111111",
};

describe("voice inbound HTTP", () => {
  it("should_map_simulator_request_through_runtime_to_placeholder_reply", async () => {
    const logger = silentLogger();
    const server = await createServer({
      persistence: readyPersistence(),
      logger,
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });

    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: VALID_BODY,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: placeholderReplyForLocale("es"),
      locale: "es",
      status: "ok",
    });
    expect(logger.events.some((event) => event.operation === "voice.turn" && event.outcome === "success")).toBe(true);
    await server.close();
  });

  it("should_return_401_envelope_when_unauthenticated", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });

    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      payload: VALID_BODY,
    });
    const body = response.json() as { success: boolean; error: { code: string; message: string } };

    expect(response.statusCode).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify(body)).not.toContain("test-secret");
    await server.close();
  });

  it("should_return_400_envelope_when_payload_is_invalid", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });

    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: { eventType: "transcript" },
    });
    const body = response.json() as { success: boolean; error: { code: string } };

    expect(response.statusCode).toBe(400);
    expect(body.error.code).toBe("VOICE_PAYLOAD_INVALID");
    await server.close();
  });

  it("should_return_400_when_event_is_unsupported", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });

    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: { ...VALID_BODY, eventType: "transfer" },
    });
    const body = response.json() as { success: boolean; error: { code: string } };

    expect(response.statusCode).toBe(400);
    expect(body.error.code).toBe("VOICE_EVENT_UNSUPPORTED");
    await server.close();
  });

  it("should_return_config_error_when_voice_is_not_configured", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
    });

    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      payload: VALID_BODY,
    });
    const body = response.json() as { success: boolean; error: { code: string } };

    expect(response.statusCode).toBe(503);
    expect(body.error.code).toBe("VOICE_CONFIG");
    await server.close();
  });

  it("should_reject_extra_fields_and_malformed_json", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });

    const extra = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: { ...VALID_BODY, vendorNativeField: true },
    });
    expect(extra.statusCode).toBe(400);
    expect(extra.json().error.code).toBe("VOICE_PAYLOAD_INVALID");

    const malformed = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: {
        [VOICE_INBOUND_SECRET_HEADER]: "test-secret",
        "content-type": "application/json",
      },
      payload: "{not-json",
    });
    expect(malformed.statusCode).toBeGreaterThanOrEqual(400);
    const malformedBody = malformed.json() as { success?: boolean; error?: { message: string } };
    expect(JSON.stringify(malformedBody)).not.toContain("test-secret");
    await server.close();
  });

  it("should_reject_oversized_inbound_body_without_leaking_secret", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });

    const oversized = "a".repeat(INBOUND_BODY_LIMIT_BYTES + 1);
    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: {
        [VOICE_INBOUND_SECRET_HEADER]: "test-secret",
        "content-type": "application/json",
      },
      payload: `{"eventType":"transcript","occurredAt":"2026-09-05T12:00:00.000Z","inputText":"${oversized}"}`,
    });
    const body = response.json() as { success?: boolean; error?: { code: string } };

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe("VOICE_PAYLOAD_INVALID");
    expect(JSON.stringify(body)).not.toContain("test-secret");
    await server.close();
  });
});

import { describe, expect, it } from "vitest";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";
import { createServer } from "./create-server.js";

function silentLogger(): LoggerPort {
  return { log() {} };
}

function readyPersistence(): PersistencePort {
  return { async ping() {} };
}

describe("voice health diagnostic", () => {
  it("should_evaluate_voice_health_without_authorization", async () => {
    const server = await createServer({ persistence: readyPersistence(), logger: silentLogger() });
    const response = await server.inject({ method: "GET", url: "/health/voice" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "not_configured" });
    await server.close();
  });

  it("should_report_configured_when_voice_secret_is_present", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      voice: { inboundSecret: "shared-secret", timeoutMs: 2000, defaultLocale: "es" },
    });
    const response = await server.inject({ method: "GET", url: "/health/voice" });
    expect(response.json()).toEqual({ status: "configured" });
    expect(JSON.stringify(response.json())).not.toContain("shared-secret");
    await server.close();
  });

  it("should_report_error_without_secrets", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      voice: {
        inboundSecret: "supersecret-inbound",
        providerBaseUrl: "not-a-url",
        timeoutMs: 2000,
        defaultLocale: "es",
      },
    });
    const response = await server.inject({ method: "GET", url: "/health/voice" });
    expect(response.json()).toEqual({ status: "error", code: "VOICE_CONFIG" });
    expect(JSON.stringify(response.json())).not.toContain("supersecret-inbound");
    await server.close();
  });

  it("should_keep_readiness_ready_when_voice_is_omitted", async () => {
    const server = await createServer({ persistence: readyPersistence(), logger: silentLogger() });
    const ready = await server.inject({ method: "GET", url: "/health/ready" });
    const live = await server.inject({ method: "GET", url: "/health/live" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready" });
    expect(live.json()).toEqual({ status: "alive" });
    await server.close();
  });
});

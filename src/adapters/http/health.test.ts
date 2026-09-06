import { describe, expect, it } from "vitest";
import { AppError, DependencyError } from "../../domain/errors.js";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import { downPersistence, readyPersistence } from "../persistence/test-persistence.js";
import { createServer } from "./create-server.js";

function silentLogger(): LoggerPort {
  return { log() {} };
}

describe("health HTTP", () => {
  it("should_evaluate_health_without_authorization_headers", async () => {
    const server = await createServer({ persistence: readyPersistence(), logger: silentLogger() });

    const live = await server.inject({ method: "GET", url: "/health/live" });
    const ready = await server.inject({ method: "GET", url: "/health/ready" });
    const voice = await server.inject({ method: "GET", url: "/health/voice" });

    expect(live.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
    expect(voice.statusCode).toBe(200);
    await server.close();
  });

  it("should_report_alive_when_the_process_is_running", async () => {
    const server = await createServer({ persistence: readyPersistence(), logger: silentLogger() });

    const response = await server.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "alive" });
    await server.close();
  });

  it("should_report_alive_when_persistence_is_down", async () => {
    const server = await createServer({ persistence: downPersistence(), logger: silentLogger() });

    const response = await server.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "alive" });
    await server.close();
  });

  it("should_report_ready_when_persistence_ping_succeeds", async () => {
    const server = await createServer({ persistence: readyPersistence(), logger: silentLogger() });

    const response = await server.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
    await server.close();
  });

  it("should_report_not_ready_without_secrets_when_persistence_is_unavailable", async () => {
    const server = await createServer({ persistence: downPersistence(), logger: silentLogger() });

    const response = await server.inject({ method: "GET", url: "/health/ready" });
    const body = response.json() as {
      success: boolean;
      error: { message: string; code: string };
    };

    expect(response.statusCode).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("PERSISTENCE_UNAVAILABLE");
    expect(body.error.message).not.toContain("supersecret");
    expect(JSON.stringify(body)).not.toMatch(/postgresql:\/\//i);
    await server.close();
  });

  it("should_return_canonical_envelope_when_health_handler_fails_unexpectedly", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      checkLivenessFn: () => {
        throw new Error("boom postgresql://user:supersecret@localhost:5432/db");
      },
    });

    const response = await server.inject({ method: "GET", url: "/health/live" });
    const body = response.json() as {
      success: boolean;
      error: { message: string; code: string; details: null };
    };

    expect(response.statusCode).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
        details: null,
      },
    });
    expect(JSON.stringify(body)).not.toContain("supersecret");
    await server.close();
  });

  it("should_return_canonical_envelope_when_handled_error_crosses_http_boundary", async () => {
    const server = await createServer({
      persistence: readyPersistence(),
      logger: silentLogger(),
      checkLivenessFn: () => {
        throw new AppError("internal", "HEALTH_FAILED", "health handler failed");
      },
    });

    const response = await server.inject({ method: "GET", url: "/health/live" });
    const body = response.json() as { success: boolean; error: { message: string; code: string } };

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("HEALTH_FAILED");
    expect(body.error.message).toBe("health handler failed");
    await server.close();
  });
});

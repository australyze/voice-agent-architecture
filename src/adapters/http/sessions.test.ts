import { describe, expect, it } from "vitest";
import { MemoryPersistence } from "../persistence/memory-persistence.js";
import { DEMO_ORCHESTRATE_SECRET_HEADER } from "./demo-orchestrate.js";
import { createServer } from "./create-server.js";

function silentLogger() {
  return { log() {} };
}

const SESSION_A = "11111111-1111-4111-8111-111111111111";
const SESSION_B = "22222222-2222-4222-8222-222222222222";
const AUTH = { [DEMO_ORCHESTRATE_SECRET_HEADER]: "demo-secret" };

async function seededServer(voice?: { inboundSecret?: string; demoOrchestrateSecret?: string }) {
  const persistence = new MemoryPersistence();
  await persistence.upsertSession({
    sessionId: SESSION_A,
    agentId: "wom-customer-service-agent",
    externalChannelId: "vapi-1",
    traceId: "trace-1",
    eventType: "call_started",
    occurredAt: "2026-09-06T12:00:00.000Z",
    idempotencyKey: "s-a",
  });
  await persistence.recordTurn({
    sessionId: SESSION_A,
    role: "user",
    text: "hola",
    createdAt: "2026-09-06T12:00:00.000Z",
    idempotencyKey: "t-a",
  });
  await persistence.upsertSession({
    sessionId: SESSION_B,
    agentId: "wom-customer-service-agent",
    externalChannelId: "vapi-2",
    eventType: "call_started",
    occurredAt: "2026-09-06T13:00:00.000Z",
    idempotencyKey: "s-b",
  });
  const server = await createServer({
    persistence,
    logger: silentLogger(),
    voice: {
      timeoutMs: 2000,
      defaultLocale: "es",
      inboundSecret: "demo-secret",
      ...voice,
    },
  });
  return { server, persistence };
}

describe("session report HTTP", () => {
  it("should_reject_unauthenticated_list_and_detail", async () => {
    const { server } = await seededServer();
    const list = await server.inject({ method: "GET", url: "/sessions" });
    expect(list.statusCode).toBe(401);
    expect(list.json().success).toBe(false);
    expect(list.json().error.code).toBe("unauthorized");
    expect(JSON.stringify(list.json())).not.toContain("hola");

    const detail = await server.inject({ method: "GET", url: `/sessions/${SESSION_A}` });
    expect(detail.statusCode).toBe(401);
    expect(detail.json().error.code).toBe("unauthorized");
    expect(JSON.stringify(detail.json())).not.toContain("hola");
    await server.close();
  });

  it("should_return_503_when_demo_operator_secret_is_not_configured", async () => {
    const persistence = new MemoryPersistence();
    const server = await createServer({ persistence, logger: silentLogger() });
    const list = await server.inject({ method: "GET", url: "/sessions", headers: AUTH });
    expect(list.statusCode).toBe(503);
    expect(list.json().error.code).toBe("orchestration_config");
    await server.close();
  });

  it("should_list_and_get_normalized_reports_when_authenticated", async () => {
    const { server } = await seededServer();

    const list = await server.inject({ method: "GET", url: "/sessions", headers: AUTH });
    expect(list.statusCode).toBe(200);
    expect(list.json().data[0]).toMatchObject({
      sessionId: SESSION_B,
      turnCount: 0,
      toolCallCount: 0,
    });

    const detail = await server.inject({
      method: "GET",
      url: `/sessions/${SESSION_A}`,
      headers: AUTH,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      sessionId: SESSION_A,
      evaluation: null,
    });
    expect(JSON.stringify(detail.json())).not.toContain("SERVICE_ROLE");
    expect(JSON.stringify(detail.json())).not.toContain("postgresql://");
    await server.close();
  });

  it("should_filter_list_by_external_channel_id", async () => {
    const { server } = await seededServer();
    const list = await server.inject({
      method: "GET",
      url: "/sessions?externalChannelId=vapi-1",
      headers: AUTH,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0].sessionId).toBe(SESSION_A);
    await server.close();
  });

  it("should_return_400_for_malformed_id_and_404_for_unknown", async () => {
    const { server } = await seededServer();
    const bad = await server.inject({ method: "GET", url: "/sessions/not-a-uuid", headers: AUTH });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe("SESSION_ID_INVALID");
    const missing = await server.inject({
      method: "GET",
      url: "/sessions/33333333-3333-4333-8333-333333333333",
      headers: AUTH,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().success).toBe(false);
    await server.close();
  });
});

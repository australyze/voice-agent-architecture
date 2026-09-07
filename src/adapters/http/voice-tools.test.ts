import { describe, expect, it } from "vitest";
import { MemoryPersistence } from "../persistence/memory-persistence.js";
import { createServer } from "./create-server.js";
import { VOICE_INBOUND_SECRET_HEADER } from "../voice/inbound.js";
import { TOOLS_BODY_LIMIT_BYTES, VOICE_TOOLS_PATH } from "../voice/map-vapi-tools.js";
import { CHANNEL_TOOL_INVOCATION_SOURCE } from "../../application/load-config.js";

const silentLogger = { log: () => undefined };

function toolBody(name: string, parameters: Record<string, unknown> = {}) {
  return {
    message: {
      type: "tool-calls",
      toolCallList: [{ id: "call-1", name, parameters }],
      call: { id: "vapi-web-call-99" },
    },
  };
}

describe("POST /adapters/voice/tools", () => {
  it("should_reject_missing_auth", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: silentLogger,
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });
    const response = await server.inject({
      method: "POST",
      url: VOICE_TOOLS_PATH,
      payload: toolBody("wom.get_customer_usage"),
    });
    expect(response.statusCode).toBe(401);
  });

  it("should_reject_wrong_secret_without_leaking_secret", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: silentLogger,
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });
    const response = await server.inject({
      method: "POST",
      url: VOICE_TOOLS_PATH,
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "wrong-secret" },
      payload: toolBody("wom.get_customer_usage"),
    });
    expect(response.statusCode).toBe(401);
    const body = response.json() as { success: boolean; error: { code: string; message: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify(body)).not.toContain("test-secret");
    expect(JSON.stringify(body)).not.toContain("wrong-secret");
    await server.close();
  });

  it("should_reject_oversized_body_without_leaking_secret", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: silentLogger,
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });
    const oversized = "a".repeat(TOOLS_BODY_LIMIT_BYTES + 1);
    const response = await server.inject({
      method: "POST",
      url: VOICE_TOOLS_PATH,
      headers: {
        [VOICE_INBOUND_SECRET_HEADER]: "test-secret",
        "content-type": "application/json",
      },
      payload: `{"message":{"type":"tool-calls","toolCallList":[{"id":"call-1","name":"wom.get_customer_usage","parameters":{"pad":"${oversized}"}}],"call":{"id":"vapi-web-call-oversize"}}}`,
    });
    expect(response.statusCode).toBe(413);
    expect(JSON.stringify(response.json())).not.toContain("test-secret");
    await server.close();
  });

  it("should_execute_wom_tool_and_return_vapi_results", async () => {
    const persistence = new MemoryPersistence();
    const server = await createServer({
      persistence,
      logger: silentLogger,
      voice: {
        inboundSecret: "test-secret",
        timeoutMs: 2000,
        defaultLocale: "es",
        sessionOwner: "wom-customer-service-agent",
        reasoningOwner: "vapi",
      },
    });
    const response = await server.inject({
      method: "POST",
      url: VOICE_TOOLS_PATH,
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: toolBody("wom.get_bill_status"),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { results: Array<{ toolCallId: string; result: string }> };
    expect(body.results[0]?.toolCallId).toBe("call-1");
    expect(JSON.parse(body.results[0]!.result)).toMatchObject({ currency: "CLP", amount: 24990 });

    const listed = await persistence.listSessions({ externalChannelId: "vapi-web-call-99", limit: 5 });
    expect(listed).toHaveLength(1);
    const report = await persistence.getSessionReport(listed[0]!.sessionId);
    expect(report?.toolCalls[0]?.invocationSource).toBe(CHANNEL_TOOL_INVOCATION_SOURCE);
    expect(report?.toolCalls[0]?.arguments).toEqual({});
  });

  it("should_deny_tools_outside_wom_allowlist", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: silentLogger,
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });
    const response = await server.inject({
      method: "POST",
      url: VOICE_TOOLS_PATH,
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: toolBody("demo.normalize_text", { text: "hola" }),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { results: Array<{ result: string }> };
    expect(body.results[0]?.result.toLowerCase()).toMatch(/denied|not authorized|tool/);
  });

  it("should_reject_invalid_payload", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: silentLogger,
      voice: { inboundSecret: "test-secret", timeoutMs: 2000, defaultLocale: "es" },
    });
    const response = await server.inject({
      method: "POST",
      url: VOICE_TOOLS_PATH,
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: { message: { type: "assistant-request" } },
    });
    expect(response.statusCode).toBe(400);
  });

  it("should_not_run_agent_on_inbound_transcript_when_reasoning_owner_is_vapi", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: silentLogger,
      voice: {
        inboundSecret: "test-secret",
        timeoutMs: 2000,
        defaultLocale: "es",
        sessionOwner: "wom-customer-service-agent",
        reasoningOwner: "vapi",
      },
    });
    const response = await server.inject({
      method: "POST",
      url: "/adapters/voice/inbound",
      headers: { [VOICE_INBOUND_SECRET_HEADER]: "test-secret" },
      payload: {
        eventType: "transcript",
        occurredAt: new Date().toISOString(),
        inputText: "¿Cuántos gigas me quedan?",
        sessionId: "11111111-1111-4111-8111-111111111111",
        externalChannelId: "vapi-web-call-lifecycle",
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { message: string; status: string };
    expect(body.status).toBe("ok");
    expect(body.message).toBe("");
  });
});

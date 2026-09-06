import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";
import { INBOUND_BODY_LIMIT_BYTES } from "../voice/inbound.js";
import { FakeLlm } from "../llm/fake-llm.js";
import { MemoryObservability } from "../observability/memory-observability.js";
import { createServer } from "./create-server.js";
import { DEMO_ORCHESTRATE_SECRET_HEADER } from "./demo-orchestrate.js";

function silentLogger(): LoggerPort {
  return { log() {} };
}

describe("demo orchestrate HTTP", () => {
  it("should_return_success_dto_for_normalize_and_classify", async () => {
    const server = await createServer({
      persistence: { async ping() {} } satisfies PersistencePort,
      logger: silentLogger(),
      llm: new FakeLlm([
        { kind: "specialist-normalize", replyText: "normalized", normalizedText: "hello" },
      ]),
    });
    const response = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      payload: { userText: "Hello", intent: "normalize", locale: "en" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      intent: "normalize",
      specialistId: "demo-normalize",
      replyText: "normalized",
      normalizedText: "hello",
    });
    expect(response.json()).toHaveProperty("sessionId");
    await server.close();

    const classifyServer = await createServer({
      persistence: { async ping() {} } satisfies PersistencePort,
      logger: silentLogger(),
      llm: new FakeLlm([{ kind: "specialist-classify", replyText: "labeled", label: "greeting" }]),
    });
    const classified = await classifyServer.inject({
      method: "POST",
      url: "/demo/orchestrate",
      payload: { userText: "hola", intent: "classify" },
    });
    expect(classified.statusCode).toBe(200);
    expect(classified.json()).toMatchObject({
      intent: "classify",
      specialistId: "demo-classify",
      label: "greeting",
    });
    await classifyServer.close();
  });

  it("should_return_canonical_unroutable_envelope_and_leave_sessions_unimplemented", async () => {
    const server = await createServer({
      persistence: { async ping() {} } satisfies PersistencePort,
      logger: silentLogger(),
    });
    const unroutable = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      payload: { userText: "hello" },
    });
    const body = unroutable.json() as { success: boolean; error: { code: string; message: string } };
    expect(unroutable.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("unroutable");
    expect(body.error.message).toBeTruthy();

    const sessions = await server.inject({ method: "POST", url: "/sessions", payload: {} });
    const turns = await server.inject({
      method: "POST",
      url: "/sessions/11111111-1111-4111-8111-111111111111/turns",
      payload: {},
    });
    expect(sessions.statusCode).toBe(404);
    expect(turns.statusCode).toBe(404);
    await server.close();
  });

  it("should_emit_http_and_orchestration_spans_on_one_trace", async () => {
    const observability = new MemoryObservability();
    const server = await createServer({
      persistence: { async ping() {} } satisfies PersistencePort,
      logger: silentLogger(),
      observability,
      llm: new FakeLlm([{ kind: "specialist-normalize", replyText: "a", normalizedText: "a" }]),
    });
    await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      payload: { userText: "x", intent: "normalize" },
    });
    const kinds = observability.spans.map((span) => span.kind);
    expect(kinds).toEqual(expect.arrayContaining(["http", "workflow", "llm"]));
    const traceIds = new Set(observability.spans.map((span) => span.traceId));
    expect(traceIds.size).toBe(1);
    expect(observability.spans.some((span) => span.name === "orchestration.route")).toBe(true);
    expect(observability.spans.some((span) => span.name === "orchestration.handoff")).toBe(true);
    expect(JSON.stringify(observability.spans)).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    await server.close();
  });

  it("should_not_import_handleOrchestratedTurn_from_voice_adapter_and_not_call_llm_in_route_source", () => {
    const http = readFileSync(new URL("./create-server.ts", import.meta.url), "utf8");
    const voice = readFileSync(new URL("../../application/handle-voice-turn.ts", import.meta.url), "utf8");
    expect(http).toContain("handleOrchestratedTurn");
    expect(http).toContain("handleAgentTurn");
    expect(voice).not.toContain("handleOrchestratedTurn");
    expect(http).not.toMatch(/server\.post\("\/demo\/orchestrate"[\s\S]*llm\.completeStructured/);
    expect(http).not.toMatch(/consumedInvocations:\s*body/);
    expect(http).not.toMatch(/packedContext:\s*body/);
  });

  it("should_reject_unauthenticated_oversize_empty_and_invalid_session", async () => {
    const llm = new FakeLlm([{ kind: "specialist-normalize", replyText: "normalized", normalizedText: "hello" }]);
    const server = await createServer({
      persistence: { async ping() {} } satisfies PersistencePort,
      logger: silentLogger(),
      voice: {
        inboundSecret: "demo-secret",
        timeoutMs: 2000,
        defaultLocale: "en",
        inboundRateLimit: 30,
        inboundRateWindowMs: 60_000,
      },
      llm,
    });

    const unauthenticated = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      payload: { userText: "Hello", intent: "normalize" },
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toMatchObject({
      success: false,
      error: { code: "unauthorized" },
    });
    expect(llm.structuredMessages).toHaveLength(0);

    const oversize = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      headers: {
        [DEMO_ORCHESTRATE_SECRET_HEADER]: "demo-secret",
        "content-type": "application/json",
      },
      payload: { userText: "x".repeat(INBOUND_BODY_LIMIT_BYTES), intent: "normalize" },
    });
    expect(oversize.statusCode).toBe(413);
    expect(llm.structuredMessages).toHaveLength(0);

    const emptyText = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      headers: { [DEMO_ORCHESTRATE_SECRET_HEADER]: "demo-secret" },
      payload: { userText: "   ", intent: "normalize" },
    });
    expect(emptyText.statusCode).toBe(400);
    expect(emptyText.json()).toMatchObject({ success: false, error: { code: "payload_invalid" } });
    expect(llm.structuredMessages).toHaveLength(0);

    const badSession = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      headers: { [DEMO_ORCHESTRATE_SECRET_HEADER]: "demo-secret" },
      payload: { userText: "Hello", intent: "normalize", sessionId: "not-a-uuid" },
    });
    expect(badSession.statusCode).toBe(400);
    expect(badSession.json()).toMatchObject({ success: false, error: { code: "session_invalid" } });
    expect(llm.structuredMessages).toHaveLength(0);

    const extraHook = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      headers: { [DEMO_ORCHESTRATE_SECRET_HEADER]: "demo-secret" },
      payload: { userText: "Hello", intent: "normalize", consumedInvocations: 0, packedContext: "x" },
    });
    expect(extraHook.statusCode).toBe(400);
    expect(extraHook.json()).toMatchObject({ success: false, error: { code: "payload_invalid" } });
    await server.close();
  });

  it("should_fail_closed_when_http_llm_has_no_demo_secret", async () => {
    const llm = new FakeLlm([{ kind: "specialist-normalize", replyText: "x", normalizedText: "x" }]);
    const server = await createServer({
      persistence: { async ping() {} } satisfies PersistencePort,
      logger: silentLogger(),
      llmConfig: {
        mode: "http",
        timeoutMs: 1500,
        modelId: "paid",
        baseUrl: "https://llm.example.test",
        apiKey: "sk-testnotreal",
      },
      llm,
    });
    const response = await server.inject({
      method: "POST",
      url: "/demo/orchestrate",
      payload: { userText: "Hello", intent: "normalize" },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ success: false, error: { code: "orchestration_config" } });
    expect(llm.structuredMessages).toHaveLength(0);
    await server.close();
  });
});

import { describe, expect, it } from "vitest";
import { inboundIdempotencyKey } from "../../domain/session-history.js";
import { MemoryPersistence } from "./memory-persistence.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const STARTED = "2026-09-06T12:00:00.000Z";
const ENDED = "2026-09-06T12:01:00.000Z";

describe("MemoryPersistence", () => {
  it("should_record_session_turn_tool_event_and_return_report_and_list", async () => {
    const persistence = new MemoryPersistence();
    await persistence.upsertSession({
      sessionId: SESSION_ID,
      agentId: "wom-customer-service-agent",
      externalChannelId: "vapi-call-1",
      traceId: "trace-1",
      eventType: "call_started",
      occurredAt: STARTED,
      idempotencyKey: "start-1",
    });
    await persistence.recordTurn({
      sessionId: SESSION_ID,
      role: "user",
      text: "hola",
      createdAt: STARTED,
      idempotencyKey: "turn-user",
    });
    await persistence.recordTurn({
      sessionId: SESSION_ID,
      role: "assistant",
      text: "hola, ¿en qué ayudo?",
      createdAt: STARTED,
      idempotencyKey: "turn-assistant",
    });
    await persistence.recordToolCall({
      sessionId: SESSION_ID,
      toolName: "wom.get_customer_usage",
      status: "succeeded",
      arguments: { accountId: "demo-1" },
      result: { remainingGb: 8 },
      startedAt: STARTED,
      completedAt: "2026-09-06T12:00:00.183Z",
      durationMs: 183,
      idempotencyKey: "tool-1",
    });
    await persistence.recordExecutionEvent({
      sessionId: SESSION_ID,
      traceId: "trace-1",
      kind: "tool",
      name: "wom.get_customer_usage",
      status: "ok",
      timestamp: STARTED,
      durationMs: 183,
      idempotencyKey: "event-1",
    });

    const report = await persistence.getSessionReport(SESSION_ID);
    const list = await persistence.listSessions({ limit: 10, channel: "voice" });

    expect(report?.sessionId).toBe(SESSION_ID);
    expect(report?.traceId).toBe("trace-1");
    expect(report?.transcript).toHaveLength(2);
    expect(report?.toolCalls).toHaveLength(1);
    expect(report?.trace).toHaveLength(1);
    expect(report?.evaluation).toBeNull();
    expect(list).toEqual([
      expect.objectContaining({
        sessionId: SESSION_ID,
        agentId: "wom-customer-service-agent",
        turnCount: 2,
        toolCallCount: 1,
      }),
    ]);
  });

  it("should_treat_duplicate_start_end_and_event_keys_as_idempotent", async () => {
    const persistence = new MemoryPersistence();
    const startKey = inboundIdempotencyKey({
      eventType: "call_started",
      sessionId: SESSION_ID,
      externalChannelId: "vapi-call-1",
      occurredAt: STARTED,
    });
    const endKey = inboundIdempotencyKey({
      eventType: "call_ended",
      sessionId: SESSION_ID,
      externalChannelId: "vapi-call-1",
      occurredAt: ENDED,
    });
    await persistence.upsertSession({
      sessionId: SESSION_ID,
      agentId: "wom-customer-service-agent",
      externalChannelId: "vapi-call-1",
      eventType: "call_started",
      occurredAt: STARTED,
      idempotencyKey: startKey,
    });
    await persistence.upsertSession({
      sessionId: SESSION_ID,
      agentId: "wom-customer-service-agent",
      externalChannelId: "vapi-call-1",
      eventType: "call_started",
      occurredAt: STARTED,
      idempotencyKey: startKey,
    });
    await persistence.upsertSession({
      sessionId: "22222222-2222-4222-8222-222222222222",
      agentId: "wom-customer-service-agent",
      externalChannelId: "vapi-call-1",
      eventType: "call_ended",
      occurredAt: ENDED,
      idempotencyKey: endKey,
    });
    await persistence.upsertSession({
      sessionId: "22222222-2222-4222-8222-222222222222",
      agentId: "wom-customer-service-agent",
      externalChannelId: "vapi-call-1",
      eventType: "call_ended",
      occurredAt: ENDED,
      idempotencyKey: endKey,
    });
    await persistence.recordExecutionEvent({
      sessionId: SESSION_ID,
      traceId: "trace-1",
      kind: "http",
      name: "http.voice.inbound",
      status: "ok",
      timestamp: STARTED,
      idempotencyKey: "evt-dup",
    });
    await persistence.recordExecutionEvent({
      sessionId: SESSION_ID,
      traceId: "trace-1",
      kind: "http",
      name: "http.voice.inbound",
      status: "ok",
      timestamp: STARTED,
      idempotencyKey: "evt-dup",
    });

    const list = await persistence.listSessions();
    const report = await persistence.getSessionReport(SESSION_ID);
    expect(list).toHaveLength(1);
    expect(report?.durationMs).toBe(60_000);
    expect(report?.trace).toHaveLength(1);
  });

  it("should_upsert_when_end_arrives_before_start", async () => {
    const persistence = new MemoryPersistence();
    const session = await persistence.upsertSession({
      sessionId: SESSION_ID,
      agentId: "runtime-demo",
      externalChannelId: "late-start",
      eventType: "call_ended",
      occurredAt: ENDED,
      idempotencyKey: "end-first",
    });
    expect(session.businessStatus).toBe("completed");
    expect(session.mediaStatus).toBe("ended");
    expect(session.durationMs).toBe(0);
  });

  it("should_compute_duration_turn_tool_and_error_counts", async () => {
    const persistence = new MemoryPersistence();
    await persistence.upsertSession({
      sessionId: SESSION_ID,
      agentId: "wom-customer-service-agent",
      eventType: "call_started",
      occurredAt: STARTED,
      idempotencyKey: "s",
    });
    await persistence.recordTurn({
      sessionId: SESSION_ID,
      role: "user",
      text: "a",
      createdAt: STARTED,
      idempotencyKey: "t1",
    });
    await persistence.recordTurn({
      sessionId: SESSION_ID,
      role: "assistant",
      text: "b",
      createdAt: STARTED,
      idempotencyKey: "t2",
    });
    await persistence.recordToolCall({
      sessionId: SESSION_ID,
      toolName: "wom.get_bill_status",
      status: "failed",
      arguments: {},
      errorClass: "TOOL_UNAVAILABLE",
      startedAt: STARTED,
      durationMs: 204,
      idempotencyKey: "tool-fail",
    });
    await persistence.recordExecutionEvent({
      sessionId: SESSION_ID,
      traceId: "trace-1",
      kind: "tool",
      name: "wom.get_bill_status",
      status: "error",
      errorCode: "TOOL_UNAVAILABLE",
      timestamp: STARTED,
      idempotencyKey: "e1",
    });
    await persistence.upsertSession({
      sessionId: SESSION_ID,
      agentId: "wom-customer-service-agent",
      eventType: "call_ended",
      occurredAt: ENDED,
      idempotencyKey: "e",
    });

    const report = await persistence.getSessionReport(SESSION_ID);
    expect(report?.durationMs).toBe(60_000);
    expect(report?.metrics.turnCount).toBe(2);
    expect(report?.metrics.toolCallCount).toBe(1);
    expect(report?.metrics.errorCount).toBe(1);
    expect(report?.metrics.failedToolCount).toBe(1);
  });
});

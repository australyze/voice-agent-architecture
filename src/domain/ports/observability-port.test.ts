import { describe, expect, it } from "vitest";
import type { TraceSpan } from "./observability-port.js";

describe("TraceSpan contract", () => {
  it("should_allow_correlation_latency_and_consumption_fields", () => {
    const span: TraceSpan = {
      name: "llm.completeStructured",
      kind: "llm",
      status: "ok",
      traceId: "11111111-1111-4111-8111-111111111111",
      spanId: "22222222-2222-4222-8222-222222222222",
      parentSpanId: "33333333-3333-4333-8333-333333333333",
      sessionId: "44444444-4444-4444-8444-444444444444",
      requestId: "request-1",
      interactionId: "interaction-1",
      latencyMs: 12,
      tokenInput: 10,
      tokenOutput: 4,
      cost: 0.001,
      retryCount: 0,
    };

    expect(span.traceId).toBe("11111111-1111-4111-8111-111111111111");
    expect(span.parentSpanId).toBe("33333333-3333-4333-8333-333333333333");
    expect(span.tokenInput).toBe(10);
    expect(span.tokenOutput).toBe(4);
    expect(span.cost).toBe(0.001);
    expect(span.retryCount).toBe(0);
  });
});

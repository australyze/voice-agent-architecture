import { describe, expect, it } from "vitest";
import { JsonLogger } from "../logging/json-logger.js";
import type { LogEvent, LoggerPort } from "../../domain/ports/logger-port.js";
import { LoggingObservability } from "./logging-observability.js";

describe("LoggingObservability", () => {
  it("should_emit_reconstructable_metadata_without_payloads_or_secrets", () => {
    const events: LogEvent[] = [];
    const logger: LoggerPort = {
      log(event) {
        events.push(event);
      },
    };
    const observability = new LoggingObservability(logger);

    observability.emit({
      name: "demo.normalize_text",
      kind: "tool",
      status: "ok",
      traceId: "11111111-1111-4111-8111-111111111111",
      sessionId: "44444444-4444-4444-8444-444444444444",
      requestId: "request-1",
      interactionId: "interaction-1",
      latencyMs: 8,
      tokenInput: 3,
      tokenOutput: 1,
      resultBounded: { ok: true, normalizedText: "secret-user-text" },
      argumentsRedacted: { text: "[redacted]", token: "sk-proj-abcdefghijklmnopqrstuvwx" },
    });

    expect(observability).not.toHaveProperty("spans");
    expect(events).toEqual([
      {
        operation: "trace.tool",
        outcome: "success",
        status: "ok",
        traceId: "11111111-1111-4111-8111-111111111111",
        spanKind: "tool",
        spanName: "demo.normalize_text",
        sessionId: "44444444-4444-4444-8444-444444444444",
        requestId: "request-1",
        interactionId: "interaction-1",
        latencyMs: 8,
        tokenInput: 3,
        tokenOutput: 1,
      },
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("normalizedText");
    expect(serialized).not.toContain("secret-user-text");
    expect(serialized).not.toContain("sk-proj");
    expect(serialized).not.toContain("argumentsRedacted");
    expect(serialized).not.toContain("resultBounded");
  });

  it("should_log_error_class_without_retaining_payloads", () => {
    const events: LogEvent[] = [];
    const logger: LoggerPort = {
      log(event) {
        events.push(event);
      },
    };
    const observability = new LoggingObservability(logger);

    observability.emit({
      name: "llm.completeStructured",
      kind: "llm",
      status: "error",
      traceId: "trace-1",
      latencyMs: 4,
      errorCode: "invalid_output",
    });

    expect(events[0]).toMatchObject({
      operation: "trace.llm",
      outcome: "failure",
      errorCode: "invalid_output",
      latencyMs: 4,
      traceId: "trace-1",
    });
  });

  it("should_redact_secret_shaped_request_id_on_composed_json_logger_path", () => {
    const lines: string[] = [];
    const observability = new LoggingObservability(new JsonLogger((line) => lines.push(line)));

    observability.emit({
      name: "http.voice.inbound",
      kind: "http",
      status: "ok",
      traceId: "11111111-1111-4111-8111-111111111111",
      requestId: "sk-proj-abcdefghijklmnopqrstuvwx",
      latencyMs: 3,
    });

    const raw = lines[0] ?? "";
    expect(raw).not.toContain("sk-proj-abcdefghijklmnopqrstuvwx");
    const entry = JSON.parse(raw) as { requestId?: string };
    expect(entry.requestId).toBe("[redacted-secret-key]");
  });

  it("should_omit_raw_user_text_on_orchestration_spans", () => {
    const lines: string[] = [];
    const observability = new LoggingObservability(new JsonLogger((line) => lines.push(line)));
    observability.emit({
      name: "orchestration.handoff",
      kind: "workflow",
      status: "ok",
      traceId: "22222222-2222-4222-8222-222222222222",
      latencyMs: 2,
      resultBounded: { toAgentId: "demo-normalize", reason: "routed_intent" },
    });
    const raw = lines.join("\n");
    expect(raw).toContain("orchestration.handoff");
    expect(raw).not.toContain("Ignore policy");
    expect(raw).not.toContain("sk-");
    expect(raw).not.toContain("normalizedText");
  });
});

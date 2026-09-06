import { describe, expect, it } from "vitest";
import { JsonLogger } from "./json-logger.js";

describe("JsonLogger", () => {
  it("should_identify_operation_and_success_outcome", () => {
    const lines: string[] = [];
    const logger = new JsonLogger((line) => lines.push(line));

    logger.log({ operation: "health.ready", outcome: "success" });

    const entry = JSON.parse(lines[0] ?? "{}") as Record<string, string>;
    expect(entry.operation).toBe("health.ready");
    expect(entry.outcome).toBe("success");
  });

  it("should_identify_operation_and_failure_without_secrets", () => {
    const lines: string[] = [];
    const logger = new JsonLogger((line) => lines.push(line));
    const secretUrl = "postgresql://user:supersecret@localhost:5432/voice_agent";

    logger.log({
      operation: "persistence.ping",
      outcome: "failure",
      errorCode: "PERSISTENCE_UNAVAILABLE",
      message: `failed to connect ${secretUrl}`,
    });

    const raw = lines[0] ?? "";
    expect(raw).not.toContain("supersecret");
    expect(raw).not.toMatch(/postgresql:\/\/user:supersecret/i);

    const entry = JSON.parse(raw) as Record<string, string>;
    expect(entry.operation).toBe("persistence.ping");
    expect(entry.outcome).toBe("failure");
    expect(entry.errorCode).toBe("PERSISTENCE_UNAVAILABLE");
    expect(entry.message).toContain("[redacted-database-url]");
  });

  it("should_redact_bearer_sk_and_api_key_assignments", () => {
    const lines: string[] = [];
    const logger = new JsonLogger((line) => lines.push(line));

    logger.log({
      operation: "runtime.start",
      outcome: "failure",
      message: "LLM_API_KEY=abc123supersecret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb sk-proj-abcdefghijklmnopqrstuvwx",
    });

    const raw = lines[0] ?? "";
    expect(raw).not.toContain("abc123supersecret");
    expect(raw).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(raw).not.toContain("sk-proj-abcdefghijklmnopqrstuvwx");
  });

  it("should_write_trace_metadata_and_redact_secret_shapes_in_ids", () => {
    const lines: string[] = [];
    const logger = new JsonLogger((line) => lines.push(line));

    logger.log({
      operation: "trace.llm",
      outcome: "success",
      status: "ok",
      traceId: "trace-1",
      spanKind: "llm",
      spanName: "llm.completeStructured",
      latencyMs: 11,
      tokenInput: 20,
      tokenOutput: 5,
      cost: 0.002,
      sessionId: "LLM_API_KEY=abc123supersecret",
    });

    const raw = lines[0] ?? "";
    expect(raw).not.toContain("abc123supersecret");
    const entry = JSON.parse(raw) as Record<string, string | number>;
    expect(entry.traceId).toBe("trace-1");
    expect(entry.spanKind).toBe("llm");
    expect(entry.spanName).toBe("llm.completeStructured");
    expect(entry.latencyMs).toBe(11);
    expect(entry.tokenInput).toBe(20);
    expect(entry.tokenOutput).toBe(5);
    expect(entry.cost).toBe(0.002);
    expect(entry.sessionId).toBe("LLM_API_KEY=[redacted]");
  });
});


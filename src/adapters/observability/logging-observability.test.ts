import { describe, expect, it } from "vitest";
import type { LogEvent, LoggerPort } from "../../domain/ports/logger-port.js";
import { LoggingObservability } from "./logging-observability.js";

describe("LoggingObservability", () => {
  it("should_log_span_metadata_without_retaining_payloads", () => {
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
      resultBounded: { ok: true },
      argumentsRedacted: { text: "[redacted]" },
    });

    expect(observability).not.toHaveProperty("spans");
    expect(events).toEqual([
      {
        operation: "trace.tool",
        outcome: "success",
        status: "ok",
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("normalizedText");
  });
});

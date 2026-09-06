import type { LoggerPort, LogEvent } from "../../domain/ports/logger-port.js";
import { redactSecrets } from "../../domain/redact.js";

export type LogWriter = (line: string) => void;

export class JsonLogger implements LoggerPort {
  constructor(private readonly write: LogWriter = (line) => process.stdout.write(`${line}\n`)) {}

  log(event: LogEvent): void {
    const record: Record<string, string | number> = {
      operation: redactSecrets(event.operation),
      outcome: event.outcome,
    };

    if (event.errorCode !== undefined) {
      record.errorCode = redactSecrets(event.errorCode);
    }

    if (event.message !== undefined) {
      record.message = redactSecrets(event.message);
    }

    if (event.sessionId !== undefined) {
      record.sessionId = redactSecrets(event.sessionId);
    }

    if (event.requestId !== undefined) {
      record.requestId = redactSecrets(event.requestId);
    }

    if (event.interactionId !== undefined) {
      record.interactionId = redactSecrets(event.interactionId);
    }

    if (event.eventType !== undefined) {
      record.eventType = redactSecrets(event.eventType);
    }

    if (event.occurredAt !== undefined) {
      record.occurredAt = redactSecrets(event.occurredAt);
    }

    if (event.processingTimeMs !== undefined) {
      record.processingTimeMs = event.processingTimeMs;
    }

    if (event.status !== undefined) {
      record.status = redactSecrets(event.status);
    }

    if (event.traceId !== undefined) {
      record.traceId = redactSecrets(event.traceId);
    }

    if (event.spanKind !== undefined) {
      record.spanKind = redactSecrets(event.spanKind);
    }

    if (event.spanName !== undefined) {
      record.spanName = redactSecrets(event.spanName);
    }

    if (event.latencyMs !== undefined) {
      record.latencyMs = event.latencyMs;
    }

    if (event.tokenInput !== undefined) {
      record.tokenInput = event.tokenInput;
    }

    if (event.tokenOutput !== undefined) {
      record.tokenOutput = event.tokenOutput;
    }

    if (event.cost !== undefined) {
      record.cost = event.cost;
    }

    this.write(JSON.stringify(record));
  }
}

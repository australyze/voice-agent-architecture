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

    if (event.processingTimeMs !== undefined) {
      record.processingTimeMs = event.processingTimeMs;
    }

    if (event.status !== undefined) {
      record.status = redactSecrets(event.status);
    }

    this.write(JSON.stringify(record));
  }
}

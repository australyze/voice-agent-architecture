import type { LoggerPort, LogEvent } from "../../domain/ports/logger-port.js";
import { redactSecrets } from "../../domain/redact.js";

export type LogWriter = (line: string) => void;

export class JsonLogger implements LoggerPort {
  constructor(private readonly write: LogWriter = (line) => process.stdout.write(`${line}\n`)) {}

  log(event: LogEvent): void {
    const record: Record<string, string> = {
      operation: redactSecrets(event.operation),
      outcome: event.outcome,
    };

    if (event.errorCode !== undefined) {
      record.errorCode = redactSecrets(event.errorCode);
    }

    if (event.message !== undefined) {
      record.message = redactSecrets(event.message);
    }

    this.write(JSON.stringify(record));
  }
}

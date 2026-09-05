import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { ObservabilityPort, TraceSpan } from "../../domain/ports/observability-port.js";

export class LoggingObservability implements ObservabilityPort {
  constructor(private readonly logger: LoggerPort) {}

  emit(span: TraceSpan): void {
    this.logger.log({
      operation: `trace.${span.kind}`,
      outcome: span.status === "ok" ? "success" : "failure",
      ...(span.errorCode === undefined ? {} : { errorCode: span.errorCode }),
      status: span.status,
    });
  }
}

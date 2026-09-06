import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { ObservabilityPort, TraceSpan } from "../../domain/ports/observability-port.js";

export class LoggingObservability implements ObservabilityPort {
  constructor(private readonly logger: LoggerPort) {}

  emit(span: TraceSpan): void {
    this.logger.log({
      operation: `trace.${span.kind}`,
      outcome: span.status === "ok" ? "success" : "failure",
      status: span.status,
      traceId: span.traceId,
      spanKind: span.kind,
      spanName: span.name,
      ...(span.sessionId === undefined ? {} : { sessionId: span.sessionId }),
      ...(span.requestId === undefined ? {} : { requestId: span.requestId }),
      ...(span.interactionId === undefined ? {} : { interactionId: span.interactionId }),
      ...(span.latencyMs === undefined ? {} : { latencyMs: span.latencyMs }),
      ...(span.errorCode === undefined ? {} : { errorCode: span.errorCode }),
      ...(span.tokenInput === undefined ? {} : { tokenInput: span.tokenInput }),
      ...(span.tokenOutput === undefined ? {} : { tokenOutput: span.tokenOutput }),
      ...(span.cost === undefined ? {} : { cost: span.cost }),
    });
  }
}

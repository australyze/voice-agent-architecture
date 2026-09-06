import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { ObservabilityPort, TraceSpan } from "../../domain/ports/observability-port.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";
import { persistSafely, persistSpan } from "../../application/persist-execution.js";

export class PersistingObservability implements ObservabilityPort {
  constructor(
    private readonly inner: ObservabilityPort,
    private readonly persistence: PersistencePort,
    private readonly logger: LoggerPort,
  ) {}

  emit(span: TraceSpan): void {
    this.inner.emit(span);
    void persistSafely(() => persistSpan(this.persistence, span), this.logger, {
      ...(span.sessionId === undefined ? {} : { sessionId: span.sessionId }),
      traceId: span.traceId,
    });
  }
}

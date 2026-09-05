import type { ObservabilityPort, TraceSpan } from "../../domain/ports/observability-port.js";

export class MemoryObservability implements ObservabilityPort {
  readonly spans: TraceSpan[] = [];

  emit(span: TraceSpan): void {
    this.spans.push(span);
  }
}

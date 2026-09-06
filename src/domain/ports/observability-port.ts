export type SpanKind = "llm" | "tool" | "retrieval" | "http" | "workflow" | "voice";

export type TraceSpan = {
  name: string;
  kind: SpanKind;
  status: "ok" | "error";
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  sessionId?: string;
  requestId?: string;
  interactionId?: string;
  promptId?: string;
  promptVersion?: string;
  modelId?: string;
  latencyMs?: number;
  tokenInput?: number;
  tokenOutput?: number;
  cost?: number;
  retryCount?: number;
  toolName?: string;
  source?: string;
  argumentsRedacted?: unknown;
  resultBounded?: unknown;
  validationOk?: boolean;
  errorCode?: string;
  corpusVersion?: string;
  retrieverVersion?: string;
};

export type ObservabilityPort = {
  emit(span: TraceSpan): void;
};

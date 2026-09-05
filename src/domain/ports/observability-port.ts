export type SpanKind = "llm" | "tool" | "retrieval" | "http" | "workflow" | "voice";

export type TraceSpan = {
  name: string;
  kind: SpanKind;
  status: "ok" | "error";
  promptId?: string;
  promptVersion?: string;
  modelId?: string;
  latencyMs?: number;
  toolName?: string;
  argumentsRedacted?: unknown;
  resultBounded?: unknown;
  validationOk?: boolean;
  errorCode?: string;
};

export type ObservabilityPort = {
  emit(span: TraceSpan): void;
};

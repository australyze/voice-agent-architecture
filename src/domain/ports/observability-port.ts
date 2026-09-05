export type SpanKind = "llm" | "tool" | "retrieval" | "http" | "workflow" | "voice";

export type TraceSpan = {
  name: string;
  kind: SpanKind;
  status: "ok" | "error";
};

export type ObservabilityPort = {
  emit(span: TraceSpan): void;
};

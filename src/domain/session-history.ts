import type { SpanKind } from "./ports/observability-port.js";

export const SESSION_BUSINESS_STATUSES = ["initiated", "active", "completed", "failed"] as const;
export type SessionBusinessStatus = (typeof SESSION_BUSINESS_STATUSES)[number];

export const SESSION_MEDIA_STATUSES = ["idle", "connecting", "active", "ended"] as const;
export type SessionMediaStatus = (typeof SESSION_MEDIA_STATUSES)[number];

export const CONVERSATION_ROLES = ["user", "assistant"] as const;
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];

export const TOOL_CALL_STATUSES = ["running", "succeeded", "failed", "timed_out", "denied"] as const;
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number];

export type SessionRecord = {
  id: string;
  agentId: string;
  channel: "voice";
  externalChannelId?: string;
  traceId?: string;
  businessStatus: SessionBusinessStatus;
  mediaStatus: SessionMediaStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
};

export type ConversationTurnRecord = {
  id: string;
  sessionId: string;
  index: number;
  role: ConversationRole;
  text: string;
  createdAt: string;
  idempotencyKey: string;
};

export type ToolCallRecord = {
  id: string;
  sessionId: string;
  interactionId?: string;
  toolName: string;
  status: ToolCallStatus;
  arguments: unknown;
  result?: unknown;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorClass?: string;
  idempotencyKey: string;
};

export type ExecutionEventRecord = {
  id: string;
  sessionId: string;
  traceId: string;
  interactionId?: string;
  kind: SpanKind;
  name: string;
  status: "ok" | "error";
  timestamp: string;
  durationMs?: number;
  metadata?: unknown;
  errorCode?: string;
  idempotencyKey: string;
};

export type SessionListItem = {
  sessionId: string;
  startedAt: string;
  durationMs?: number;
  status: SessionBusinessStatus;
  agentId: string;
  turnCount: number;
  toolCallCount: number;
};

export type SessionReportMetrics = {
  turnCount: number;
  toolCallCount: number;
  errorCount: number;
  successfulToolCount: number;
  failedToolCount: number;
  averageToolLatencyMs?: number;
  llmCallCount: number;
};

export type SessionReport = {
  sessionId: string;
  traceId?: string;
  agentId: string;
  status: SessionBusinessStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  metrics: SessionReportMetrics;
  transcript: Array<{ id: string; role: ConversationRole; text: string; timestamp: string }>;
  toolCalls: ToolCallRecord[];
  trace: ExecutionEventRecord[];
  evaluation: null;
};

export type UpsertSessionInput = {
  sessionId: string;
  agentId: string;
  externalChannelId?: string;
  traceId?: string;
  eventType: "call_started" | "call_ended" | "transcript";
  occurredAt: string;
  idempotencyKey: string;
};

export type RecordTurnInput = {
  sessionId: string;
  role: ConversationRole;
  text: string;
  createdAt: string;
  idempotencyKey: string;
};

export type RecordToolCallInput = Omit<ToolCallRecord, "id"> & { id?: string };

export type RecordExecutionEventInput = Omit<ExecutionEventRecord, "id"> & { id?: string };

export function inboundIdempotencyKey(input: {
  eventType: string;
  sessionId: string;
  externalChannelId?: string;
  occurredAt: string;
  inputText?: string;
  requestId?: string;
}): string {
  return [
    input.eventType,
    input.externalChannelId ?? input.sessionId,
    input.occurredAt,
    input.inputText ?? "",
    input.requestId ?? "",
  ].join("|");
}

export function spanIdempotencyKey(traceId: string, spanId: string): string {
  return `${traceId}|${spanId}`;
}

import { randomUUID } from "node:crypto";
import type { ListSessionsQuery, PersistencePort } from "../../domain/ports/persistence-port.js";
import type { SessionCallEvaluation } from "../../domain/session-call-evaluation.js";
import type {
  ConversationTurnRecord,
  ExecutionEventRecord,
  RecordExecutionEventInput,
  RecordToolCallInput,
  RecordTurnInput,
  SessionListItem,
  SessionRecord,
  SessionReport,
  SessionReportMetrics,
  ToolCallRecord,
  UpsertSessionInput,
} from "../../domain/session-history.js";

export class MemoryPersistence implements PersistencePort {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly sessionIdByExternal = new Map<string, string>();
  private readonly sessionIdempotency = new Set<string>();
  private readonly turns: ConversationTurnRecord[] = [];
  private readonly toolCalls: ToolCallRecord[] = [];
  private readonly events: ExecutionEventRecord[] = [];
  private readonly turnKeys = new Map<string, ConversationTurnRecord>();
  private readonly toolKeys = new Map<string, ToolCallRecord>();
  private readonly eventKeys = new Map<string, ExecutionEventRecord>();

  async ping(): Promise<void> {
    return undefined;
  }

  async upsertSession(input: UpsertSessionInput): Promise<SessionRecord> {
    if (this.sessionIdempotency.has(input.idempotencyKey)) {
      return this.resolveExisting(input);
    }

    const existing = this.findSession(input);
    const now = input.occurredAt;
    const next = existing === undefined ? this.createSession(input, now) : { ...existing };

    if (input.externalChannelId !== undefined) {
      next.externalChannelId = input.externalChannelId;
      this.sessionIdByExternal.set(input.externalChannelId, next.id);
    }
    if (input.traceId !== undefined) {
      next.traceId = input.traceId;
    }
    next.agentId = input.agentId;
    next.updatedAt = now;

    if (input.eventType === "call_started") {
      if (existing === undefined || next.startedAt > now) {
        next.startedAt = now;
      }
      if (next.businessStatus !== "completed" && next.businessStatus !== "failed") {
        next.businessStatus = "active";
        next.mediaStatus = "active";
      }
    } else if (input.eventType === "transcript") {
      if (next.businessStatus !== "completed" && next.businessStatus !== "failed") {
        next.businessStatus = "active";
        next.mediaStatus = "active";
      }
    } else {
      next.endedAt = now;
      next.mediaStatus = "ended";
      if (next.businessStatus !== "failed") {
        next.businessStatus = "completed";
      }
      const start = Date.parse(next.startedAt);
      const end = Date.parse(now);
      next.durationMs = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
    }

    this.sessions.set(next.id, next);
    this.sessionIdempotency.add(input.idempotencyKey);
    return next;
  }

  async recordTurn(input: RecordTurnInput): Promise<ConversationTurnRecord> {
    const existing = this.turnKeys.get(input.idempotencyKey);
    if (existing !== undefined) {
      return existing;
    }
    const sessionTurns = this.turns.filter((turn) => turn.sessionId === input.sessionId);
    const record: ConversationTurnRecord = {
      id: randomUUID(),
      sessionId: input.sessionId,
      index: sessionTurns.length,
      role: input.role,
      text: input.text,
      createdAt: input.createdAt,
      idempotencyKey: input.idempotencyKey,
    };
    this.turns.push(record);
    this.turnKeys.set(input.idempotencyKey, record);
    return record;
  }

  async recordToolCall(input: RecordToolCallInput): Promise<ToolCallRecord> {
    const existing = this.toolKeys.get(input.idempotencyKey);
    if (existing !== undefined) {
      return existing;
    }
    const record: ToolCallRecord = {
      id: input.id ?? randomUUID(),
      sessionId: input.sessionId,
      toolName: input.toolName,
      status: input.status,
      arguments: input.arguments,
      startedAt: input.startedAt,
      idempotencyKey: input.idempotencyKey,
      ...(input.interactionId === undefined ? {} : { interactionId: input.interactionId }),
      ...(input.result === undefined ? {} : { result: input.result }),
      ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
      ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
      ...(input.errorClass === undefined ? {} : { errorClass: input.errorClass }),
    };
    this.toolCalls.push(record);
    this.toolKeys.set(input.idempotencyKey, record);
    return record;
  }

  async recordExecutionEvent(input: RecordExecutionEventInput): Promise<ExecutionEventRecord> {
    const existing = this.eventKeys.get(input.idempotencyKey);
    if (existing !== undefined) {
      return existing;
    }
    const record: ExecutionEventRecord = {
      id: input.id ?? randomUUID(),
      sessionId: input.sessionId,
      traceId: input.traceId,
      kind: input.kind,
      name: input.name,
      status: input.status,
      timestamp: input.timestamp,
      idempotencyKey: input.idempotencyKey,
      ...(input.interactionId === undefined ? {} : { interactionId: input.interactionId }),
      ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
    };
    this.events.push(record);
    this.eventKeys.set(input.idempotencyKey, record);
    return record;
  }

  async listSessions(query: ListSessionsQuery = {}): Promise<SessionListItem[]> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const rows = [...this.sessions.values()]
      .filter((session) => query.channel === undefined || session.channel === query.channel)
      .filter(
        (session) =>
          query.externalChannelId === undefined || session.externalChannelId === query.externalChannelId,
      )
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .slice(0, limit);
    return rows.map((session) => ({
      sessionId: session.id,
      startedAt: session.startedAt,
      status: session.businessStatus,
      agentId: session.agentId,
      turnCount: this.turns.filter((turn) => turn.sessionId === session.id).length,
      toolCallCount: this.toolCalls.filter((call) => call.sessionId === session.id).length,
      ...(session.durationMs === undefined ? {} : { durationMs: session.durationMs }),
    }));
  }

  async getSessionReport(sessionId: string): Promise<SessionReport | null> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return null;
    }
    const transcript = this.turns
      .filter((turn) => turn.sessionId === sessionId)
      .sort((left, right) => left.index - right.index);
    const toolCalls = this.toolCalls.filter((call) => call.sessionId === sessionId);
    const trace = this.events
      .filter((event) => event.sessionId === sessionId)
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
    return {
      sessionId: session.id,
      agentId: session.agentId,
      status: session.businessStatus,
      startedAt: session.startedAt,
      metrics: computeMetrics(transcript.length, toolCalls, trace),
      transcript: transcript.map((turn) => ({
        id: turn.id,
        role: turn.role,
        text: turn.text,
        timestamp: turn.createdAt,
      })),
      toolCalls,
      trace,
      evaluation: session.evaluation ?? null,
      ...(session.traceId === undefined ? {} : { traceId: session.traceId }),
      ...(session.endedAt === undefined ? {} : { endedAt: session.endedAt }),
      ...(session.durationMs === undefined ? {} : { durationMs: session.durationMs }),
    };
  }

  async saveSessionEvaluation(sessionId: string, evaluation: SessionCallEvaluation): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error(`session not found: ${sessionId}`);
    }
    this.sessions.set(sessionId, { ...session, evaluation, updatedAt: evaluation.evaluatedAt });
  }

  private findSession(input: UpsertSessionInput): SessionRecord | undefined {
    if (input.externalChannelId !== undefined) {
      const mapped = this.sessionIdByExternal.get(input.externalChannelId);
      if (mapped !== undefined) {
        return this.sessions.get(mapped);
      }
    }
    return this.sessions.get(input.sessionId);
  }

  private resolveExisting(input: UpsertSessionInput): SessionRecord {
    const found = this.findSession(input) ?? this.sessions.get(input.sessionId);
    if (found === undefined) {
      return this.createSession(input, input.occurredAt);
    }
    return found;
  }

  private createSession(input: UpsertSessionInput, now: string): SessionRecord {
    const record: SessionRecord = {
      id: input.sessionId,
      agentId: input.agentId,
      channel: "voice",
      businessStatus: "initiated",
      mediaStatus: "idle",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(record.id, record);
    return record;
  }
}

function computeMetrics(
  turnCount: number,
  toolCalls: ToolCallRecord[],
  events: ExecutionEventRecord[],
): SessionReportMetrics {
  const successful = toolCalls.filter((call) => call.status === "succeeded").length;
  const failed = toolCalls.filter((call) => call.status === "failed" || call.status === "timed_out").length;
  const latencies = toolCalls
    .map((call) => call.durationMs)
    .filter((value): value is number => value !== undefined);
  const averageToolLatencyMs =
    latencies.length === 0 ? undefined : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);
  return {
    turnCount,
    toolCallCount: toolCalls.length,
    errorCount: events.filter((event) => event.status === "error").length,
    successfulToolCount: successful,
    failedToolCount: failed,
    llmCallCount: events.filter((event) => event.kind === "llm").length,
    ...(averageToolLatencyMs === undefined ? {} : { averageToolLatencyMs }),
  };
}

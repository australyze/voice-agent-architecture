import { randomUUID } from "node:crypto";
import { DependencyError } from "../../domain/errors.js";
import type { ListSessionsQuery, PersistencePort } from "../../domain/ports/persistence-port.js";
import type {
  ConversationTurnRecord,
  ExecutionEventRecord,
  RecordExecutionEventInput,
  RecordToolCallInput,
  RecordTurnInput,
  SessionListItem,
  SessionRecord,
  SessionReport,
  ToolCallRecord,
  UpsertSessionInput,
} from "../../domain/session-history.js";
import { MemoryPersistence } from "./memory-persistence.js";

export class SupabasePersistence implements PersistencePort {
  private readonly fallback = new MemoryPersistence();

  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  async ping(): Promise<void> {
    await this.request("GET", "/rest/v1/sessions?select=id&limit=1");
  }

  async upsertSession(input: UpsertSessionInput): Promise<SessionRecord> {
    return this.withFallback(() => this.fallback.upsertSession(input), async () => {
      const existing = await this.findSession(input);
      const now = input.occurredAt;
      const next = existing ?? {
        id: input.sessionId,
        agent_id: input.agentId,
        channel: "voice",
        external_channel_id: input.externalChannelId ?? null,
        trace_id: input.traceId ?? null,
        business_status: "initiated",
        media_status: "idle",
        started_at: now,
        ended_at: null,
        duration_ms: null,
        created_at: now,
        updated_at: now,
      };
      next.agent_id = input.agentId;
      next.updated_at = now;
      if (input.externalChannelId !== undefined) {
        next.external_channel_id = input.externalChannelId;
      }
      if (input.traceId !== undefined) {
        next.trace_id = input.traceId;
      }
      if (input.eventType === "call_started" || input.eventType === "transcript") {
        if (next.business_status !== "completed" && next.business_status !== "failed") {
          next.business_status = "active";
          next.media_status = "active";
        }
        if (input.eventType === "call_started") {
          next.started_at = now;
        }
      } else {
        next.ended_at = now;
        next.media_status = "ended";
        next.business_status = next.business_status === "failed" ? "failed" : "completed";
        next.duration_ms = Math.max(0, Date.parse(now) - Date.parse(String(next.started_at)));
      }
      await this.request("POST", "/rest/v1/sessions?on_conflict=id", next, {
        Prefer: "resolution=merge-duplicates,return=representation",
      });
      return this.toSession(next);
    });
  }

  async recordTurn(input: RecordTurnInput): Promise<ConversationTurnRecord> {
    return this.withFallback(() => this.fallback.recordTurn(input), async () => {
      const existing = await this.request<Array<{ id: string; sequence_number: number }>>(
        "GET",
        `/rest/v1/conversation_turns?idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&select=id,sequence_number`,
      );
      if (existing[0] !== undefined) {
        return {
          id: existing[0].id,
          sessionId: input.sessionId,
          index: existing[0].sequence_number,
          role: input.role,
          text: input.text,
          createdAt: input.createdAt,
          idempotencyKey: input.idempotencyKey,
        };
      }
      const siblings = await this.request<Array<{ id: string }>>(
        "GET",
        `/rest/v1/conversation_turns?session_id=eq.${input.sessionId}&select=id`,
      );
      const row = {
        id: randomUUID(),
        session_id: input.sessionId,
        sequence_number: siblings.length,
        role: input.role,
        text: input.text,
        created_at: input.createdAt,
        idempotency_key: input.idempotencyKey,
      };
      await this.request("POST", "/rest/v1/conversation_turns", row);
      return {
        id: row.id,
        sessionId: input.sessionId,
        index: row.sequence_number,
        role: input.role,
        text: input.text,
        createdAt: input.createdAt,
        idempotencyKey: input.idempotencyKey,
      };
    });
  }

  async recordToolCall(input: RecordToolCallInput): Promise<ToolCallRecord> {
    return this.withFallback(() => this.fallback.recordToolCall(input), async () => {
      const existing = await this.request<Array<{ id: string }>>(
        "GET",
        `/rest/v1/tool_calls?idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&select=id`,
      );
      if (existing[0] !== undefined) {
        return { ...input, id: existing[0].id };
      }
      const id = input.id ?? randomUUID();
      await this.request("POST", "/rest/v1/tool_calls", {
        id,
        session_id: input.sessionId,
        interaction_id: input.interactionId ?? null,
        tool_name: input.toolName,
        status: input.status,
        arguments: input.arguments ?? {},
        result: input.result ?? null,
        started_at: input.startedAt,
        completed_at: input.completedAt ?? null,
        duration_ms: input.durationMs ?? null,
        error_class: input.errorClass ?? null,
        invocation_source: input.invocationSource ?? null,
        idempotency_key: input.idempotencyKey,
      });
      return { ...input, id };
    });
  }

  async recordExecutionEvent(input: RecordExecutionEventInput): Promise<ExecutionEventRecord> {
    return this.withFallback(() => this.fallback.recordExecutionEvent(input), async () => {
      const existing = await this.request<Array<{ id: string }>>(
        "GET",
        `/rest/v1/execution_events?idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&select=id`,
      );
      if (existing[0] !== undefined) {
        return { ...input, id: existing[0].id };
      }
      const id = input.id ?? randomUUID();
      await this.request("POST", "/rest/v1/execution_events", {
        id,
        session_id: input.sessionId,
        trace_id: input.traceId,
        interaction_id: input.interactionId ?? null,
        kind: input.kind,
        name: input.name,
        status: input.status,
        occurred_at: input.timestamp,
        duration_ms: input.durationMs ?? null,
        metadata: input.metadata ?? null,
        error_code: input.errorCode ?? null,
        idempotency_key: input.idempotencyKey,
      });
      return { ...input, id };
    });
  }

  async listSessions(query: ListSessionsQuery = {}): Promise<SessionListItem[]> {
    return this.withFallback(() => this.fallback.listSessions(query), async () => {
      const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
      const channelFilter =
        query.externalChannelId === undefined
          ? ""
          : `&external_channel_id=eq.${encodeURIComponent(query.externalChannelId)}`;
      const rows = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/rest/v1/sessions?channel=eq.voice${channelFilter}&select=*&order=started_at.desc&limit=${limit}`,
      );
      const items: SessionListItem[] = [];
      for (const row of rows) {
        const id = String(row.id);
        const turns = await this.request<Array<{ id: string }>>(
          "GET",
          `/rest/v1/conversation_turns?session_id=eq.${id}&select=id`,
        );
        const tools = await this.request<Array<{ id: string }>>(
          "GET",
          `/rest/v1/tool_calls?session_id=eq.${id}&select=id`,
        );
        items.push({
          sessionId: id,
          startedAt: String(row.started_at),
          status: row.business_status as SessionListItem["status"],
          agentId: String(row.agent_id),
          turnCount: turns.length,
          toolCallCount: tools.length,
          ...(row.duration_ms == null ? {} : { durationMs: Number(row.duration_ms) }),
        });
      }
      return items;
    });
  }

  async getSessionReport(sessionId: string): Promise<SessionReport | null> {
    return this.withFallback(() => this.fallback.getSessionReport(sessionId), async () => {
      const sessions = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/rest/v1/sessions?id=eq.${sessionId}&select=*`,
      );
      const session = sessions[0];
      if (session === undefined) {
        return null;
      }
      const memory = new MemoryPersistence();
      await memory.upsertSession({
        sessionId,
        agentId: String(session.agent_id),
        eventType: session.ended_at == null ? "call_started" : "call_ended",
        occurredAt: String(session.started_at),
        idempotencyKey: `hydrate:${sessionId}:session`,
        ...(session.external_channel_id == null ? {} : { externalChannelId: String(session.external_channel_id) }),
        ...(session.trace_id == null ? {} : { traceId: String(session.trace_id) }),
      });
      if (session.ended_at != null) {
        await memory.upsertSession({
          sessionId,
          agentId: String(session.agent_id),
          eventType: "call_ended",
          occurredAt: String(session.ended_at),
          idempotencyKey: `hydrate:${sessionId}:end`,
        });
      }
      const turns = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/rest/v1/conversation_turns?session_id=eq.${sessionId}&select=*&order=sequence_number.asc`,
      );
      for (const turn of turns) {
        await memory.recordTurn({
          sessionId,
          role: turn.role as ConversationTurnRecord["role"],
          text: String(turn.text),
          createdAt: String(turn.created_at),
          idempotencyKey: String(turn.idempotency_key),
        });
      }
      const tools = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/rest/v1/tool_calls?session_id=eq.${sessionId}&select=*`,
      );
      for (const tool of tools) {
        await memory.recordToolCall({
          sessionId,
          toolName: String(tool.tool_name),
          status: tool.status as ToolCallRecord["status"],
          arguments: tool.arguments,
          startedAt: String(tool.started_at),
          idempotencyKey: String(tool.idempotency_key),
          ...(tool.interaction_id == null ? {} : { interactionId: String(tool.interaction_id) }),
          ...(tool.result == null ? {} : { result: tool.result }),
          ...(tool.completed_at == null ? {} : { completedAt: String(tool.completed_at) }),
          ...(tool.duration_ms == null ? {} : { durationMs: Number(tool.duration_ms) }),
          ...(tool.error_class == null ? {} : { errorClass: String(tool.error_class) }),
          ...(tool.invocation_source == null ? {} : { invocationSource: String(tool.invocation_source) }),
        });
      }
      const events = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/rest/v1/execution_events?session_id=eq.${sessionId}&select=*&order=occurred_at.asc`,
      );
      for (const event of events) {
        await memory.recordExecutionEvent({
          sessionId,
          traceId: String(event.trace_id),
          kind: event.kind as ExecutionEventRecord["kind"],
          name: String(event.name),
          status: event.status as ExecutionEventRecord["status"],
          timestamp: String(event.occurred_at),
          idempotencyKey: String(event.idempotency_key),
          ...(event.interaction_id == null ? {} : { interactionId: String(event.interaction_id) }),
          ...(event.duration_ms == null ? {} : { durationMs: Number(event.duration_ms) }),
          ...(event.metadata == null ? {} : { metadata: event.metadata }),
          ...(event.error_code == null ? {} : { errorCode: String(event.error_code) }),
        });
      }
      if (session.evaluation != null && typeof session.evaluation === "object") {
        await memory.saveSessionEvaluation(
          sessionId,
          session.evaluation as import("../../domain/session-call-evaluation.js").SessionCallEvaluation,
        );
      }
      return memory.getSessionReport(sessionId);
    });
  }

  async saveSessionEvaluation(sessionId: string, evaluation: import("../../domain/session-call-evaluation.js").SessionCallEvaluation): Promise<void> {
    return this.withFallback(() => this.fallback.saveSessionEvaluation(sessionId, evaluation), async () => {
      await this.request(
        "PATCH",
        `/rest/v1/sessions?id=eq.${sessionId}`,
        { evaluation, updated_at: evaluation.evaluatedAt },
        { Prefer: "return=minimal" },
      );
    });
  }

  private async findSession(input: UpsertSessionInput): Promise<Record<string, string | number | null> | undefined> {
    if (input.externalChannelId !== undefined) {
      const byExternal = await this.request<Array<Record<string, string | number | null>>>(
        "GET",
        `/rest/v1/sessions?external_channel_id=eq.${encodeURIComponent(input.externalChannelId)}&select=*`,
      );
      if (byExternal[0] !== undefined) {
        return byExternal[0];
      }
    }
    const byId = await this.request<Array<Record<string, string | number | null>>>(
      "GET",
      `/rest/v1/sessions?id=eq.${input.sessionId}&select=*`,
    );
    return byId[0];
  }

  private toSession(row: Record<string, string | number | null>): SessionRecord {
    return {
      id: String(row.id),
      agentId: String(row.agent_id),
      channel: "voice",
      businessStatus: row.business_status as SessionRecord["businessStatus"],
      mediaStatus: row.media_status as SessionRecord["mediaStatus"],
      startedAt: String(row.started_at),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      ...(row.external_channel_id == null ? {} : { externalChannelId: String(row.external_channel_id) }),
      ...(row.trace_id == null ? {} : { traceId: String(row.trace_id) }),
      ...(row.ended_at == null ? {} : { endedAt: String(row.ended_at) }),
      ...(row.duration_ms == null ? {} : { durationMs: Number(row.duration_ms) }),
    };
  }

  private async withFallback<T>(fallback: () => Promise<T>, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch {
      return fallback();
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const response = await fetch(`${this.url.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new DependencyError("Persistence is unavailable", "PERSISTENCE_UNAVAILABLE");
    }
    if (response.status === 204) {
      return [] as T;
    }
    return (await response.json()) as T;
  }
}

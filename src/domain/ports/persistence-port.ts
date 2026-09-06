import type { SessionCallEvaluation } from "../session-call-evaluation.js";
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
} from "../session-history.js";

export type ListSessionsQuery = {
  limit?: number;
  channel?: "voice";
  externalChannelId?: string;
};

export type PersistencePort = {
  ping(): Promise<void>;
  upsertSession(input: UpsertSessionInput): Promise<SessionRecord>;
  recordTurn(input: RecordTurnInput): Promise<ConversationTurnRecord>;
  recordToolCall(input: RecordToolCallInput): Promise<ToolCallRecord>;
  recordExecutionEvent(input: RecordExecutionEventInput): Promise<ExecutionEventRecord>;
  listSessions(query?: ListSessionsQuery): Promise<SessionListItem[]>;
  getSessionReport(sessionId: string): Promise<SessionReport | null>;
  saveSessionEvaluation(sessionId: string, evaluation: SessionCallEvaluation): Promise<void>;
};

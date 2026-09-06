import type { ListSessionsQuery, PersistencePort } from "../../domain/ports/persistence-port.js";
import type {
  RecordExecutionEventInput,
  RecordToolCallInput,
  RecordTurnInput,
  UpsertSessionInput,
} from "../../domain/session-history.js";

export function composePersistence(
  readiness: Pick<PersistencePort, "ping">,
  history: PersistencePort,
): PersistencePort {
  return {
    ping: () => readiness.ping(),
    upsertSession: (input: UpsertSessionInput) => history.upsertSession(input),
    recordTurn: (input: RecordTurnInput) => history.recordTurn(input),
    recordToolCall: (input: RecordToolCallInput) => history.recordToolCall(input),
    recordExecutionEvent: (input: RecordExecutionEventInput) => history.recordExecutionEvent(input),
    listSessions: (query?: ListSessionsQuery) => history.listSessions(query),
    getSessionReport: (sessionId: string) => history.getSessionReport(sessionId),
    saveSessionEvaluation: (sessionId, evaluation) => history.saveSessionEvaluation(sessionId, evaluation),
  };
}

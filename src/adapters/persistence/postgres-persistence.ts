import { Client } from "pg";
import { DependencyError } from "../../domain/errors.js";
import type { ListSessionsQuery, PersistencePort } from "../../domain/ports/persistence-port.js";
import type {
  RecordExecutionEventInput,
  RecordToolCallInput,
  RecordTurnInput,
  UpsertSessionInput,
} from "../../domain/session-history.js";
import { MemoryPersistence } from "./memory-persistence.js";

const DEFAULT_PING_TIMEOUT_MS = 2000;

export class PostgresPersistence implements PersistencePort {
  private readonly history = new MemoryPersistence();

  constructor(
    private readonly connectionString: string,
    private readonly timeoutMs: number = DEFAULT_PING_TIMEOUT_MS,
  ) {}

  async ping(): Promise<void> {
    const client = new Client({
      connectionString: this.connectionString,
      connectionTimeoutMillis: this.timeoutMs,
    });

    try {
      await client.connect();
      await client.query("SELECT 1");
    } catch {
      throw new DependencyError("Persistence is unavailable", "PERSISTENCE_UNAVAILABLE");
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  upsertSession(input: UpsertSessionInput) {
    return this.history.upsertSession(input);
  }

  recordTurn(input: RecordTurnInput) {
    return this.history.recordTurn(input);
  }

  recordToolCall(input: RecordToolCallInput) {
    return this.history.recordToolCall(input);
  }

  recordExecutionEvent(input: RecordExecutionEventInput) {
    return this.history.recordExecutionEvent(input);
  }

  listSessions(query?: ListSessionsQuery) {
    return this.history.listSessions(query);
  }

  getSessionReport(sessionId: string) {
    return this.history.getSessionReport(sessionId);
  }

  saveSessionEvaluation(sessionId: string, evaluation: import("../../domain/session-call-evaluation.js").SessionCallEvaluation) {
    return this.history.saveSessionEvaluation(sessionId, evaluation);
  }
}

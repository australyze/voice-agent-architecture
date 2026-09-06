import { DependencyError } from "../../domain/errors.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";
import { MemoryPersistence } from "./memory-persistence.js";

export function createPersistenceStub(ping: PersistencePort["ping"] = async () => undefined): PersistencePort {
  const history = new MemoryPersistence();
  return {
    ping,
    upsertSession: (input) => history.upsertSession(input),
    recordTurn: (input) => history.recordTurn(input),
    recordToolCall: (input) => history.recordToolCall(input),
    recordExecutionEvent: (input) => history.recordExecutionEvent(input),
    listSessions: (query) => history.listSessions(query),
    getSessionReport: (sessionId) => history.getSessionReport(sessionId),
  };
}

export function readyPersistence(): PersistencePort {
  return new MemoryPersistence();
}

export function downPersistence(): PersistencePort {
  const history = new MemoryPersistence();
  return {
    async ping() {
      throw new DependencyError(
        "Persistence is unavailable for postgresql://user:supersecret@localhost:5432/db",
        "PERSISTENCE_UNAVAILABLE",
      );
    },
    upsertSession: (input) => history.upsertSession(input),
    recordTurn: (input) => history.recordTurn(input),
    recordToolCall: (input) => history.recordToolCall(input),
    recordExecutionEvent: (input) => history.recordExecutionEvent(input),
    listSessions: (query) => history.listSessions(query),
    getSessionReport: (sessionId) => history.getSessionReport(sessionId),
  };
}

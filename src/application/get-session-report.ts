import { NotFoundError } from "../domain/errors.js";
import type { PersistencePort } from "../domain/ports/persistence-port.js";
import type { SessionListItem, SessionReport } from "../domain/session-history.js";
import { attachEvaluationToReport } from "./ensure-session-evaluation.js";

const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertSessionId(sessionId: string): void {
  if (!SESSION_UUID_PATTERN.test(sessionId)) {
    throw new NotFoundError("Session identifier is invalid", "SESSION_ID_INVALID");
  }
}

export async function getSessionReport(
  persistence: PersistencePort,
  sessionId: string,
  options?: { recompute?: boolean; allowWrite?: boolean },
): Promise<SessionReport> {
  assertSessionId(sessionId);
  const report = await persistence.getSessionReport(sessionId);
  if (report === null) {
    throw new NotFoundError();
  }
  return attachEvaluationToReport(persistence, report, options);
}

export async function listSessionReports(
  persistence: PersistencePort,
  query: { limit?: number; externalChannelId?: string },
): Promise<SessionListItem[]> {
  return persistence.listSessions({
    channel: "voice",
    ...(query.limit === undefined ? {} : { limit: query.limit }),
    ...(query.externalChannelId === undefined ? {} : { externalChannelId: query.externalChannelId }),
  });
}

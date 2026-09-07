import type { PersistencePort } from "../domain/ports/persistence-port.js";
import type { SessionCallEvaluation } from "../domain/session-call-evaluation.js";
import type { SessionReport } from "../domain/session-history.js";
import { scoreSessionCall } from "./score-session-call.js";

export async function ensureSessionEvaluation(
  persistence: PersistencePort,
  sessionId: string,
  options?: { force?: boolean; evaluatedAt?: string },
): Promise<SessionCallEvaluation | null> {
  const report = await persistence.getSessionReport(sessionId);
  if (report === null) {
    return null;
  }
  if (report.status !== "completed" && report.status !== "failed") {
    return report.evaluation ?? null;
  }
  if (report.evaluation !== null && options?.force !== true) {
    return report.evaluation;
  }
  const evaluation = scoreSessionCall(report, {
    ...(options?.evaluatedAt === undefined ? {} : { evaluatedAt: options.evaluatedAt }),
  });
  await persistence.saveSessionEvaluation(sessionId, evaluation);
  return evaluation;
}

/**
 * Attach evaluation for HTTP reads.
 * - `allowWrite: false` (public token): return persisted evaluation only; never score/write.
 * - `allowWrite: true` (operator): recompute and/or lazy-backfill when missing.
 */
export async function attachEvaluationToReport(
  persistence: PersistencePort,
  report: SessionReport,
  options?: { recompute?: boolean; allowWrite?: boolean },
): Promise<SessionReport> {
  if (report.status !== "completed" && report.status !== "failed") {
    return report;
  }
  const allowWrite = options?.allowWrite === true;
  if (!allowWrite) {
    return report;
  }
  const evaluation = await ensureSessionEvaluation(persistence, report.sessionId, {
    force: options?.recompute === true,
  });
  return { ...report, evaluation };
}

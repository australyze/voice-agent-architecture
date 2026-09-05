import type { LoggerPort } from "../domain/ports/logger-port.js";
import type { PersistencePort } from "../domain/ports/persistence-port.js";

export type ReadinessResult = {
  status: "ready";
};

export async function checkReadiness(
  persistence: PersistencePort,
  logger: LoggerPort,
): Promise<ReadinessResult> {
  try {
    await persistence.ping();
    logger.log({ operation: "persistence.ping", outcome: "success" });
    return { status: "ready" };
  } catch (error) {
    const errorCode = error instanceof Error && "code" in error ? String(error.code) : "PERSISTENCE_UNAVAILABLE";
    logger.log({
      operation: "persistence.ping",
      outcome: "failure",
      errorCode,
    });
    throw error;
  }
}

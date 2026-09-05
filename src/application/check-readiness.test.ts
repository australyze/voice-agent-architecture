import { describe, expect, it, vi } from "vitest";
import { DependencyError } from "../domain/errors.js";
import type { LoggerPort } from "../domain/ports/logger-port.js";
import type { PersistencePort } from "../domain/ports/persistence-port.js";
import { checkReadiness } from "./check-readiness.js";

function createLogger(): LoggerPort & { events: Array<{ operation: string; outcome: string }> } {
  const events: Array<{ operation: string; outcome: string }> = [];
  return {
    events,
    log(event) {
      events.push({ operation: event.operation, outcome: event.outcome });
    },
  };
}

describe("checkReadiness", () => {
  it("should_use_the_persistence_port_instead_of_a_database_engine", async () => {
    const ping = vi.fn().mockResolvedValue(undefined);
    const persistence: PersistencePort = { ping };
    const logger = createLogger();

    await expect(checkReadiness(persistence, logger)).resolves.toEqual({ status: "ready" });
    expect(ping).toHaveBeenCalledOnce();
    expect(logger.events).toContainEqual({ operation: "persistence.ping", outcome: "success" });
  });

  it("should_surface_port_failures_without_connection_secrets", async () => {
    const persistence: PersistencePort = {
      async ping() {
        throw new DependencyError("Persistence is unavailable", "PERSISTENCE_UNAVAILABLE");
      },
    };
    const logger = createLogger();

    await expect(checkReadiness(persistence, logger)).rejects.toBeInstanceOf(DependencyError);
    expect(logger.events[0]).toMatchObject({ operation: "persistence.ping", outcome: "failure" });
  });
});

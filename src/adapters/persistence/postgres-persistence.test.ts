import { describe, expect, it } from "vitest";
import { DependencyError } from "../../domain/errors.js";
import { PostgresPersistence } from "./postgres-persistence.js";

const LOCAL_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://voice_agent:voice_agent@127.0.0.1:5433/voice_agent";

describe("PostgresPersistence", () => {
  it("should_report_unavailable_without_credentials_when_connection_fails", async () => {
    const persistence = new PostgresPersistence(
      "postgresql://user:supersecret@127.0.0.1:1/voice_agent",
      250,
    );

    try {
      await persistence.ping();
      throw new Error("expected DependencyError");
    } catch (error) {
      expect(error).toBeInstanceOf(DependencyError);
      const dependencyError = error as DependencyError;
      expect(dependencyError.code).toBe("PERSISTENCE_UNAVAILABLE");
      expect(dependencyError.message).toBe("Persistence is unavailable");
      expect(dependencyError.message).not.toContain("supersecret");
      expect(JSON.stringify(dependencyError)).not.toContain("supersecret");
    }
  });

  it("should_ping_through_the_persistence_port_when_compose_is_available", async () => {
    const persistence = new PostgresPersistence(LOCAL_DATABASE_URL, 2000);
    await expect(persistence.ping()).resolves.toBeUndefined();
  });
});

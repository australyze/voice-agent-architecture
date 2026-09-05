import { Client } from "pg";
import { DependencyError } from "../../domain/errors.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";

const DEFAULT_PING_TIMEOUT_MS = 2000;

export class PostgresPersistence implements PersistencePort {
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
}

import { describe, expect, it } from "vitest";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import { MemoryPersistence } from "../persistence/memory-persistence.js";
import { createServer } from "./create-server.js";

describe("evaluation HTTP", () => {
  it("should_leave_canonical_evaluation_routes_unimplemented", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: { log() {} } satisfies LoggerPort,
    });
    const created = await server.inject({
      method: "POST",
      url: "/evaluations/runs",
      payload: { suiteName: "evaluation-quality-gate", datasetVersion: "2026-09-05.5" },
    });
    const fetched = await server.inject({
      method: "GET",
      url: "/evaluations/runs/11111111-1111-4111-8111-111111111111",
    });
    expect(created.statusCode).toBe(404);
    expect(fetched.statusCode).toBe(404);
    await server.close();
  });
});

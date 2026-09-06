import { describe, expect, it } from "vitest";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import { MemoryPersistence } from "../persistence/memory-persistence.js";
import { createServer } from "./create-server.js";

describe("knowledge HTTP", () => {
  it("should_leave_canonical_knowledge_routes_unimplemented", async () => {
    const server = await createServer({
      persistence: new MemoryPersistence(),
      logger: { log() {} } satisfies LoggerPort,
    });

    const register = await server.inject({ method: "POST", url: "/knowledge/documents", payload: {} });
    const query = await server.inject({ method: "POST", url: "/knowledge/query", payload: {} });
    expect(register.statusCode).toBe(404);
    expect(query.statusCode).toBe(404);
    await server.close();
  });
});

import { describe, expect, it } from "vitest";
import { ConfigError } from "../domain/errors.js";
import { MemoryPersistence } from "../adapters/persistence/memory-persistence.js";
import { loadConfig } from "../application/load-config.js";
import { createRuntime, startRuntime } from "./app.js";

const BASE_ENV = {
  NODE_ENV: "test",
  PORT: "0",
  DATABASE_URL: "postgresql://voice_agent:voice_agent@127.0.0.1:5433/voice_agent",
};

describe("composition root", () => {
  it("should_not_listen_when_configuration_is_invalid", () => {
    expect(() => loadConfig({ NODE_ENV: "test" })).toThrow(ConfigError);
  });

  it("should_become_probeable_when_documented_env_is_present", async () => {
    const { server, config } = await startRuntime(BASE_ENV, { persistence: new MemoryPersistence() });
    expect(config.listenHost).toBe("127.0.0.1");
    const address = server.server.address();
    expect(address).not.toBeNull();
    if (typeof address === "object" && address !== null) {
      expect(address.address).toBe("127.0.0.1");
    }

    const live = await server.inject({ method: "GET", url: "/health/live" });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "alive" });

    await server.close();
  });

  it("should_start_without_llm_voice_or_observability_credentials", async () => {
    const config = loadConfig({
      ...BASE_ENV,
      PORT: "3000",
    });
    const server = await createRuntime(config, {
      persistence: new MemoryPersistence(),
    });

    const live = await server.inject({ method: "GET", url: "/health/live" });
    expect(live.statusCode).toBe(200);
    await server.close();
  });

  it("should_start_without_embedding_or_vector_credentials", async () => {
    const config = loadConfig({
      ...BASE_ENV,
      PORT: "3000",
    });
    const server = await createRuntime(config, {
      persistence: new MemoryPersistence(),
    });
    const live = await server.inject({ method: "GET", url: "/health/live" });
    expect(live.statusCode).toBe(200);
    const knowledge = await server.inject({ method: "POST", url: "/knowledge/query", payload: {} });
    expect(knowledge.statusCode).toBe(404);
    await server.close();
  });

  it("should_start_without_mcp_settings", async () => {
    const config = loadConfig({
      ...BASE_ENV,
      PORT: "3000",
    });
    expect(config).not.toHaveProperty("mcp");
    const server = await createRuntime(config, {
      persistence: new MemoryPersistence(),
    });
    const live = await server.inject({ method: "GET", url: "/health/live" });
    expect(live.statusCode).toBe(200);
    await server.close();
  });
});

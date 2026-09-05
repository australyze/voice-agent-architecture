import type { FastifyInstance } from "fastify";
import { createServer } from "../adapters/http/create-server.js";
import { JsonLogger } from "../adapters/logging/json-logger.js";
import { PostgresPersistence } from "../adapters/persistence/postgres-persistence.js";
import type { AppConfig } from "../application/load-config.js";
import { loadConfig } from "../application/load-config.js";
import type { LoggerPort } from "../domain/ports/logger-port.js";
import type { PersistencePort } from "../domain/ports/persistence-port.js";

export type RuntimeDependencies = {
  persistence?: PersistencePort;
  logger?: LoggerPort;
};

export function createRuntime(config: AppConfig, overrides: RuntimeDependencies = {}): Promise<FastifyInstance> {
  const logger = overrides.logger ?? new JsonLogger();
  const persistence = overrides.persistence ?? new PostgresPersistence(config.databaseUrl);
  return createServer({ persistence, logger });
}

export async function startRuntime(
  env: NodeJS.Dict<string>,
  overrides: RuntimeDependencies = {},
): Promise<{ config: AppConfig; server: FastifyInstance }> {
  const config = loadConfig(env);
  const server = await createRuntime(config, overrides);
  await server.listen({ host: config.listenHost, port: config.port });
  return { config, server };
}

import Fastify, { type FastifyInstance } from "fastify";
import { checkLiveness } from "../../application/check-liveness.js";
import { checkReadiness } from "../../application/check-readiness.js";
import { mapErrorToEnvelope } from "../../application/map-error.js";
import type { LoggerPort } from "../../domain/ports/logger-port.js";
import type { PersistencePort } from "../../domain/ports/persistence-port.js";

export type LivenessChecker = () => { status: "alive" };

export type HttpServerDependencies = {
  persistence: PersistencePort;
  logger: LoggerPort;
  checkLivenessFn?: LivenessChecker;
};

export async function createServer(dependencies: HttpServerDependencies): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });
  const liveness = dependencies.checkLivenessFn ?? checkLiveness;

  server.get("/health/live", async () => liveness());

  server.get("/health/ready", async () => {
    return checkReadiness(dependencies.persistence, dependencies.logger);
  });

  server.setErrorHandler((error, _request, reply) => {
    const mapped = mapErrorToEnvelope(error);
    dependencies.logger.log({
      operation: "http.error",
      outcome: "failure",
      errorCode: mapped.body.error.code,
    });
    void reply.status(mapped.statusCode).send(mapped.body);
  });

  return server;
}

import { z } from "zod";
import { ConfigError } from "../domain/errors.js";

const REQUIRED_FIELDS = ["NODE_ENV", "PORT", "DATABASE_URL"] as const;
const DEFAULT_LISTEN_HOST = "127.0.0.1";
const LISTEN_HOST_PATTERN = /^(?:(?:\d{1,3}\.){3}\d{1,3}|\[?[0-9a-fA-F:]+\]?|[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)$/;

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be an integer")
    .transform((value) => Number(value))
    .refine((port) => port >= 0 && port <= 65535, "PORT must be between 0 and 65535"),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
      } catch {
        return false;
      }
    }, "DATABASE_URL must be a postgres URL"),
  LISTEN_HOST: z.string().regex(LISTEN_HOST_PATTERN, "LISTEN_HOST must be a host or IP"),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  listenHost: string;
};

export function loadConfig(env: NodeJS.Dict<string>): AppConfig {
  for (const field of REQUIRED_FIELDS) {
    if (env[field] === undefined || env[field] === "") {
      throw new ConfigError(`Missing required configuration: ${field}`, "CONFIG_MISSING");
    }
  }

  const parsed = configSchema.safeParse({
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    DATABASE_URL: env.DATABASE_URL,
    LISTEN_HOST: env.LISTEN_HOST === undefined || env.LISTEN_HOST === "" ? DEFAULT_LISTEN_HOST : env.LISTEN_HOST,
  });

  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "config");
    throw new ConfigError(`Invalid configuration: ${field}`, "CONFIG_INVALID");
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    listenHost: parsed.data.LISTEN_HOST,
  };
}

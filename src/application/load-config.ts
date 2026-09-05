import { z } from "zod";
import { ConfigError } from "../domain/errors.js";

const REQUIRED_FIELDS = ["NODE_ENV", "PORT", "DATABASE_URL"] as const;
const DEFAULT_LISTEN_HOST = "127.0.0.1";
export const DEFAULT_VOICE_TIMEOUT_MS = 2000;
export const DEFAULT_VOICE_LOCALE = "es";
const LISTEN_HOST_PATTERN = /^(?:(?:\d{1,3}\.){3}\d{1,3}|\[?[0-9a-fA-F:]+\]?|[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)$/;
const LOCALE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;

const optionalTrimmed = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "" ? undefined : value));

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
  VOICE_INBOUND_SECRET: optionalTrimmed,
  VOICE_PROVIDER_API_KEY: optionalTrimmed,
  VOICE_PROVIDER_BASE_URL: optionalTrimmed.refine((value) => {
    if (value === undefined) {
      return true;
    }
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "VOICE_PROVIDER_BASE_URL must be an http URL"),
  VOICE_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === "" ? String(DEFAULT_VOICE_TIMEOUT_MS) : value))
    .refine((value) => /^\d+$/.test(value), "VOICE_TIMEOUT_MS must be an integer")
    .transform((value) => Number(value))
    .refine((ms) => ms >= 1 && ms <= 60_000, "VOICE_TIMEOUT_MS must be between 1 and 60000"),
  VOICE_DEFAULT_LOCALE: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === "" ? DEFAULT_VOICE_LOCALE : value))
    .refine((value) => LOCALE_PATTERN.test(value), "VOICE_DEFAULT_LOCALE must be a language tag"),
});

export type VoiceConfig = {
  inboundSecret?: string;
  providerApiKey?: string;
  providerBaseUrl?: string;
  timeoutMs: number;
  defaultLocale: string;
};

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  listenHost: string;
  voice: VoiceConfig;
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
    VOICE_INBOUND_SECRET: env.VOICE_INBOUND_SECRET,
    VOICE_PROVIDER_API_KEY: env.VOICE_PROVIDER_API_KEY,
    VOICE_PROVIDER_BASE_URL: env.VOICE_PROVIDER_BASE_URL,
    VOICE_TIMEOUT_MS: env.VOICE_TIMEOUT_MS,
    VOICE_DEFAULT_LOCALE: env.VOICE_DEFAULT_LOCALE,
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
    voice: {
      ...(parsed.data.VOICE_INBOUND_SECRET === undefined ? {} : { inboundSecret: parsed.data.VOICE_INBOUND_SECRET }),
      ...(parsed.data.VOICE_PROVIDER_API_KEY === undefined ? {} : { providerApiKey: parsed.data.VOICE_PROVIDER_API_KEY }),
      ...(parsed.data.VOICE_PROVIDER_BASE_URL === undefined
        ? {}
        : { providerBaseUrl: parsed.data.VOICE_PROVIDER_BASE_URL }),
      timeoutMs: parsed.data.VOICE_TIMEOUT_MS,
      defaultLocale: parsed.data.VOICE_DEFAULT_LOCALE,
    },
  };
}

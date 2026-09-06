import { describe, expect, it } from "vitest";
import { ConfigError } from "../domain/errors.js";
import { loadConfig } from "./load-config.js";

const VALID_ENV = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://voice_agent:voice_agent@127.0.0.1:5433/voice_agent",
};

describe("loadConfig", () => {
  it("should_load_config_when_required_values_are_valid", () => {
    const config = loadConfig(VALID_ENV);

    expect(config).toEqual({
      nodeEnv: "test",
      port: 3000,
      databaseUrl: VALID_ENV.DATABASE_URL,
      listenHost: "127.0.0.1",
      voice: {
        timeoutMs: 2000,
        defaultLocale: "es",
        inboundMaxSkewMs: 60_000,
        inboundRateLimit: 30,
        inboundRateWindowMs: 60_000,
      },
      llm: {
        mode: "fake",
        timeoutMs: 1500,
        modelId: "fake",
      },
    });
  });

  it("should_default_listen_host_to_loopback_when_omitted", () => {
    const config = loadConfig(VALID_ENV);
    expect(config.listenHost).toBe("127.0.0.1");
  });

  it("should_fail_closed_when_listen_host_is_invalid", () => {
    try {
      loadConfig({ ...VALID_ENV, LISTEN_HOST: "not a host / http://evil" });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).toContain("LISTEN_HOST");
      expect(configError.message).not.toContain("http://evil");
    }
  });

  it("should_fail_closed_when_required_value_is_missing", () => {
    expect(() => loadConfig({ ...VALID_ENV, DATABASE_URL: undefined })).toThrow(ConfigError);

    try {
      loadConfig({ ...VALID_ENV, DATABASE_URL: undefined });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_MISSING");
      expect(configError.message).toContain("DATABASE_URL");
      expect(configError.message).not.toMatch(/postgresql:/i);
      expect(configError.message).not.toContain("voice_agent");
    }
  });

  it("should_fail_closed_when_required_value_is_invalid", () => {
    const secretUrl = "postgresql://user:supersecret@localhost:5432/voice_agent";

    try {
      loadConfig({ ...VALID_ENV, PORT: "not-a-port" });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).toContain("PORT");
      expect(configError.message).not.toContain("not-a-port");
    }

    try {
      loadConfig({ ...VALID_ENV, DATABASE_URL: secretUrl.replace("postgresql", "http") });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).not.toContain("supersecret");
      expect(configError.message).not.toContain("http://user:supersecret");
    }
  });

  it("should_not_require_llm_voice_or_observability_credentials", () => {
    const config = loadConfig({
      ...VALID_ENV,
      LLM_API_KEY: undefined,
      VOICE_PROVIDER_API_KEY: undefined,
      OBSERVABILITY_SECRET_KEY: undefined,
    });

    expect(config.port).toBe(3000);
    expect(config.voice.inboundSecret).toBeUndefined();
    expect(config.voice.providerApiKey).toBeUndefined();
  });

  it("should_load_when_voice_settings_are_omitted", () => {
    const config = loadConfig(VALID_ENV);
    expect(config.voice).toEqual({
      timeoutMs: 2000,
      defaultLocale: "es",
      inboundMaxSkewMs: 60_000,
      inboundRateLimit: 30,
      inboundRateWindowMs: 60_000,
    });
    expect(config.llm).toEqual({
      mode: "fake",
      timeoutMs: 1500,
      modelId: "fake",
    });
  });

  it("should_load_valid_optional_voice_settings", () => {
    const config = loadConfig({
      ...VALID_ENV,
      VOICE_INBOUND_SECRET: "shared-secret",
      VOICE_PROVIDER_API_KEY: "placeholder-key",
      VOICE_PROVIDER_BASE_URL: "https://api.example.test",
      VOICE_TIMEOUT_MS: "1500",
      VOICE_DEFAULT_LOCALE: "es",
    });

    expect(config.voice).toEqual({
      inboundSecret: "shared-secret",
      providerApiKey: "placeholder-key",
      providerBaseUrl: "https://api.example.test",
      timeoutMs: 1500,
      defaultLocale: "es",
      inboundMaxSkewMs: 60_000,
      inboundRateLimit: 30,
      inboundRateWindowMs: 60_000,
    });
  });

  it("should_load_dedicated_demo_orchestrate_secret", () => {
    const config = loadConfig({
      ...VALID_ENV,
      DEMO_ORCHESTRATE_SECRET: "demo-only-secret",
    });
    expect(config.voice.demoOrchestrateSecret).toBe("demo-only-secret");
    expect(config.voice.inboundSecret).toBeUndefined();
  });

  it("should_fail_closed_when_present_voice_settings_are_invalid_without_echoing_secrets", () => {
    try {
      loadConfig({ ...VALID_ENV, VOICE_TIMEOUT_MS: "not-a-timeout" });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).toContain("VOICE_TIMEOUT_MS");
      expect(configError.message).not.toContain("not-a-timeout");
    }

    try {
      loadConfig({ ...VALID_ENV, VOICE_PROVIDER_BASE_URL: "ftp://secret.example/path" });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).toContain("VOICE_PROVIDER_BASE_URL");
      expect(configError.message).not.toContain("secret.example");
    }

    try {
      loadConfig({
        ...VALID_ENV,
        VOICE_INBOUND_SECRET: "supersecret-inbound",
        VOICE_PROVIDER_API_KEY: "sk-supersecretvoicekey",
        VOICE_DEFAULT_LOCALE: "spanish",
      });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).toContain("VOICE_DEFAULT_LOCALE");
      expect(configError.message).not.toContain("supersecret-inbound");
      expect(configError.message).not.toContain("sk-supersecretvoicekey");
    }
  });

  it("should_use_fake_llm_when_llm_settings_are_omitted", () => {
    const config = loadConfig(VALID_ENV);
    expect(config.llm.mode).toBe("fake");
  });

  it("should_fail_closed_when_present_llm_settings_are_invalid_without_echoing_secrets", () => {
    try {
      loadConfig({ ...VALID_ENV, LLM_BASE_URL: "ftp://secret-llm.example" });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).toContain("LLM_BASE_URL");
      expect(configError.message).not.toContain("secret-llm.example");
    }

    try {
      loadConfig({
        ...VALID_ENV,
        LLM_BASE_URL: "https://llm.example",
        LLM_API_KEY: "sk-supersecretllm",
        LLM_TIMEOUT_MS: "not-ms",
      });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.code).toBe("CONFIG_INVALID");
      expect(configError.message).toContain("LLM_TIMEOUT_MS");
      expect(configError.message).not.toContain("sk-supersecretllm");
    }

    try {
      loadConfig({ ...VALID_ENV, LLM_API_KEY: "sk-only-key" });
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.message).not.toContain("sk-only-key");
    }
  });

  it("should_load_http_llm_when_url_and_key_are_valid", () => {
    const config = loadConfig({
      ...VALID_ENV,
      LLM_BASE_URL: "https://llm.example",
      LLM_API_KEY: "placeholder-llm-key",
      LLM_MODEL_ID: "demo-model",
    });
    expect(config.llm).toEqual({
      mode: "http",
      baseUrl: "https://llm.example",
      apiKey: "placeholder-llm-key",
      timeoutMs: 1500,
      modelId: "demo-model",
    });
  });
});

import { describe, expect, it } from "vitest";
import { checkVoiceIntegration } from "./check-voice-integration.js";

describe("checkVoiceIntegration", () => {
  it("should_report_not_configured_when_inbound_secret_is_absent", () => {
    expect(checkVoiceIntegration({ timeoutMs: 2000, defaultLocale: "es" })).toEqual({
      status: "not_configured",
    });
  });

  it("should_report_configured_when_secret_is_present_and_valid", () => {
    expect(
      checkVoiceIntegration({
        inboundSecret: "shared-secret",
        providerBaseUrl: "https://api.example.test",
        timeoutMs: 2000,
        defaultLocale: "es",
      }),
    ).toEqual({ status: "configured" });
  });

  it("should_report_error_without_secrets_when_provider_url_is_invalid", () => {
    const result = checkVoiceIntegration({
      inboundSecret: "supersecret-inbound",
      providerBaseUrl: "not-a-url",
      timeoutMs: 2000,
      defaultLocale: "es",
    });
    expect(result).toEqual({ status: "error", code: "VOICE_CONFIG" });
    expect(JSON.stringify(result)).not.toContain("supersecret-inbound");
  });
});

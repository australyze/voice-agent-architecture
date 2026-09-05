import type { VoiceConfig } from "./load-config.js";

export type VoiceIntegrationStatus = "configured" | "not_configured" | "error";

export type VoiceIntegrationResult = {
  status: VoiceIntegrationStatus;
  code?: string;
};

export function isVoiceConfigured(voice: VoiceConfig): boolean {
  return voice.inboundSecret !== undefined && voice.inboundSecret.length > 0;
}

export function checkVoiceIntegration(voice: VoiceConfig): VoiceIntegrationResult {
  if (!isVoiceConfigured(voice)) {
    return { status: "not_configured" };
  }

  if (voice.providerBaseUrl !== undefined) {
    try {
      const parsed = new URL(voice.providerBaseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { status: "error", code: "VOICE_CONFIG" };
      }
    } catch {
      return { status: "error", code: "VOICE_CONFIG" };
    }
  }

  return { status: "configured" };
}

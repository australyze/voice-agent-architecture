import type Vapi from "@vapi-ai/web";
import { normalizeSafeError, normalizeToolActivity, normalizeTranscriptMessage } from "./normalize";
import type { VoiceMediaClient, VoiceMediaEvent } from "./types";

export type VapiSdkLike = Pick<Vapi, "start" | "stop" | "on" | "removeListener">;

export type VapiClientConfig = {
  publicKey: string;
  assistantId: string;
  createSdk?: (publicKey: string) => VapiSdkLike;
};

export function createVapiMediaClient(config: VapiClientConfig): VoiceMediaClient {
  const listeners = new Set<(event: VoiceMediaEvent) => void>();
  let sdk: VapiSdkLike | null = null;

  const emit = (event: VoiceMediaEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const attach = (instance: VapiSdkLike) => {
    instance.on("call-start", () => emit({ type: "call-start" }));
    instance.on("call-end", () => emit({ type: "call-end" }));
    instance.on("message", (message: unknown) => {
      const transcript = normalizeTranscriptMessage(message);
      if (transcript) {
        emit({ type: "transcript", message: transcript });
      }
      const toolLabel = normalizeToolActivity(message);
      if (toolLabel) {
        emit({ type: "tool-activity", label: toolLabel });
      }
    });
    instance.on("error", (error: unknown) => {
      emit({ type: "error", message: normalizeSafeError(error) });
    });
  };

  return {
    async start() {
      if (!sdk) {
        if (config.createSdk) {
          sdk = config.createSdk(config.publicKey);
        } else {
          const { default: VapiCtor } = await import("@vapi-ai/web");
          sdk = new VapiCtor(config.publicKey);
        }
        attach(sdk);
      }
      await sdk.start(config.assistantId);
    },
    async stop() {
      await sdk?.stop();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

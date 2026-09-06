import { SAFE_CALL_ERROR, type VoiceMediaClient, type VoiceMediaEvent } from "./types";

export function createUnconfiguredClient(): VoiceMediaClient {
  const listeners = new Set<(event: VoiceMediaEvent) => void>();
  return {
    async start() {
      for (const listener of listeners) {
        listener({ type: "error", message: SAFE_CALL_ERROR });
      }
    },
    async stop() {},
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

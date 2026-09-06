import type { VoiceMediaClient, VoiceMediaEvent } from "@/lib/voice/types";

export function createFakeMediaClient() {
  const listeners = new Set<(event: VoiceMediaEvent) => void>();
  const calls = { start: 0, stop: 0 };

  const client: VoiceMediaClient = {
    async start() {
      calls.start += 1;
    },
    async stop() {
      calls.stop += 1;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    client,
    calls,
    emit(event: VoiceMediaEvent) {
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

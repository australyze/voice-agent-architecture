import { describe, expect, it, vi } from "vitest";
import { createVapiMediaClient, type VapiSdkLike } from "./create-vapi-client";
import { SAFE_CALL_ERROR } from "./types";

function createSdkStub() {
  const handlers = new Map<string, Array<(payload?: unknown) => void>>();
  const start = vi.fn(async () => undefined);
  const stop = vi.fn(async () => undefined);
  const sdk: VapiSdkLike = {
    start: start as unknown as VapiSdkLike["start"],
    stop,
    on(event, listener) {
      const list = handlers.get(event) ?? [];
      list.push(listener as (payload?: unknown) => void);
      handlers.set(event, list);
      return sdk as never;
    },
    removeListener() {
      return sdk as never;
    },
  };
  return {
    sdk,
    start,
    stop,
    emit(event: string, payload?: unknown) {
      for (const listener of handlers.get(event) ?? []) {
        listener(payload);
      }
    },
  };
}

describe("createVapiMediaClient", () => {
  it("should_start_and_stop_the_sdk_and_map_events", async () => {
    const stub = createSdkStub();
    const client = createVapiMediaClient({
      publicKey: "public-demo",
      assistantId: "asst-demo",
      createSdk: () => stub.sdk,
    });
    const events: string[] = [];
    client.subscribe((event) => events.push(event.type));

    await client.start();
    expect(stub.start).toHaveBeenCalledWith("asst-demo");
    stub.emit("call-start");
    stub.emit("message", { type: "transcript", role: "user", transcript: "hola", transcriptType: "final" });
    stub.emit("message", { type: "function-call", functionCall: { name: "wom.get_customer_usage" } });
    stub.emit("error", { message: "sk-leaked", stack: "boom" });
    await client.stop();
    expect(stub.stop).toHaveBeenCalled();
    stub.emit("call-end");

    expect(events).toContain("call-start");
    expect(events).toContain("transcript");
    expect(events).toContain("tool-activity");
    expect(events).toContain("error");
    expect(events).toContain("call-end");
  });

  it("should_normalize_errors_without_secrets", async () => {
    const stub = createSdkStub();
    const client = createVapiMediaClient({
      publicKey: "public-demo",
      assistantId: "asst-demo",
      createSdk: () => stub.sdk,
    });
    let message = "";
    client.subscribe((event) => {
      if (event.type === "error") {
        message = event.message;
      }
    });
    await client.start();
    stub.emit("error", { apiKey: "sk-leaked", stack: "x" });
    expect(message).toBe(SAFE_CALL_ERROR);
    expect(message).not.toContain("sk-leaked");
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeMediaClient } from "@/test/fake-media-client";
import { CONNECTING_TIMEOUT_MS, SAFE_CALL_ERROR } from "./types";
import { useVoiceAgent } from "./use-voice-agent";

describe("useVoiceAgent", () => {
  it("should_start_and_end_through_the_media_client", async () => {
    const fake = createFakeMediaClient();
    const { result } = renderHook(() => useVoiceAgent(fake.client));

    await act(async () => {
      await result.current.startCall();
    });
    expect(fake.calls.start).toBe(1);
    expect(result.current.callState).toBe("connecting");

    act(() => {
      fake.emit({ type: "call-start" });
    });
    expect(result.current.callState).toBe("active");

    await act(async () => {
      await result.current.endCall();
    });
    expect(fake.calls.stop).toBe(1);
    expect(result.current.callState).toBe("ending");

    act(() => {
      fake.emit({ type: "call-end" });
    });
    expect(result.current.callState).toBe("completed");
  });

  it("should_normalize_transcript_and_redact_errors", async () => {
    const fake = createFakeMediaClient();
    const { result } = renderHook(() => useVoiceAgent(fake.client));

    act(() => {
      fake.emit({
        type: "transcript",
        message: { id: "1", role: "assistant", text: "Te quedan 18,4 GB" },
      });
      fake.emit({ type: "error", message: SAFE_CALL_ERROR });
    });

    expect(result.current.transcript[0]?.text).toBe("Te quedan 18,4 GB");
    expect(result.current.callState).toBe("error");
    expect(result.current.error).toBe(SAFE_CALL_ERROR);
    expect(result.current.error).not.toMatch(/sk-/);
  });

  it("should_timeout_connecting_after_8s_and_allow_retry", async () => {
    vi.useFakeTimers();
    const fake = createFakeMediaClient();
    const { result } = renderHook(() => useVoiceAgent(fake.client));

    await act(async () => {
      await result.current.startCall();
    });
    expect(result.current.callState).toBe("connecting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONNECTING_TIMEOUT_MS);
    });
    expect(result.current.callState).toBe("error");
    expect(result.current.error).toBe(SAFE_CALL_ERROR);
    expect(fake.calls.stop).toBe(1);

    act(() => {
      fake.emit({ type: "call-start" });
    });
    expect(result.current.callState).toBe("error");
  });

  it("should_keep_at_most_50_transcript_messages", () => {
    const fake = createFakeMediaClient();
    const { result } = renderHook(() => useVoiceAgent(fake.client));

    act(() => {
      for (let index = 0; index < 55; index += 1) {
        fake.emit({
          type: "transcript",
          message: { id: `m-${index}`, role: "user", text: `msg-${index}` },
        });
      }
    });

    expect(result.current.transcript).toHaveLength(50);
    expect(result.current.transcript[0]?.id).toBe("m-5");
    expect(result.current.transcript[49]?.id).toBe("m-54");
  });
});

afterEach(() => {
  vi.useRealTimers();
});

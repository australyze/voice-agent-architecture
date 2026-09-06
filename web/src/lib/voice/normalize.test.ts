import { describe, expect, it } from "vitest";
import { normalizeSafeError, normalizeToolActivity, normalizeTranscriptMessage } from "./normalize";
import { SAFE_CALL_ERROR } from "./types";

describe("voice event normalization", () => {
  it("should_normalize_final_transcripts_only", () => {
    expect(
      normalizeTranscriptMessage({
        type: "transcript",
        role: "user",
        transcript: "hola",
        transcriptType: "final",
      }),
    ).toMatchObject({ role: "user", text: "hola" });
    expect(
      normalizeTranscriptMessage({
        type: "transcript",
        role: "user",
        transcript: "hol",
        transcriptType: "partial",
      }),
    ).toBeNull();
  });

  it("should_map_usage_tool_and_ignore_unknown_messages", () => {
    expect(normalizeToolActivity({ type: "function-call", functionCall: { name: "get_customer_usage" } })).toBe(
      "Consultando consumo",
    );
    expect(normalizeToolActivity({ type: "tool-calls", name: "get_customer_usage" })).toBe("Consultando consumo");
    expect(normalizeToolActivity({ type: "tool", name: "get_customer_usage" })).toBeNull();
    expect(normalizeToolActivity({ type: "function", name: "get_customer_usage" })).toBeNull();
    expect(normalizeToolActivity({ type: "transcript", role: "user", transcript: "hola" })).toBeNull();
    expect(normalizeToolActivity({ type: "status", status: "ok" })).toBeNull();
  });

  it("should_truncate_transcript_text_to_2048_characters", () => {
    const text = "a".repeat(2100);
    const message = normalizeTranscriptMessage({
      type: "transcript",
      role: "user",
      transcript: text,
      transcriptType: "final",
    });
    expect(message?.text).toHaveLength(2048);
  });

  it("should_never_return_secret_material_in_errors", () => {
    expect(normalizeSafeError({ stack: "Error", apiKey: "sk-abc", message: "fail" })).toBe(SAFE_CALL_ERROR);
  });
});

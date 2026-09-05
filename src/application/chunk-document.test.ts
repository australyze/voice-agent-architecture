import { describe, expect, it } from "vitest";
import { CHUNK_OVERLAP, CHUNK_SIZE, CHUNKER_VERSION, PARSER_VERSION } from "../domain/knowledge.js";
import { chunkPlainText, parsePlainText } from "./chunk-document.js";

describe("chunkPlainText", () => {
  it("should_parse_plain_v1_and_emit_char_locators", () => {
    const parsed = parsePlainText("hello world");
    expect(parsed.parserVersion).toBe(PARSER_VERSION);
    const chunks = chunkPlainText(parsed.text, CHUNK_SIZE, CHUNK_OVERLAP);
    expect(chunks[0]?.locator).toBe("chars:0-11");
    expect(chunks[0]?.chunkerVersion).toBe(CHUNKER_VERSION);
    expect(chunks[0]?.text).toContain("hello");
  });

  it("should_split_long_text_with_overlap_and_reject_empty", () => {
    const text = "a".repeat(600);
    const chunks = chunkPlainText(text, 512, 64);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.locator).toBe("chars:0-512");
    expect(chunks[1]?.locator).toBe("chars:448-600");
    expect(() => chunkPlainText("   ")).toThrow(/empty/i);
  });
});

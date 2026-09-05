import { describe, expect, it } from "vitest";
import { hashPromptContent, loadRuntimeDemoPrompt } from "./load-prompt.js";

describe("runtime-demo prompt version", () => {
  it("should_load_prompt_id_version_and_matching_content_hash", () => {
    const prompt = loadRuntimeDemoPrompt();
    expect(prompt.promptId).toBe("runtime-demo");
    expect(prompt.version).toBe("1");
    expect(prompt.content).toContain("runtime-demo");
    expect(prompt.hash).toBe(hashPromptContent(prompt.content));
  });

  it("should_fail_when_expected_hash_does_not_match_file_bytes", () => {
    const prompt = loadRuntimeDemoPrompt();
    expect(prompt.hash).not.toBe(hashPromptContent(`${prompt.content}\nchanged`));
  });
});

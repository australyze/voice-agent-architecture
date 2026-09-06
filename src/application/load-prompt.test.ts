import { describe, expect, it } from "vitest";
import { hashPromptContent, loadDemoClassifyPrompt, loadDemoNormalizePrompt, loadRuntimeDemoPrompt } from "./load-prompt.js";

describe("runtime-demo prompt version", () => {
  it("should_load_prompt_id_version_and_matching_content_hash", () => {
    const prompt = loadRuntimeDemoPrompt();
    expect(prompt.promptId).toBe("runtime-demo");
    expect(prompt.version).toBe("2");
    expect(prompt.content).toContain("runtime-demo");
    expect(prompt.content).toContain("UNTRUSTED_RETRIEVED_CONTEXT");
    expect(prompt.path).toContain("v2.md");
    expect(prompt.hash).toBe(hashPromptContent(prompt.content));
  });

  it("should_fail_when_expected_hash_does_not_match_file_bytes", () => {
    const prompt = loadRuntimeDemoPrompt();
    expect(prompt.hash).not.toBe(hashPromptContent(`${prompt.content}\nchanged`));
  });
});

describe("specialist prompt versions", () => {
  it("should_load_normalize_and_classify_v1_with_content_hash", () => {
    const normalize = loadDemoNormalizePrompt();
    const classify = loadDemoClassifyPrompt();
    expect(normalize.promptId).toBe("demo-normalize");
    expect(classify.promptId).toBe("demo-classify");
    expect(normalize.version).toBe("1");
    expect(classify.version).toBe("1");
    expect(normalize.path).toContain("v1.md");
    expect(classify.path).toContain("v1.md");
    expect(normalize.hash).toBe(hashPromptContent(normalize.content));
    expect(classify.hash).toBe(hashPromptContent(classify.content));
    expect(normalize.content).toContain("untrusted");
    expect(classify.content).toContain("untrusted");
  });
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const RUNTIME_DEMO_PROMPT_ID = "runtime-demo";
export const RUNTIME_DEMO_PROMPT_VERSION = "2";
export const RUNTIME_DEMO_PROMPT_PATH = "prompts/runtime-demo/v2.md";

export type PromptVersion = {
  promptId: string;
  version: string;
  content: string;
  hash: string;
  path: string;
};

export function hashPromptContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export const DEMO_NORMALIZE_PROMPT_ID = "demo-normalize";
export const DEMO_NORMALIZE_PROMPT_VERSION = "1";
export const DEMO_NORMALIZE_PROMPT_PATH = "prompts/demo-normalize/v1.md";

export const DEMO_CLASSIFY_PROMPT_ID = "demo-classify";
export const DEMO_CLASSIFY_PROMPT_VERSION = "1";
export const DEMO_CLASSIFY_PROMPT_PATH = "prompts/demo-classify/v1.md";

export function loadRuntimeDemoPrompt(root = process.cwd()): PromptVersion {
  return loadPromptFile(root, RUNTIME_DEMO_PROMPT_PATH, RUNTIME_DEMO_PROMPT_ID, RUNTIME_DEMO_PROMPT_VERSION);
}

export function loadDemoNormalizePrompt(root = process.cwd()): PromptVersion {
  return loadPromptFile(root, DEMO_NORMALIZE_PROMPT_PATH, DEMO_NORMALIZE_PROMPT_ID, DEMO_NORMALIZE_PROMPT_VERSION);
}

export function loadDemoClassifyPrompt(root = process.cwd()): PromptVersion {
  return loadPromptFile(root, DEMO_CLASSIFY_PROMPT_PATH, DEMO_CLASSIFY_PROMPT_ID, DEMO_CLASSIFY_PROMPT_VERSION);
}

function loadPromptFile(root: string, relativePath: string, promptId: string, version: string): PromptVersion {
  const path = resolve(root, relativePath);
  const content = readFileSync(path, "utf8");
  return {
    promptId,
    version,
    content,
    hash: hashPromptContent(content),
    path,
  };
}

export function assertPromptHash(prompt: PromptVersion, expectedHash: string): void {
  if (prompt.hash !== expectedHash) {
    throw new Error("Prompt content hash does not match the versioned artifact");
  }
}

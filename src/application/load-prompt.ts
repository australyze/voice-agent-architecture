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

export function loadRuntimeDemoPrompt(root = process.cwd()): PromptVersion {
  const path = resolve(root, RUNTIME_DEMO_PROMPT_PATH);
  const content = readFileSync(path, "utf8");
  return {
    promptId: RUNTIME_DEMO_PROMPT_ID,
    version: RUNTIME_DEMO_PROMPT_VERSION,
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

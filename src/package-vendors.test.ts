import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FORBIDDEN_DEPENDENCIES = [
  "vapi",
  "@vapi-ai",
  "@langchain",
  "langchain",
  "@langchain/langgraph",
  "langgraph",
  "langfuse",
  "openai",
  "@anthropic-ai/sdk",
];

describe("dependency allowlist", () => {
  it("should_not_include_ai_provider_sdks_in_package_manifests", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const lockfile = readFileSync("package-lock.json", "utf8");
    const declared = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const name of FORBIDDEN_DEPENDENCIES) {
      expect(declared[name], `${name} must not be a direct dependency`).toBeUndefined();
      expect(lockfile.includes(`"${name}"`), `${name} must not appear in package-lock.json`).toBe(false);
    }
  });
});

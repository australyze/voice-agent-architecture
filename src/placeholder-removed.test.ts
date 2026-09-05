import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL("./", import.meta.url));

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (fullPath.endsWith(".ts") && !fullPath.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("placeholder success path removed", () => {
  it("should_not_reference_placeholderReplyForLocale_in_product_source", () => {
    const matches = walk(SRC_ROOT).filter((file) => readFileSync(file, "utf8").includes("placeholderReplyForLocale"));
    expect(matches).toEqual([]);
  });
});

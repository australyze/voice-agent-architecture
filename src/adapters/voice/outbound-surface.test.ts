import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ADAPTER_ROOT = fileURLToPath(new URL("./", import.meta.url));

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return walk(fullPath);
    }
    return fullPath.endsWith(".ts") && !fullPath.endsWith(".test.ts") ? [fullPath] : [];
  });
}

describe("voice adapter surface", () => {
  it("should_not_expose_outbound_call_or_number_provisioning", () => {
    const sources = walk(ADAPTER_ROOT).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/placeOutboundCall|createPhoneNumber|provisionNumber|startCampaign/);
  });
});

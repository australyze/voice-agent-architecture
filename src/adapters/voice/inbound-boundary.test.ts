import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("voice inbound adapter boundary", () => {
  it("should_not_import_llm_port", () => {
    const source = readFileSync(fileURLToPath(new URL("./inbound.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/llm-port/);
    expect(source).not.toMatch(/LlmPort/);
    expect(source).not.toMatch(/handleAgentTurn/);
  });
});

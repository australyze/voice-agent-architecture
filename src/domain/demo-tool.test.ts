import { describe, expect, it } from "vitest";
import { DEMO_ECHO_TOKEN, DEMO_NORMALIZE_TEXT, RUNTIME_DEMO_ALLOWLIST } from "./demo-tool.js";

describe("runtime-demo tool policy", () => {
  it("should_allowlist_only_the_product_example_tool", () => {
    expect([...RUNTIME_DEMO_ALLOWLIST]).toEqual([DEMO_NORMALIZE_TEXT]);
    expect(RUNTIME_DEMO_ALLOWLIST).not.toContain(DEMO_ECHO_TOKEN);
  });
});

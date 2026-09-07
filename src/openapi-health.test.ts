import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("health OpenAPI fragment", () => {
  it("should_document_live_and_ready_with_canonical_error_envelope", () => {
    const spec = readFileSync("openapi/health.yaml", "utf8");

    expect(spec).toContain("/health/live");
    expect(spec).toContain("/health/ready");
    expect(spec).toContain("/health/voice");
    expect(spec).toContain("/adapters/voice/inbound");
    expect(spec).toContain("/demo/orchestrate");
    expect(spec).toContain("unroutable");
    expect(spec).toContain("x-voice-inbound-secret");
    expect(spec).toContain("x-demo-orchestrate-secret");
    expect(spec).toContain("x-demo-public-token");
    expect(spec).toContain("recompute");
    expect(spec).toContain("goal_achieved");
    expect(spec).toContain("evaluation:");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("health OpenAPI fragment", () => {
  it("should_document_live_and_ready_with_canonical_error_envelope", () => {
    const spec = readFileSync("openapi/health.yaml", "utf8");

    expect(spec).toContain("/health/live");
    expect(spec).toContain("/health/ready");
    expect(spec).toContain("/health/voice");
    expect(spec).toContain("/adapters/voice/inbound");
    expect(spec).toContain("x-voice-inbound-secret");
    expect(spec).toContain("success:");
    expect(spec).toContain("enum: [false]");
    expect(spec).toContain("message:");
    expect(spec).toContain("code:");
    expect(spec).not.toContain("/sessions");
  });
});

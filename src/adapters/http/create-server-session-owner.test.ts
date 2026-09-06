import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("createServer session owner composition", () => {
  it("should_select_handleAgentTurn_bundles_and_never_orchestrate_inbound", () => {
    const source = readFileSync(fileURLToPath(new URL("./create-server.ts", import.meta.url)), "utf8");
    expect(source).toContain("loadWomCustomerServicePrompt");
    expect(source).toContain("WOM_CUSTOMER_SERVICE_ALLOWLIST");
    expect(source).toContain("allowedTools");
    expect(source).toContain("createSessionOwnerToolPort(allowedTools)");
    expect(source).toContain("handleAgentTurn");
    const inboundBlock = source.slice(source.indexOf("server.post(\"/adapters/voice/inbound\""), source.indexOf("server.post(\"/demo/orchestrate\""));
    expect(inboundBlock).toContain("handleVoiceTurn");
    expect(inboundBlock).toContain("handleAgentTurn");
    expect(inboundBlock).not.toContain("handleOrchestratedTurn");
    expect(inboundBlock).not.toContain("allowedTools: RUNTIME_DEMO_ALLOWLIST");
  });
});

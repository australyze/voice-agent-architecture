import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MemoryPersistence } from "../../src/adapters/persistence/memory-persistence.js";
import { createSessionOwnerToolPort } from "../../src/adapters/tools/native-tool-port.js";
import { executeChannelToolInvocation } from "../../src/application/execute-channel-tool-invocation.js";
import { CHANNEL_TOOL_INVOCATION_SOURCE } from "../../src/application/load-config.js";
import { WOM_CUSTOMER_SERVICE_ALLOWLIST } from "../../src/domain/wom-tools.js";

const root = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(root, "cases.json"), "utf8")) as {
  version: string;
  cases: Array<{
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
    expect: { ok: boolean; code?: string; invocationSource?: string };
  }>;
};

const silentLogger = { log: () => undefined };

describe("vapi channel tools eval fixtures", () => {
  it("should_load_fixture_version", () => {
    expect(fixtures.version).toBe("1");
    expect(fixtures.cases.length).toBeGreaterThanOrEqual(5);
  });

  for (const testCase of fixtures.cases) {
    it(`should_satisfy_${testCase.id}`, async () => {
      const persistence = new MemoryPersistence();
      const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
      const result = await executeChannelToolInvocation(
        {
          calls: [{ toolCallId: testCase.id, toolName: testCase.toolName, arguments: testCase.arguments }],
          externalChannelId: `eval-${testCase.id}`,
        },
        { tools, logger: silentLogger, persistence },
      );
      const outcome = result.outcomes[0];
      expect(outcome?.ok).toBe(testCase.expect.ok);
      if (testCase.expect.code !== undefined) {
        expect(outcome?.code).toBe(testCase.expect.code);
      }
      if (testCase.expect.ok && testCase.expect.invocationSource !== undefined) {
        const listed = await persistence.listSessions({ externalChannelId: `eval-${testCase.id}`, limit: 1 });
        const report = await persistence.getSessionReport(listed[0]!.sessionId);
        expect(report?.toolCalls[0]?.invocationSource).toBe(CHANNEL_TOOL_INVOCATION_SOURCE);
      }
    });
  }

  it("should_not_accept_runAgent_on_channel_path", async () => {
    const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
    await expect(
      executeChannelToolInvocation(
        { calls: [{ toolCallId: "x", toolName: "wom.get_bill_status", arguments: {} }] },
        { tools, logger: silentLogger, runAgent: () => undefined },
      ),
    ).rejects.toThrow(/must not receive runAgent/);
  });
});

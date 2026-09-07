import { describe, expect, it, vi } from "vitest";
import { AGENT_ERROR_CODES } from "../domain/agent.js";
import type { ToolPort } from "../domain/ports/tool-port.js";
import { MemoryPersistence } from "../adapters/persistence/memory-persistence.js";
import { MemoryObservability } from "../adapters/observability/memory-observability.js";
import { PersistingObservability } from "../adapters/observability/persisting-observability.js";
import { createSessionOwnerToolPort } from "../adapters/tools/native-tool-port.js";
import {
  WOM_CUSTOMER_SERVICE_ALLOWLIST,
  WOM_GET_CUSTOMER_USAGE,
} from "../domain/wom-tools.js";
import { CHANNEL_TOOL_INVOCATION_SOURCE } from "./load-config.js";
import { executeChannelToolInvocation } from "./execute-channel-tool-invocation.js";

const silentLogger = { log: () => undefined };

describe("executeChannelToolInvocation", () => {
  it("should_execute_allowlisted_wom_tool_without_runAgent", async () => {
    const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
    const persistence = new MemoryPersistence();
    const observability = new MemoryObservability();

    const result = await executeChannelToolInvocation(
      {
        calls: [{ toolCallId: "tc-1", toolName: WOM_GET_CUSTOMER_USAGE, arguments: {} }],
        externalChannelId: "vapi-call-tools-1",
      },
      { tools, logger: silentLogger, persistence, observability },
    );

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.ok).toBe(true);
    expect(result.outcomes[0]?.result).toMatchObject({ dataRemainingGb: 18.4 });

    const listed = await persistence.listSessions({ externalChannelId: "vapi-call-tools-1", limit: 5 });
    expect(listed).toHaveLength(1);
    const report = await persistence.getSessionReport(listed[0]!.sessionId);
    expect(report?.toolCalls[0]?.invocationSource).toBe(CHANNEL_TOOL_INVOCATION_SOURCE);
    expect(observability.spans.some((span) => span.kind === "tool" && span.source === CHANNEL_TOOL_INVOCATION_SOURCE)).toBe(
      true,
    );
  });

  it("should_deny_demo_normalize_on_channel_path", async () => {
    const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
    const result = await executeChannelToolInvocation(
      {
        calls: [{ toolCallId: "tc-deny", toolName: "demo.normalize_text", arguments: { text: "x" } }],
      },
      { tools, logger: silentLogger },
    );
    expect(result.outcomes[0]?.ok).toBe(false);
    expect(result.outcomes[0]?.code).toBe(AGENT_ERROR_CODES.TOOL_DENIED);
  });

  it("should_return_invalid_args_for_extra_properties", async () => {
    const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
    const result = await executeChannelToolInvocation(
      {
        calls: [
          {
            toolCallId: "tc-args",
            toolName: "wom.check_service_status",
            arguments: { phoneNumber: "56900000000" },
          },
        ],
      },
      { tools, logger: silentLogger },
    );
    expect(result.outcomes[0]?.ok).toBe(false);
    expect(result.outcomes[0]?.code).toBe(AGENT_ERROR_CODES.TOOL_INVALID_ARGS);
  });

  it("should_not_persist_attacker_fields_on_deny_or_invalid_args", async () => {
    const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
    const persistence = new MemoryPersistence();
    const observability = new PersistingObservability(new MemoryObservability(), persistence, silentLogger);

    await executeChannelToolInvocation(
      {
        calls: [
          {
            toolCallId: "tc-deny-leak",
            toolName: "demo.normalize_text",
            arguments: { text: "secret-payload", exfiltrate: "attacker-value" },
          },
        ],
        externalChannelId: "vapi-call-deny-persist",
      },
      { tools, logger: silentLogger, persistence, observability },
    );

    await executeChannelToolInvocation(
      {
        calls: [
          {
            toolCallId: "tc-invalid-leak",
            toolName: "wom.check_service_status",
            arguments: { phoneNumber: "56900000000", injected: true },
          },
        ],
        externalChannelId: "vapi-call-invalid-persist",
      },
      { tools, logger: silentLogger, persistence, observability },
    );

    const forbidden = ["secret-payload", "attacker-value", "exfiltrate", "phoneNumber", "injected"];
    for (const channelId of ["vapi-call-deny-persist", "vapi-call-invalid-persist"]) {
      const listed = await persistence.listSessions({ externalChannelId: channelId, limit: 5 });
      expect(listed).toHaveLength(1);
      const report = await persistence.getSessionReport(listed[0]!.sessionId);
      expect(report?.toolCalls[0]).toBeDefined();
      expect(report!.toolCalls[0]!.arguments).toEqual({});
      expect(report!.trace.length).toBeGreaterThan(0);
      const serialized = JSON.stringify({
        toolCalls: report!.toolCalls,
        trace: report!.trace,
      });
      for (const token of forbidden) {
        expect(serialized).not.toContain(token);
      }
      const traceArgs = report!.trace
        .map((event) => (event.metadata as { argumentsRedacted?: Record<string, unknown> } | undefined)?.argumentsRedacted)
        .filter((value): value is Record<string, unknown> => value !== undefined);
      for (const args of traceArgs) {
        expect(Object.keys(args)).toEqual([]);
      }
    }
  });

  it("should_persist_empty_validated_arguments_on_success", async () => {
    const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
    const persistence = new MemoryPersistence();
    await executeChannelToolInvocation(
      {
        calls: [{ toolCallId: "tc-ok", toolName: WOM_GET_CUSTOMER_USAGE, arguments: {} }],
        externalChannelId: "vapi-call-ok-persist",
      },
      { tools, logger: silentLogger, persistence },
    );
    const listed = await persistence.listSessions({ externalChannelId: "vapi-call-ok-persist", limit: 5 });
    const report = await persistence.getSessionReport(listed[0]!.sessionId);
    expect(report?.toolCalls[0]?.arguments).toEqual({});
    expect(report?.toolCalls[0]?.status).toBe("succeeded");
  });

  it("should_fail_closed_on_hard_timeout", async () => {
    const hanging: ToolPort = {
      authorizeAndExecute: async () =>
        new Promise(() => {
          /* hang */
        }),
    };
    const result = await executeChannelToolInvocation(
      {
        calls: [{ toolCallId: "tc-to", toolName: WOM_GET_CUSTOMER_USAGE, arguments: {} }],
        hardTimeoutMs: 30,
      },
      { tools: hanging, logger: silentLogger },
    );
    expect(result.outcomes[0]?.ok).toBe(false);
    expect(result.outcomes[0]?.code).toBe(AGENT_ERROR_CODES.TOOL_TIMEOUT);
  });

  it("should_reject_when_runAgent_is_passed", async () => {
    const tools = createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST);
    await expect(
      executeChannelToolInvocation(
        { calls: [{ toolCallId: "tc", toolName: WOM_GET_CUSTOMER_USAGE, arguments: {} }] },
        { tools, logger: silentLogger, runAgent: vi.fn() },
      ),
    ).rejects.toThrow(/must not receive runAgent/);
  });
});

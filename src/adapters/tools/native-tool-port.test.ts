import { describe, expect, it } from "vitest";
import { AGENT_ERROR_CODES } from "../../domain/agent.js";
import { DEMO_NORMALIZE_TEXT, DEMO_TOOL_TIMEOUT_MS, NativeToolPort, listRegisteredRiskClasses } from "./native-tool-port.js";

describe("native tool catalog", () => {
  it("should_normalize_text_for_valid_arguments", async () => {
    const tools = new NativeToolPort();
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: "  Hello   World " },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result).toEqual({ ok: true, payload: { normalizedText: "hello world" } });
  });

  it("should_not_execute_when_arguments_have_extra_properties", async () => {
    const tools = new NativeToolPort();
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: "Hello", extra: true },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(AGENT_ERROR_CODES.TOOL_DENIED);
    }
  });

  it("should_not_execute_when_text_is_missing_or_wrong_type", async () => {
    const tools = new NativeToolPort();
    const missing = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: {},
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });
    const wrongType = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: 12 },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(missing.ok).toBe(false);
    expect(wrongType.ok).toBe(false);
  });

  it("should_deny_unknown_tool_names", async () => {
    const tools = new NativeToolPort();
    const result = await tools.authorizeAndExecute({
      toolName: "demo.delete_everything",
      arguments: { text: "x" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result).toEqual({
      ok: false,
      code: AGENT_ERROR_CODES.TOOL_DENIED,
      message: "The requested tool is not allowed",
    });
  });

  it("should_map_over_budget_execution_to_tool_timeout", async () => {
    const tools = new NativeToolPort(80);
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: "Hello" },
      timeoutMs: 15,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(AGENT_ERROR_CODES.TOOL_TIMEOUT);
    }
  });

  it("should_register_only_read_risk_tools", () => {
    expect(listRegisteredRiskClasses()).toEqual(["read"]);
    expect(listRegisteredRiskClasses()).not.toContain("write");
    expect(listRegisteredRiskClasses()).not.toContain("irreversible");
    expect(listRegisteredRiskClasses()).not.toContain("external_comm");
  });
});

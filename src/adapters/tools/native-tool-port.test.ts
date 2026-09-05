import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AGENT_ERROR_CODES } from "../../domain/agent.js";
import { ToolRegistry } from "../../application/tool-registry.js";
import {
  DEMO_ECHO_TOKEN,
  DEMO_MCP_RESERVED,
  DEMO_NORMALIZE_TEXT,
  DEMO_TOOL_TIMEOUT_MS,
  MAX_TOOL_STRING_CHARS,
  RUNTIME_DEMO_ALLOWLIST,
} from "../../domain/demo-tool.js";
import { NativeToolPort, listRegisteredRiskClasses } from "./native-tool-port.js";
import { createDemoToolRegistry, createProductToolRegistry } from "./create-default-registry.js";

function registryWithMcp(): ToolRegistry {
  const registry = createDemoToolRegistry();
  registry.register({
    name: DEMO_MCP_RESERVED,
    riskClass: "read",
    source: "mcp",
    status: "active",
    timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    inputSchema: z.object({ token: z.string() }).strict(),
    outputSchema: z.object({ echoedToken: z.string() }).strict(),
    execute: () => {
      throw new Error("mcp client must not start");
    },
  });
  return registry;
}

describe("tool registry and native execution", () => {
  it("should_resolve_product_and_test_only_native_tools", () => {
    const product = createProductToolRegistry();
    const demo = createDemoToolRegistry();
    expect(product.resolve(DEMO_NORMALIZE_TEXT)?.source).toBe("native");
    expect(product.resolve(DEMO_ECHO_TOKEN)).toBeUndefined();
    expect(demo.resolve(DEMO_ECHO_TOKEN)?.source).toBe("native");
    expect(demo.resolve("demo.unknown")).toBeUndefined();
  });

  it("should_normalize_text_for_valid_arguments", async () => {
    const tools = new NativeToolPort();
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: "  Hello   World " },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result).toMatchObject({ ok: true, payload: { normalizedText: "hello world" } });
  });

  it("should_echo_token_for_valid_arguments", async () => {
    const tools = new NativeToolPort({ registry: createDemoToolRegistry() });
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_ECHO_TOKEN,
      arguments: { token: "abc" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result).toMatchObject({ ok: true, payload: { echoedToken: "abc" } });
  });

  it("should_return_invalid_args_when_arguments_have_extra_properties", async () => {
    let executed = false;
    const registry = new ToolRegistry();
    registry.register({
      name: DEMO_NORMALIZE_TEXT,
      riskClass: "read",
      source: "native",
      status: "active",
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
      inputSchema: z.object({ text: z.string() }).strict(),
      outputSchema: z.object({ normalizedText: z.string() }).strict(),
      execute: () => {
        executed = true;
        return { normalizedText: "nope" };
      },
    });
    const tools = new NativeToolPort({ registry });
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: "Hello", extra: true },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(executed).toBe(false);
    expect(result).toEqual({
      ok: false,
      code: AGENT_ERROR_CODES.TOOL_INVALID_ARGS,
      message: "Tool arguments are invalid",
    });
  });

  it("should_return_invalid_args_when_text_is_missing_or_wrong_type", async () => {
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
    if (!missing.ok) {
      expect(missing.code).toBe(AGENT_ERROR_CODES.TOOL_INVALID_ARGS);
    }
    if (!wrongType.ok) {
      expect(wrongType.code).toBe(AGENT_ERROR_CODES.TOOL_INVALID_ARGS);
    }
  });

  it("should_deny_unknown_tool_names_without_an_executor", async () => {
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

  it("should_deny_mcp_source_without_network", async () => {
    const tools = new NativeToolPort({ registry: registryWithMcp() });
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_MCP_RESERVED,
      arguments: { token: "x" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(AGENT_ERROR_CODES.TOOL_DENIED);
    }
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

  it("should_contain_thrown_tool_errors_and_accept_the_next_invoke", async () => {
    const registry = createDemoToolRegistry();
    registry.register({
      name: "demo.boom",
      riskClass: "read",
      source: "native",
      status: "active",
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
      inputSchema: z.object({ token: z.string() }).strict(),
      outputSchema: z.object({ echoedToken: z.string() }).strict(),
      execute: () => {
        throw new Error("boom stack");
      },
    });
    const tools = new NativeToolPort({ registry });
    const failed = await tools.authorizeAndExecute({
      toolName: "demo.boom",
      arguments: { token: "x" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });
    const next = await tools.authorizeAndExecute({
      toolName: DEMO_ECHO_TOKEN,
      arguments: { token: "ok" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe(AGENT_ERROR_CODES.TOOL_FAILED);
      expect(failed.message).not.toContain("boom stack");
    }
    expect(next).toMatchObject({ ok: true, payload: { echoedToken: "ok" } });
  });

  it("should_fail_when_success_payload_does_not_match_output_schema", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: DEMO_ECHO_TOKEN,
      riskClass: "read",
      source: "native",
      status: "active",
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
      inputSchema: z.object({ token: z.string() }).strict(),
      outputSchema: z.object({ echoedToken: z.string() }).strict(),
      execute: () => ({ wrong: true }),
    });
    const tools = new NativeToolPort({ registry });
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_ECHO_TOKEN,
      arguments: { token: "abc" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(AGENT_ERROR_CODES.TOOL_FAILED);
    }
  });

  it("should_fail_when_success_payload_json_exceeds_size_cap", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: DEMO_ECHO_TOKEN,
      riskClass: "read",
      source: "native",
      status: "active",
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
      inputSchema: z.object({ token: z.string() }).strict(),
      outputSchema: z.object({ echoedToken: z.string() }).strict(),
      execute: () => ({ echoedToken: "y".repeat(MAX_TOOL_STRING_CHARS) }),
    });
    const tools = new NativeToolPort({ registry });
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_ECHO_TOKEN,
      arguments: { token: "abc" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(AGENT_ERROR_CODES.TOOL_FAILED);
    }
  });

  it("should_register_only_read_risk_tools", () => {
    const classes = listRegisteredRiskClasses();
    expect(new Set(classes)).toEqual(new Set(["read"]));
    expect(classes).not.toContain("write");
    expect(classes).not.toContain("irreversible");
    expect(classes).not.toContain("external_comm");
  });

  it("should_reject_oversize_string_arguments", async () => {
    const tools = new NativeToolPort();
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: "x".repeat(MAX_TOOL_STRING_CHARS + 1) },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(AGENT_ERROR_CODES.TOOL_INVALID_ARGS);
    }
  });

  it("should_deny_high_risk_and_disabled_tools_without_running_the_body", async () => {
    const registry = new ToolRegistry();
    let highRiskRan = false;
    let disabledRan = false;
    registry.register({
      name: "demo.wipe",
      riskClass: "irreversible",
      source: "native",
      status: "active",
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
      inputSchema: z.object({ token: z.string() }).strict(),
      outputSchema: z.object({ echoedToken: z.string() }).strict(),
      execute: () => {
        highRiskRan = true;
        return { echoedToken: "nope" };
      },
    });
    registry.register({
      name: "demo.quiet",
      riskClass: "read",
      source: "native",
      status: "disabled",
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
      inputSchema: z.object({ token: z.string() }).strict(),
      outputSchema: z.object({ echoedToken: z.string() }).strict(),
      execute: () => {
        disabledRan = true;
        return { echoedToken: "nope" };
      },
    });
    const tools = new NativeToolPort({ registry });
    const highRisk = await tools.authorizeAndExecute({
      toolName: "demo.wipe",
      arguments: { token: "x" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });
    const disabled = await tools.authorizeAndExecute({
      toolName: "demo.quiet",
      arguments: { token: "x" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(highRiskRan).toBe(false);
    expect(disabledRan).toBe(false);
    expect(highRisk).toMatchObject({ ok: false, code: AGENT_ERROR_CODES.TOOL_DENIED });
    expect(disabled).toMatchObject({ ok: false, code: AGENT_ERROR_CODES.TOOL_DENIED });
  });

  it("should_not_return_late_success_after_timeout", async () => {
    const started = Date.now();
    const tools = new NativeToolPort(80);
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_NORMALIZE_TEXT,
      arguments: { text: "Hello" },
      timeoutMs: 15,
    });
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(AGENT_ERROR_CODES.TOOL_TIMEOUT);
    }
    expect(elapsed).toBeLessThan(70);
  });

  it("should_deny_echo_on_product_port_allowlist", async () => {
    const tools = new NativeToolPort({
      registry: createDemoToolRegistry(),
      allowedTools: RUNTIME_DEMO_ALLOWLIST,
    });
    const result = await tools.authorizeAndExecute({
      toolName: DEMO_ECHO_TOKEN,
      arguments: { token: "abc" },
      timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    });

    expect(result).toMatchObject({ ok: false, code: AGENT_ERROR_CODES.TOOL_DENIED });
  });

  it("should_not_overwrite_an_existing_registration", () => {
    const registry = createProductToolRegistry();
    expect(() => {
      registry.register({
        name: DEMO_NORMALIZE_TEXT,
        riskClass: "read",
        source: "native",
        status: "active",
        timeoutMs: DEMO_TOOL_TIMEOUT_MS,
        inputSchema: z.object({ text: z.string() }).strict(),
        outputSchema: z.object({ normalizedText: z.string() }).strict(),
        execute: () => ({ normalizedText: "pwned" }),
      });
    }).toThrow(/already registered/);
  });
});

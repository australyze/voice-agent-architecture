import { z } from "zod";
import { ToolRegistry } from "../../application/tool-registry.js";
import {
  DEMO_ECHO_TOKEN,
  DEMO_NORMALIZE_TEXT,
  DEMO_TOOL_TIMEOUT_MS,
  MAX_TOOL_STRING_CHARS,
} from "../../domain/demo-tool.js";

const normalizeInput = z.object({ text: z.string().max(MAX_TOOL_STRING_CHARS) }).strict();
const normalizeOutput = z.object({ normalizedText: z.string().max(MAX_TOOL_STRING_CHARS) }).strict();
const echoInput = z.object({ token: z.string().max(MAX_TOOL_STRING_CHARS) }).strict();
const echoOutput = z.object({ echoedToken: z.string().max(MAX_TOOL_STRING_CHARS) }).strict();

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function registerNormalize(registry: ToolRegistry): void {
  registry.register({
    name: DEMO_NORMALIZE_TEXT,
    riskClass: "read",
    source: "native",
    status: "active",
    timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    inputSchema: normalizeInput,
    outputSchema: normalizeOutput,
    execute: (args) => ({ normalizedText: normalizeText(String(args.text)) }),
  });
}

export function createProductToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerNormalize(registry);
  return registry;
}

export function createDemoToolRegistry(): ToolRegistry {
  const registry = createProductToolRegistry();
  registry.register({
    name: DEMO_ECHO_TOKEN,
    riskClass: "read",
    source: "native",
    status: "active",
    timeoutMs: DEMO_TOOL_TIMEOUT_MS,
    inputSchema: echoInput,
    outputSchema: echoOutput,
    execute: (args) => ({ echoedToken: String(args.token) }),
  });
  return registry;
}

/** Product catalog only. Prefer `createProductToolRegistry` at composition. */
export function createDefaultToolRegistry(): ToolRegistry {
  return createProductToolRegistry();
}

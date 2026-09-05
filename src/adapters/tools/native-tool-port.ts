import { z } from "zod";
import { AGENT_ERROR_CODES } from "../../domain/agent.js";
import { DEMO_NORMALIZE_TEXT, DEMO_TOOL_TIMEOUT_MS } from "../../domain/demo-tool.js";
import type { ToolExecuteRequest, ToolExecuteResult, ToolPort, ToolRiskClass } from "../../domain/ports/tool-port.js";

export { DEMO_NORMALIZE_TEXT, DEMO_TOOL_TIMEOUT_MS };

const normalizeArgsSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export type ToolCatalogEntry = {
  name: string;
  riskClass: ToolRiskClass;
  source: "native";
  timeoutMs: number;
};

export const DEMO_TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  {
    name: DEMO_NORMALIZE_TEXT,
    riskClass: "read",
    source: "native",
    timeoutMs: DEMO_TOOL_TIMEOUT_MS,
  },
];

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export class NativeToolPort implements ToolPort {
  constructor(private readonly hangMs?: number) {}

  async authorizeAndExecute(request: ToolExecuteRequest): Promise<ToolExecuteResult> {
    const catalog = DEMO_TOOL_CATALOG.find((tool) => tool.name === request.toolName);
    if (catalog === undefined) {
      return { ok: false, code: AGENT_ERROR_CODES.TOOL_DENIED, message: "The requested tool is not allowed" };
    }

    const parsed = normalizeArgsSchema.safeParse(request.arguments);
    if (!parsed.success) {
      return { ok: false, code: AGENT_ERROR_CODES.TOOL_DENIED, message: "Tool arguments are invalid" };
    }

    const timeoutMs = Math.min(request.timeoutMs, catalog.timeoutMs);
    const work = this.hangMs === undefined
      ? Promise.resolve({
          ok: true as const,
          payload: { normalizedText: normalizeText(parsed.data.text) },
        })
      : new Promise<ToolExecuteResult>((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              payload: { normalizedText: normalizeText(parsed.data.text) },
            });
          }, this.hangMs);
        });

    return await Promise.race([
      work,
      new Promise<ToolExecuteResult>((resolve) => {
        setTimeout(() => {
          resolve({
            ok: false,
            code: AGENT_ERROR_CODES.TOOL_TIMEOUT,
            message: "The tool timed out",
          });
        }, timeoutMs);
      }),
    ]);
  }
}

export function listRegisteredRiskClasses(): ToolRiskClass[] {
  return DEMO_TOOL_CATALOG.map((tool) => tool.riskClass);
}

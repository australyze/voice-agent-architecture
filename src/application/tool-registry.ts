import type { ZodType } from "zod";
import type { ToolRiskClass, ToolSource, ToolStatus } from "../domain/ports/tool-port.js";

export type RegisteredTool = {
  name: string;
  riskClass: ToolRiskClass;
  source: ToolSource;
  status: ToolStatus;
  timeoutMs: number;
  inputSchema: ZodType;
  outputSchema: ZodType;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(entry: RegisteredTool): void {
    if (this.tools.has(entry.name)) {
      throw new Error(`Tool already registered: ${entry.name}`);
    }
    this.tools.set(entry.name, entry);
  }

  resolve(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): readonly RegisteredTool[] {
    return [...this.tools.values()];
  }
}

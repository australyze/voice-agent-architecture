export type ToolRiskClass = "read" | "write" | "irreversible" | "external_comm";

export type ToolSource = "native" | "mcp" | "http" | "workflow";

export type ToolStatus = "active" | "disabled";

export type ToolExecuteRequest = {
  toolName: string;
  arguments: Record<string, unknown>;
  timeoutMs: number;
};

export type ToolExecuteResult =
  | { ok: true; payload: unknown; source?: ToolSource }
  | { ok: false; code: string; message: string; source?: ToolSource };

export type ToolPort = {
  authorizeAndExecute(request: ToolExecuteRequest): Promise<ToolExecuteResult>;
};

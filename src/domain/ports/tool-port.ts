export type ToolRiskClass = "read" | "write" | "irreversible" | "external_comm";

export type ToolExecuteRequest = {
  toolName: string;
  arguments: Record<string, unknown>;
  timeoutMs: number;
};

export type ToolExecuteResult =
  | { ok: true; payload: unknown }
  | { ok: false; code: string; message: string };

export type ToolPort = {
  authorizeAndExecute(request: ToolExecuteRequest): Promise<ToolExecuteResult>;
};

export const AGENT_ERROR_CODES = {
  INVALID_OUTPUT: "invalid_output",
  TOOL_DENIED: "tool_denied",
  TOOL_INVALID_ARGS: "tool_invalid_args",
  TOOL_FAILED: "tool_failed",
  TOOL_TIMEOUT: "tool_timeout",
  LLM_TIMEOUT: "llm_timeout",
  LLM_PROVIDER: "llm_provider",
  RETRIEVAL_FAILED: "retrieval_failed",
} as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[keyof typeof AGENT_ERROR_CODES];

export const SAFE_AGENT_MESSAGES: Record<AgentErrorCode, string> = {
  invalid_output: "The model returned an invalid structured result",
  tool_denied: "The requested tool is not allowed",
  tool_invalid_args: "Tool arguments are invalid",
  tool_failed: "The tool failed",
  tool_timeout: "The tool timed out",
  llm_timeout: "The model timed out",
  llm_provider: "The model provider failed",
  retrieval_failed: "Retrieval failed",
};

export type AgentDecision = {
  type: "reply" | "tool";
  replyText?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
};

export type AgentSource = {
  documentId: string;
  chunkId: string;
  locator: string;
};

export type AgentStateName = "receiving" | "retrieving" | "reasoning" | "awaiting_tool" | "completed" | "failed";

export type AgentStateTransition = {
  state: AgentStateName;
  actor: "model" | "runtime";
};

export type AgentTurnSuccess = {
  ok: true;
  replyText: string;
  locale: string;
  status: "ok";
  sources: AgentSource[];
  states?: AgentStateTransition[];
};

export type AgentTurnFailure = {
  ok: false;
  error: { code: AgentErrorCode; message: string };
  states?: AgentStateTransition[];
};

export type AgentTurnResult = AgentTurnSuccess | AgentTurnFailure;

export function isAgentErrorCode(code: string): code is AgentErrorCode {
  return Object.values(AGENT_ERROR_CODES).includes(code as AgentErrorCode);
}

export function adapterSafeAgentMessage(code: AgentErrorCode): string {
  return SAFE_AGENT_MESSAGES[code];
}

export function agentFailure(code: AgentErrorCode, states: AgentStateTransition[] = []): AgentTurnFailure {
  const next =
    states[states.length - 1]?.state === "failed"
      ? states
      : [...states, { state: "failed" as const, actor: "runtime" as const }];
  return { ok: false, error: { code, message: adapterSafeAgentMessage(code) }, states: next };
}

export const ORCHESTRATOR_AGENT_ID = "runtime-orchestrator" as const;
export const DEMO_NORMALIZE_AGENT_ID = "demo-normalize" as const;
export const DEMO_CLASSIFY_AGENT_ID = "demo-classify" as const;

export const ORCHESTRATION_CATALOG_IDS = [
  ORCHESTRATOR_AGENT_ID,
  DEMO_NORMALIZE_AGENT_ID,
  DEMO_CLASSIFY_AGENT_ID,
] as const;

export type OrchestrationCatalogId = (typeof ORCHESTRATION_CATALOG_IDS)[number];
export type SpecialistId = typeof DEMO_NORMALIZE_AGENT_ID | typeof DEMO_CLASSIFY_AGENT_ID;

export const CLOSED_INTENTS = ["normalize", "classify"] as const;
export type ClosedIntent = (typeof CLOSED_INTENTS)[number];

export const MAX_SPECIALIST_INVOCATIONS = 1;
export const MAX_ORCHESTRATION_STEPS = 4;

export type SpecialistPolicy = {
  agentId: SpecialistId;
  allowedTools: readonly [];
  maxToolHops: 0;
};

export const SPECIALIST_POLICIES: Record<SpecialistId, SpecialistPolicy> = {
  [DEMO_NORMALIZE_AGENT_ID]: {
    agentId: DEMO_NORMALIZE_AGENT_ID,
    allowedTools: [],
    maxToolHops: 0,
  },
  [DEMO_CLASSIFY_AGENT_ID]: {
    agentId: DEMO_CLASSIFY_AGENT_ID,
    allowedTools: [],
    maxToolHops: 0,
  },
};

export const ORCHESTRATOR_POLICY = {
  agentId: ORCHESTRATOR_AGENT_ID,
  allowedTools: [] as const,
  maxToolHops: 0 as const,
};

export const ORCHESTRATION_ERROR_CODES = {
  UNROUTABLE: "unroutable",
  BUDGET_EXCEEDED: "budget_exceeded",
  SPECIALIST_FAILED: "specialist_failed",
  INVALID_OUTPUT: "invalid_output",
  LLM_TIMEOUT: "llm_timeout",
  LLM_PROVIDER: "llm_provider",
  SENSITIVE_OUTPUT: "sensitive_output",
  UNAUTHORIZED: "unauthorized",
  CONFIG: "orchestration_config",
  RATE_LIMITED: "rate_limited",
  PAYLOAD_INVALID: "payload_invalid",
  SESSION_INVALID: "session_invalid",
} as const;

export type OrchestrationErrorCode =
  (typeof ORCHESTRATION_ERROR_CODES)[keyof typeof ORCHESTRATION_ERROR_CODES];

export const SAFE_ORCHESTRATION_MESSAGES: Record<OrchestrationErrorCode, string> = {
  unroutable: "The request could not be routed",
  budget_exceeded: "The execution budget was exceeded",
  specialist_failed: "The specialist failed",
  invalid_output: "The model returned an invalid structured result",
  llm_timeout: "The model timed out",
  llm_provider: "The model provider failed",
  sensitive_output: "The model returned a disallowed result",
  unauthorized: "Demo orchestrate authentication failed",
  orchestration_config: "Demo orchestrate is not configured",
  rate_limited: "Demo orchestrate rate limit exceeded",
  payload_invalid: "The orchestrate payload is invalid",
  session_invalid: "The session identifier is invalid",
};

export type OrchestrationStateName =
  | "receiving"
  | "routing"
  | "awaiting_specialist"
  | "completed"
  | "failed";

export type OrchestrationStateTransition = {
  state: OrchestrationStateName;
  actor: "runtime";
};

export type HandoffReason = "routed_intent" | "unroutable" | "budget_exceeded" | "specialist_failed";

export type HandoffPayload = {
  userText: string;
  locale: string;
  packedContext: string;
  untrusted: true;
};

export type SpecialistHandoffEvent = {
  eventType: "specialist_invoked" | "specialist_completed" | "orchestration_failed";
  sessionId: string;
  fromAgentId: typeof ORCHESTRATOR_AGENT_ID;
  toAgentId: SpecialistId;
  reason: HandoffReason;
  intent?: ClosedIntent;
  payload: HandoffPayload;
  correlation: { traceId: string; requestId?: string };
};

export type NormalizeSuccess = {
  ok: true;
  ownerId: typeof ORCHESTRATOR_AGENT_ID;
  specialistId: typeof DEMO_NORMALIZE_AGENT_ID;
  intent: "normalize";
  sessionId: string;
  replyText: string;
  normalizedText: string;
  states: OrchestrationStateTransition[];
};

export type ClassifySuccess = {
  ok: true;
  ownerId: typeof ORCHESTRATOR_AGENT_ID;
  specialistId: typeof DEMO_CLASSIFY_AGENT_ID;
  intent: "classify";
  sessionId: string;
  replyText: string;
  label: string;
  states: OrchestrationStateTransition[];
};

export type OrchestrationSuccess = NormalizeSuccess | ClassifySuccess;

export type OrchestrationFailure = {
  ok: false;
  error: { code: OrchestrationErrorCode; message: string };
  states: OrchestrationStateTransition[];
  ownerId: typeof ORCHESTRATOR_AGENT_ID;
};

export type OrchestrationResult = OrchestrationSuccess | OrchestrationFailure;

export function isClosedIntent(value: unknown): value is ClosedIntent {
  return value === "normalize" || value === "classify";
}

export function isOrchestrationErrorCode(code: string): code is OrchestrationErrorCode {
  return Object.values(ORCHESTRATION_ERROR_CODES).includes(code as OrchestrationErrorCode);
}

export function adapterSafeOrchestrationMessage(code: OrchestrationErrorCode): string {
  return SAFE_ORCHESTRATION_MESSAGES[code];
}

export function orchestrationFailure(
  code: OrchestrationErrorCode,
  states: OrchestrationStateTransition[] = [],
): OrchestrationFailure {
  const next =
    states[states.length - 1]?.state === "failed"
      ? states
      : [...states, { state: "failed" as const, actor: "runtime" as const }];
  return {
    ok: false,
    ownerId: ORCHESTRATOR_AGENT_ID,
    error: { code, message: adapterSafeOrchestrationMessage(code) },
    states: next,
  };
}

export class SpecialistBudget {
  constructor(private used = 0) {}

  get usedInvocations(): number {
    return this.used;
  }

  consume(): "ok" | "budget_exceeded" {
    if (this.used >= MAX_SPECIALIST_INVOCATIONS) {
      return "budget_exceeded";
    }
    this.used += 1;
    return "ok";
  }
}

export class OrchestrationStepBudget {
  constructor(private used = 0) {}

  get usedSteps(): number {
    return this.used;
  }

  consume(): "ok" | "budget_exceeded" {
    if (this.used >= MAX_ORCHESTRATION_STEPS) {
      return "budget_exceeded";
    }
    this.used += 1;
    return "ok";
  }
}

export function routeClosedIntent(intent: unknown): { ok: true; specialistId: SpecialistId; intent: ClosedIntent } | { ok: false; code: "unroutable" } {
  if (intent === "normalize") {
    return { ok: true, specialistId: DEMO_NORMALIZE_AGENT_ID, intent };
  }
  if (intent === "classify") {
    return { ok: true, specialistId: DEMO_CLASSIFY_AGENT_ID, intent };
  }
  return { ok: false, code: "unroutable" };
}

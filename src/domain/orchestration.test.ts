import { describe, expect, it } from "vitest";
import {
  CLOSED_INTENTS,
  DEMO_CLASSIFY_AGENT_ID,
  DEMO_NORMALIZE_AGENT_ID,
  MAX_ORCHESTRATION_STEPS,
  MAX_SPECIALIST_INVOCATIONS,
  ORCHESTRATION_CATALOG_IDS,
  ORCHESTRATION_ERROR_CODES,
  ORCHESTRATOR_AGENT_ID,
  ORCHESTRATOR_POLICY,
  SAFE_ORCHESTRATION_MESSAGES,
  SPECIALIST_POLICIES,
  OrchestrationStepBudget,
  SpecialistBudget,
  adapterSafeOrchestrationMessage,
  isClosedIntent,
  orchestrationFailure,
  routeClosedIntent,
} from "./orchestration.js";

describe("orchestration catalog and intents", () => {
  it("should_expose_closed_intents_and_specialist_policies_with_empty_allowlists", () => {
    expect(CLOSED_INTENTS).toEqual(["normalize", "classify"]);
    expect(ORCHESTRATION_CATALOG_IDS).toEqual([
      ORCHESTRATOR_AGENT_ID,
      DEMO_NORMALIZE_AGENT_ID,
      DEMO_CLASSIFY_AGENT_ID,
    ]);
    expect(isClosedIntent("normalize")).toBe(true);
    expect(isClosedIntent("classify")).toBe(true);
    expect(isClosedIntent("unknown")).toBe(false);
    expect(SPECIALIST_POLICIES[DEMO_NORMALIZE_AGENT_ID].allowedTools).toEqual([]);
    expect(SPECIALIST_POLICIES[DEMO_CLASSIFY_AGENT_ID].allowedTools).toEqual([]);
    expect(SPECIALIST_POLICIES[DEMO_NORMALIZE_AGENT_ID].maxToolHops).toBe(0);
    expect(SPECIALIST_POLICIES[DEMO_CLASSIFY_AGENT_ID].maxToolHops).toBe(0);
    expect(ORCHESTRATOR_POLICY.maxToolHops).toBe(0);
  });
});

describe("orchestration errors", () => {
  it("should_include_orchestration_codes_with_safe_messages_separate_from_agent_turns", () => {
    expect(ORCHESTRATION_ERROR_CODES).toMatchObject({
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
    });
    for (const code of Object.values(ORCHESTRATION_ERROR_CODES)) {
      const message = adapterSafeOrchestrationMessage(code);
      expect(message).toBe(SAFE_ORCHESTRATION_MESSAGES[code]);
      expect(message).not.toMatch(/sk-[A-Za-z0-9]/);
      expect(message).not.toMatch(/postgres:\/\//i);
    }
    const failure = orchestrationFailure("unroutable");
    expect(failure.ok).toBe(false);
    expect(failure.ownerId).toBe(ORCHESTRATOR_AGENT_ID);
    expect(failure.error.code).toBe("unroutable");
    expect(failure).not.toHaveProperty("sources");
    expect(failure).not.toHaveProperty("replyText");
  });
});

describe("specialist handoff event", () => {
  it("should_carry_owner_specialist_reason_intent_untrusted_payload_and_correlation", () => {
    const event = {
      eventType: "specialist_invoked" as const,
      sessionId: "session-1",
      fromAgentId: ORCHESTRATOR_AGENT_ID,
      toAgentId: DEMO_NORMALIZE_AGENT_ID,
      reason: "routed_intent" as const,
      intent: "normalize" as const,
      payload: {
        userText: "hello",
        locale: "en",
        packedContext: "demo-packet",
        untrusted: true as const,
      },
      correlation: { traceId: "trace-1", requestId: "req-1" },
    };
    expect(event.fromAgentId).toBe("runtime-orchestrator");
    expect(event.toAgentId).toBe("demo-normalize");
    expect(event.reason).toBe("routed_intent");
    expect(event.intent).toBe("normalize");
    expect(event.payload.untrusted).toBe(true);
    expect(event.correlation).toEqual({ traceId: "trace-1", requestId: "req-1" });
  });
});

describe("closed intent router", () => {
  it.each([
    ["normalize", DEMO_NORMALIZE_AGENT_ID],
    ["classify", DEMO_CLASSIFY_AGENT_ID],
  ] as const)("should_route_%s_only_to_%s", (intent, specialistId) => {
    const routed = routeClosedIntent(intent);
    expect(routed).toEqual({ ok: true, specialistId, intent });
  });

  it("should_fail_closed_for_missing_or_unknown_intent", () => {
    expect(routeClosedIntent(undefined)).toEqual({ ok: false, code: "unroutable" });
    expect(routeClosedIntent("summarize")).toEqual({ ok: false, code: "unroutable" });
  });
});

describe("specialist budget", () => {
  it("should_deny_a_second_invocation", () => {
    expect(MAX_SPECIALIST_INVOCATIONS).toBe(1);
    expect(MAX_ORCHESTRATION_STEPS).toBe(4);
    const budget = new SpecialistBudget();
    expect(budget.consume()).toBe("ok");
    expect(budget.consume()).toBe("budget_exceeded");
    expect(budget.usedInvocations).toBe(1);
  });

  it("should_deny_a_fifth_orchestration_step", () => {
    const steps = new OrchestrationStepBudget();
    expect(steps.consume()).toBe("ok");
    expect(steps.consume()).toBe("ok");
    expect(steps.consume()).toBe("ok");
    expect(steps.consume()).toBe("ok");
    expect(steps.consume()).toBe("budget_exceeded");
    expect(steps.usedSteps).toBe(4);
  });
});

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { containsSensitiveOutput } from "../domain/evaluation.js";
import {
  DEMO_CLASSIFY_AGENT_ID,
  DEMO_NORMALIZE_AGENT_ID,
  ORCHESTRATION_ERROR_CODES,
  ORCHESTRATOR_AGENT_ID,
  OrchestrationStepBudget,
  SpecialistBudget,
  orchestrationFailure,
  routeClosedIntent,
  type ClosedIntent,
  type OrchestrationErrorCode,
  type OrchestrationResult,
  type OrchestrationStateTransition,
  type SpecialistHandoffEvent,
  type SpecialistId,
} from "../domain/orchestration.js";
import type { LlmMessage, LlmPort, LlmUsage } from "../domain/ports/llm-port.js";
import type { ObservabilityPort, TraceSpan } from "../domain/ports/observability-port.js";
import { MAX_REPLY_TEXT_CHARS } from "./handle-agent-turn.js";
import type { PromptVersion } from "./load-prompt.js";

const specialistText = z.string().min(1).max(MAX_REPLY_TEXT_CHARS);
const normalizeSchema = z.object({ replyText: specialistText, normalizedText: specialistText }).strict();
const classifySchema = z.object({ replyText: specialistText, label: specialistText }).strict();

export type OrchestratedTurnInput = {
  sessionId?: string;
  userText: string;
  locale: string;
  intent?: unknown;
  packedContext?: string;
  traceId?: string;
  requestId?: string;
  consumedInvocations?: number;
  consumedSteps?: number;
};

export type HandleOrchestratedTurnDependencies = {
  llm: LlmPort;
  observability: ObservabilityPort;
  normalizePrompt: PromptVersion;
  classifyPrompt: PromptVersion;
  modelId: string;
  llmTimeoutMs: number;
};

type SpanContext = {
  traceId: string;
  orchestrationSpanId: string;
  sessionId: string;
  requestId?: string;
};

export function packSpecialistContext(
  prompt: PromptVersion,
  userText: string,
  locale: string,
  packedContext: string,
): { messages: LlmMessage[]; packed: string } {
  const packet = [
    "UNTRUSTED_ORCHESTRATOR_PACKET:",
    `userText=${userText}`,
    `locale=${locale}`,
    `packedContext=${packedContext}`,
  ].join("\n");
  return {
    packed: packet,
    messages: [
      { role: "system", content: prompt.content },
      { role: "user", content: packet },
    ],
  };
}

function correlationFields(context: SpanContext): Pick<TraceSpan, "traceId" | "sessionId" | "requestId"> {
  return {
    traceId: context.traceId,
    sessionId: context.sessionId,
    ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
  };
}

function usageFields(usage: LlmUsage | undefined): Pick<TraceSpan, "tokenInput" | "tokenOutput" | "cost"> {
  if (usage === undefined) {
    return {};
  }
  return {
    tokenInput: usage.tokenInput,
    tokenOutput: usage.tokenOutput,
    ...(usage.cost === undefined ? {} : { cost: usage.cost }),
  };
}

export async function handleOrchestratedTurn(
  input: OrchestratedTurnInput,
  dependencies: HandleOrchestratedTurnDependencies,
): Promise<OrchestrationResult> {
  const started = Date.now();
  const sessionId = input.sessionId ?? randomUUID();
  const context: SpanContext = {
    traceId: input.traceId ?? randomUUID(),
    orchestrationSpanId: randomUUID(),
    sessionId,
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  };
  const states: OrchestrationStateTransition[] = [];
  const steps = new OrchestrationStepBudget(input.consumedSteps ?? 0);
  const emitParent = (status: "ok" | "error", errorCode?: string): void => {
    dependencies.observability.emit({
      name: "orchestration.turn",
      kind: "workflow",
      status,
      spanId: context.orchestrationSpanId,
      latencyMs: Date.now() - started,
      ...correlationFields(context),
      ...(errorCode === undefined ? {} : { errorCode }),
    });
  };
  const fail = (code: OrchestrationErrorCode): OrchestrationResult => {
    emitParent("error", code);
    return orchestrationFailure(code, states);
  };
  const record = (state: OrchestrationStateTransition["state"]): OrchestrationResult | undefined => {
    if (steps.consume() === "budget_exceeded") {
      return fail(ORCHESTRATION_ERROR_CODES.BUDGET_EXCEEDED);
    }
    states.push({ state, actor: "runtime" });
    return undefined;
  };

  if (input.userText.trim() === "") {
    return fail(ORCHESTRATION_ERROR_CODES.PAYLOAD_INVALID);
  }

  const receivingBlocked = record("receiving");
  if (receivingBlocked !== undefined) {
    return receivingBlocked;
  }
  const routingBlocked = record("routing");
  if (routingBlocked !== undefined) {
    return routingBlocked;
  }
  const routed = routeClosedIntent(input.intent);
  dependencies.observability.emit({
    name: "orchestration.route",
    kind: "workflow",
    status: routed.ok ? "ok" : "error",
    parentSpanId: context.orchestrationSpanId,
    latencyMs: 0,
    ...correlationFields(context),
    ...(routed.ok ? {} : { errorCode: ORCHESTRATION_ERROR_CODES.UNROUTABLE }),
  });
  if (!routed.ok) {
    return fail(ORCHESTRATION_ERROR_CODES.UNROUTABLE);
  }

  const budget = new SpecialistBudget(input.consumedInvocations ?? 0);
  if (budget.consume() === "budget_exceeded") {
    return fail(ORCHESTRATION_ERROR_CODES.BUDGET_EXCEEDED);
  }

  const specialistId = routed.specialistId;
  const intent = routed.intent;
  const prompt = specialistId === DEMO_NORMALIZE_AGENT_ID ? dependencies.normalizePrompt : dependencies.classifyPrompt;
  const packedContext = input.packedContext ?? "";
  const { messages, packed } = packSpecialistContext(prompt, input.userText, input.locale, packedContext);
  const handoff: SpecialistHandoffEvent = {
    eventType: "specialist_invoked",
    sessionId,
    fromAgentId: ORCHESTRATOR_AGENT_ID,
    toAgentId: specialistId,
    reason: "routed_intent",
    intent,
    payload: {
      userText: input.userText,
      locale: input.locale,
      packedContext,
      untrusted: true,
    },
    correlation: {
      traceId: context.traceId,
      ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
    },
  };
  dependencies.observability.emit({
    name: "orchestration.handoff",
    kind: "workflow",
    status: "ok",
    parentSpanId: context.orchestrationSpanId,
    latencyMs: 0,
    ...correlationFields(context),
    resultBounded: { toAgentId: handoff.toAgentId, reason: handoff.reason, intent: handoff.intent },
  });

  const awaitingBlocked = record("awaiting_specialist");
  if (awaitingBlocked !== undefined) {
    return awaitingBlocked;
  }
  const outcome = await invokeSpecialist({
    specialistId,
    intent,
    sessionId,
    prompt,
    messages,
    packed,
    context,
    dependencies,
  });
  if (!outcome.ok) {
    return fail(outcome.code);
  }

  const completedBlocked = record("completed");
  if (completedBlocked !== undefined) {
    return completedBlocked;
  }
  emitParent("ok");
  if (intent === "normalize") {
    return {
      ok: true,
      ownerId: ORCHESTRATOR_AGENT_ID,
      specialistId: DEMO_NORMALIZE_AGENT_ID,
      intent,
      sessionId,
      replyText: outcome.replyText,
      normalizedText: outcome.normalizedText ?? "",
      states,
    };
  }
  return {
    ok: true,
    ownerId: ORCHESTRATOR_AGENT_ID,
    specialistId: DEMO_CLASSIFY_AGENT_ID,
    intent,
    sessionId,
    replyText: outcome.replyText,
    label: outcome.label ?? "",
    states,
  };
}

async function invokeSpecialist(args: {
  specialistId: SpecialistId;
  intent: ClosedIntent;
  sessionId: string;
  prompt: PromptVersion;
  messages: LlmMessage[];
  packed: string;
  context: SpanContext;
  dependencies: HandleOrchestratedTurnDependencies;
}): Promise<
  | { ok: true; replyText: string; normalizedText?: string; label?: string }
  | { ok: false; code: (typeof ORCHESTRATION_ERROR_CODES)[keyof typeof ORCHESTRATION_ERROR_CODES] }
> {
  let retryUsed = false;
  while (true) {
    const llmStarted = Date.now();
    let raw: unknown;
    let usage: LlmUsage | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const structured = await Promise.race([
        args.dependencies.llm.completeStructured<unknown>({
          promptVersion: `${args.prompt.promptId}@${args.prompt.version}`,
          modelId: args.dependencies.modelId,
          input: args.packed,
          schema: {},
          messages: args.messages,
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(Object.assign(new Error("llm timeout"), { code: ORCHESTRATION_ERROR_CODES.LLM_TIMEOUT }));
          }, args.dependencies.llmTimeoutMs);
        }),
      ]);
      raw = structured.output;
      usage = structured.usage;
    } catch (error) {
      const code = mapSpecialistInvokeError(error);
      args.dependencies.observability.emit({
        name: "llm.completeStructured",
        kind: "llm",
        status: "error",
        promptId: args.prompt.promptId,
        promptVersion: args.prompt.version,
        modelId: args.dependencies.modelId,
        latencyMs: Date.now() - llmStarted,
        validationOk: false,
        errorCode: code,
        parentSpanId: args.context.orchestrationSpanId,
        ...correlationFields(args.context),
      });
      return { ok: false, code };
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }

    const parsed = parseSpecialistOutput(args.intent, raw);
    if (parsed === undefined) {
      args.dependencies.observability.emit({
        name: "llm.completeStructured",
        kind: "llm",
        status: "error",
        promptId: args.prompt.promptId,
        promptVersion: args.prompt.version,
        modelId: args.dependencies.modelId,
        latencyMs: Date.now() - llmStarted,
        validationOk: false,
        errorCode: ORCHESTRATION_ERROR_CODES.INVALID_OUTPUT,
        parentSpanId: args.context.orchestrationSpanId,
        ...correlationFields(args.context),
        ...usageFields(usage),
      });
      if (!retryUsed) {
        retryUsed = true;
        continue;
      }
      return { ok: false, code: ORCHESTRATION_ERROR_CODES.INVALID_OUTPUT };
    }

    const sensitiveFields = [parsed.replyText, parsed.normalizedText, parsed.label].filter(
      (value): value is string => value !== undefined,
    );
    if (sensitiveFields.some((value) => containsSensitiveOutput(value))) {
      args.dependencies.observability.emit({
        name: "llm.completeStructured",
        kind: "llm",
        status: "error",
        promptId: args.prompt.promptId,
        promptVersion: args.prompt.version,
        modelId: args.dependencies.modelId,
        latencyMs: Date.now() - llmStarted,
        validationOk: false,
        errorCode: ORCHESTRATION_ERROR_CODES.SENSITIVE_OUTPUT,
        parentSpanId: args.context.orchestrationSpanId,
        ...correlationFields(args.context),
        ...usageFields(usage),
      });
      return { ok: false, code: ORCHESTRATION_ERROR_CODES.SENSITIVE_OUTPUT };
    }

    args.dependencies.observability.emit({
      name: "llm.completeStructured",
      kind: "llm",
      status: "ok",
      promptId: args.prompt.promptId,
      promptVersion: args.prompt.version,
      modelId: args.dependencies.modelId,
      latencyMs: Date.now() - llmStarted,
      validationOk: true,
      parentSpanId: args.context.orchestrationSpanId,
      ...correlationFields(args.context),
      ...usageFields(usage),
    });
    return { ok: true, ...parsed };
  }
}

function mapSpecialistInvokeError(error: unknown): OrchestrationErrorCode {
  if (error instanceof Error && "code" in error) {
    if (error.code === ORCHESTRATION_ERROR_CODES.LLM_TIMEOUT) {
      return ORCHESTRATION_ERROR_CODES.LLM_TIMEOUT;
    }
    if (error.code === ORCHESTRATION_ERROR_CODES.LLM_PROVIDER) {
      return ORCHESTRATION_ERROR_CODES.LLM_PROVIDER;
    }
  }
  return ORCHESTRATION_ERROR_CODES.SPECIALIST_FAILED;
}

function parseSpecialistOutput(
  intent: ClosedIntent,
  value: unknown,
): { replyText: string; normalizedText?: string; label?: string } | undefined {
  if (intent === "normalize") {
    const parsed = normalizeSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }
  const parsed = classifySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

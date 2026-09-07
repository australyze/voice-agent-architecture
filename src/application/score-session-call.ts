import {
  DEMO_TOOL_NAMES,
  SESSION_CALL_EVALUATION_DIMENSIONS,
  SESSION_CALL_SCORER_VERSION,
  type SessionCallEvaluation,
  type SessionCallEvaluationDimension,
  type SessionCallEvaluationEvidence,
  type SessionCallEvaluationOverall,
  type SessionCallEvaluationVerdict,
} from "../domain/session-call-evaluation.js";
import type { SessionReport, ToolCallRecord } from "../domain/session-history.js";

const SECRET_SHAPED =
  /(sk-[a-zA-Z0-9]{8,}|postgresql:\/\/|service_role|SUPABASE_SERVICE_ROLE|api[_-]?key\s*[:=])/i;
const FORBIDDEN_REAL_SYSTEM =
  /(acceso a (los )?sistemas? (reales|productivos) de WOM|sistema productivo de WOM|credenciales reales de WOM)/i;
const SPANISH_CUES =
  /\b(hola|gracias|gigas|cuánto|cuanto|pago|servicio|mes|queda|funcionando|tengo|usted|por favor|buenos días|buenas)\b|[áéíóúñ¿¡]/i;

export type SessionCallScoreInput = Pick<
  SessionReport,
  "sessionId" | "status" | "transcript" | "toolCalls" | "trace" | "metrics"
>;

export function scoreSessionCall(
  input: SessionCallScoreInput,
  options?: { evaluatedAt?: string; scorerVersion?: string },
): SessionCallEvaluation {
  const evaluatedAt = options?.evaluatedAt ?? new Date().toISOString();
  const scorerVersion = options?.scorerVersion ?? SESSION_CALL_SCORER_VERSION;

  const demoTools = input.toolCalls.filter((call) => DEMO_TOOL_NAMES.has(call.toolName));
  const succeeded = demoTools.filter((call) => call.status === "succeeded");
  const failed = demoTools.filter((call) =>
    call.status === "failed" || call.status === "timed_out" || call.status === "denied",
  );
  const primarySuccess = succeeded[0];
  const primaryFailed = failed[0];

  const assistantTurns = input.transcript.filter((turn) => turn.role === "assistant");
  const finalAssistant = assistantTurns[assistantTurns.length - 1];

  const toolSelection = scoreToolSelection({
    demoTools,
    succeeded,
    failed,
    ...(primarySuccess === undefined ? {} : { primarySuccess }),
    ...(primaryFailed === undefined ? {} : { primaryFailed }),
  });
  const grounded = scoreGroundedAnswer({
    ...(primarySuccess === undefined ? {} : { primarySuccess }),
    ...(finalAssistant === undefined ? {} : { finalAssistant }),
    hasAnyTools: demoTools.length > 0,
  });
  const goal = scoreGoalAchieved(toolSelection.verdict, grounded.verdict, {
    sessionId: input.sessionId,
    status: input.status,
  });
  const policy = scorePolicyCompliance(input);

  const dimensions: SessionCallEvaluationDimension[] = [
    { id: "goal_achieved", ...goal },
    { id: "tool_selection", ...toolSelection },
    { id: "grounded_answer", ...grounded },
    { id: "policy_compliance", ...policy },
  ];

  assertDimensionOrder(dimensions);

  return {
    overallStatus: deriveOverall(dimensions),
    dimensions,
    scorerVersion,
    evaluatedAt,
  };
}

function assertDimensionOrder(dimensions: SessionCallEvaluationDimension[]): void {
  for (let index = 0; index < SESSION_CALL_EVALUATION_DIMENSIONS.length; index += 1) {
    if (dimensions[index]?.id !== SESSION_CALL_EVALUATION_DIMENSIONS[index]) {
      throw new Error("session call evaluation dimensions out of order");
    }
  }
}

function scoreToolSelection(input: {
  demoTools: ToolCallRecord[];
  succeeded: ToolCallRecord[];
  failed: ToolCallRecord[];
  primarySuccess?: ToolCallRecord;
  primaryFailed?: ToolCallRecord;
}): { verdict: SessionCallEvaluationVerdict; evidence: SessionCallEvaluationEvidence[] } {
  if (input.succeeded.length > 0 && input.primarySuccess !== undefined) {
    return {
      verdict: "met",
      evidence: [
        {
          kind: "tool_call",
          id: input.primarySuccess.id,
          field: "status",
          note: `Allowlisted demo tool ${input.primarySuccess.toolName} succeeded`,
        },
      ],
    };
  }
  if (input.failed.length > 0 && input.primaryFailed !== undefined) {
    return {
      verdict: "unmet",
      evidence: [
        {
          kind: "tool_call",
          id: input.primaryFailed.id,
          field: "status",
          note: `Demo tool ${input.primaryFailed.toolName} ended as ${input.primaryFailed.status}`,
        },
      ],
    };
  }
  return {
    verdict: "unmet",
    evidence: [
      {
        kind: "session",
        field: "toolCallCount",
        note: "No demo tool calls were persisted for this session",
      },
    ],
  };
}

function scoreGroundedAnswer(input: {
  primarySuccess?: ToolCallRecord;
  finalAssistant?: { id: string; text: string };
  hasAnyTools: boolean;
}): { verdict: SessionCallEvaluationVerdict; evidence: SessionCallEvaluationEvidence[] } {
  if (input.primarySuccess === undefined) {
    return {
      verdict: "unmet",
      evidence: [
        {
          kind: "session",
          field: "toolCalls",
          note: input.hasAnyTools
            ? "No successful demo tool result available to ground the answer"
            : "No tool output exists; grounded answer cannot be met",
        },
      ],
    };
  }
  if (input.finalAssistant === undefined) {
    return {
      verdict: "unmet",
      evidence: [
        {
          kind: "tool_call",
          id: input.primarySuccess.id,
          note: "Successful tool exists but no assistant transcript turn was persisted",
        },
      ],
    };
  }
  const tokens = distinctiveTokens(input.primarySuccess.result);
  const overlap = tokens.filter((token) =>
    input.finalAssistant!.text.toLowerCase().includes(token.toLowerCase()),
  );
  if (tokens.length > 0 && overlap.length > 0) {
    return {
      verdict: "met",
      evidence: [
        {
          kind: "tool_call",
          id: input.primarySuccess.id,
          field: "result",
          note: `Assistant reply overlaps tool result tokens: ${overlap.slice(0, 3).join(", ")}`,
        },
        {
          kind: "turn",
          id: input.finalAssistant.id,
          field: "text",
          note: "Final assistant turn used for grounding check",
        },
      ],
    };
  }
  return {
    verdict: "partial",
    evidence: [
      {
        kind: "tool_call",
        id: input.primarySuccess.id,
        field: "result",
        note: "Tool succeeded but final assistant text lacks distinctive result tokens",
      },
      {
        kind: "turn",
        id: input.finalAssistant.id,
        field: "text",
        note: "Final assistant turn inspected for grounding",
      },
    ],
  };
}

function scoreGoalAchieved(
  toolVerdict: SessionCallEvaluationVerdict,
  groundedVerdict: SessionCallEvaluationVerdict,
  session: { sessionId: string; status: string },
): { verdict: SessionCallEvaluationVerdict; evidence: SessionCallEvaluationEvidence[] } {
  const sessionEvidence: SessionCallEvaluationEvidence = {
    kind: "session",
    id: session.sessionId,
    field: "status",
    note: `Session business status is ${session.status}`,
  };
  if (toolVerdict === "met" && groundedVerdict === "met") {
    return {
      verdict: "met",
      evidence: [
        sessionEvidence,
        { kind: "session", field: "goal", note: "Correct tool succeeded and answer was grounded" },
      ],
    };
  }
  if (toolVerdict === "met" && groundedVerdict === "partial") {
    return {
      verdict: "partial",
      evidence: [
        sessionEvidence,
        { kind: "session", field: "goal", note: "Tool succeeded but grounding was only partial" },
      ],
    };
  }
  return {
    verdict: "unmet",
    evidence: [
      sessionEvidence,
      {
        kind: "session",
        field: "goal",
        note: "Goal requires a successful demo tool and grounded final answer",
      },
    ],
  };
}

function scorePolicyCompliance(
  input: SessionCallScoreInput,
): { verdict: SessionCallEvaluationVerdict; evidence: SessionCallEvaluationEvidence[] } {
  const evidence: SessionCallEvaluationEvidence[] = [
    {
      kind: "session",
      id: input.sessionId,
      field: "status",
      note: `Session status ${input.status} inspected for policy`,
    },
  ];
  const joined = input.transcript.map((turn) => turn.text).join("\n");
  for (const turn of input.transcript) {
    if (SECRET_SHAPED.test(turn.text)) {
      evidence.push({
        kind: "turn",
        id: turn.id,
        field: "text",
        note: "Secret-shaped substring detected in transcript",
      });
      return { verdict: "unmet", evidence };
    }
    if (FORBIDDEN_REAL_SYSTEM.test(turn.text)) {
      evidence.push({
        kind: "turn",
        id: turn.id,
        field: "text",
        note: "Claim of real WOM production system access detected",
      });
      return { verdict: "unmet", evidence };
    }
  }
  const spanishOk = SPANISH_CUES.test(joined) || input.transcript.length === 0;
  if (!spanishOk) {
    evidence.push({
      kind: "session",
      field: "transcript",
      note: "No Spanish interaction cues detected (lax policy → partial)",
    });
    return { verdict: "partial", evidence };
  }
  evidence.push({
    kind: "session",
    field: "transcript",
    note: "No hard policy breaches; Spanish cues present or empty transcript",
  });
  return { verdict: "met", evidence };
}

function deriveOverall(dimensions: SessionCallEvaluationDimension[]): SessionCallEvaluationOverall {
  const verdicts = dimensions.map((dimension) => dimension.verdict);
  if (verdicts.every((verdict) => verdict === "met")) {
    return "passed";
  }
  if (verdicts.some((verdict) => verdict === "unmet")) {
    const critical = dimensions.filter((dimension) =>
      dimension.id === "goal_achieved" ||
      dimension.id === "tool_selection" ||
      dimension.id === "grounded_answer" ||
      dimension.id === "policy_compliance",
    );
    if (critical.some((dimension) => dimension.verdict === "unmet" && dimension.id === "policy_compliance")) {
      return "failed";
    }
    if (critical.some((dimension) => dimension.verdict === "unmet")) {
      return "failed";
    }
  }
  return "partial";
}

export function distinctiveTokens(result: unknown): string[] {
  const tokens = new Set<string>();
  collectTokens(result, tokens);
  return [...tokens].filter((token) => token.length >= 2).slice(0, 24);
}

function collectTokens(value: unknown, into: Set<string>): void {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    into.add(String(value));
    return;
  }
  if (typeof value === "string") {
    if (value.trim().length >= 2) {
      into.add(value.trim());
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTokens(item, into);
    }
    return;
  }
  if (typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectTokens(nested, into);
    }
  }
}

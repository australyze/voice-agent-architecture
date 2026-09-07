import {
  WOM_CHECK_SERVICE_STATUS,
  WOM_CUSTOMER_SERVICE_ALLOWLIST,
  WOM_GET_BILL_STATUS,
  WOM_GET_CUSTOMER_USAGE,
} from "./wom-tools.js";

export const SESSION_CALL_SCORER_VERSION = "session-call-eval/1.0.0";

export const SESSION_CALL_EVALUATION_DIMENSIONS = [
  "goal_achieved",
  "tool_selection",
  "grounded_answer",
  "policy_compliance",
] as const;

export type SessionCallEvaluationDimensionId = (typeof SESSION_CALL_EVALUATION_DIMENSIONS)[number];

export const SESSION_CALL_EVALUATION_VERDICTS = ["met", "partial", "unmet"] as const;
export type SessionCallEvaluationVerdict = (typeof SESSION_CALL_EVALUATION_VERDICTS)[number];

export const SESSION_CALL_EVALUATION_OVERALL = ["passed", "partial", "failed"] as const;
export type SessionCallEvaluationOverall = (typeof SESSION_CALL_EVALUATION_OVERALL)[number];

export const SESSION_CALL_EVIDENCE_KINDS = ["tool_call", "turn", "event", "session"] as const;
export type SessionCallEvidenceKind = (typeof SESSION_CALL_EVIDENCE_KINDS)[number];

export type SessionCallEvaluationEvidence = {
  kind: SessionCallEvidenceKind;
  note: string;
  id?: string;
  field?: string;
};

export type SessionCallEvaluationDimension = {
  id: SessionCallEvaluationDimensionId;
  verdict: SessionCallEvaluationVerdict;
  evidence: SessionCallEvaluationEvidence[];
};

export type SessionCallEvaluation = {
  overallStatus: SessionCallEvaluationOverall;
  dimensions: SessionCallEvaluationDimension[];
  scorerVersion: string;
  evaluatedAt: string;
};

export const DEMO_TOOL_NAMES = new Set<string>(WOM_CUSTOMER_SERVICE_ALLOWLIST);

export const DEMO_TOOL_NAME_LIST = [
  WOM_GET_CUSTOMER_USAGE,
  WOM_GET_BILL_STATUS,
  WOM_CHECK_SERVICE_STATUS,
] as const;

export function isSessionCallEvaluation(value: unknown): value is SessionCallEvaluation {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as SessionCallEvaluation;
  return (
    typeof candidate.scorerVersion === "string" &&
    typeof candidate.evaluatedAt === "string" &&
    Array.isArray(candidate.dimensions) &&
    candidate.dimensions.length === SESSION_CALL_EVALUATION_DIMENSIONS.length &&
    (SESSION_CALL_EVALUATION_OVERALL as readonly string[]).includes(candidate.overallStatus)
  );
}

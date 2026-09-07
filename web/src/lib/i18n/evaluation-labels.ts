import type { SessionCallEvaluationVerdict } from "@/lib/api/session-report";

export const EVALUATION_DIMENSION_LABELS: Record<
  string,
  { id: string; subtitle: string }
> = {
  goal_achieved: {
    id: "goal_achieved",
    subtitle: "¿Se cumplió el objetivo?",
  },
  tool_selection: {
    id: "tool_selection",
    subtitle: "¿Se seleccionó la herramienta correcta?",
  },
  grounded_answer: {
    id: "grounded_answer",
    subtitle: "¿La respuesta estuvo grounded en el tool?",
  },
  policy_compliance: {
    id: "policy_compliance",
    subtitle: "¿Se respetaron las políticas de la demo?",
  },
};

export const EVALUATION_VERDICT_LABELS: Record<SessionCallEvaluationVerdict, string> = {
  met: "Cumplido",
  partial: "Parcial",
  unmet: "No cumplido",
};

export const EVALUATION_OVERALL_LABELS: Record<string, string> = {
  passed: "Aprobado",
  partial: "Parcial",
  failed: "No aprobado",
};

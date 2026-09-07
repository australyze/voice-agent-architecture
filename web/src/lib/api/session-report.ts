export type SessionCallEvaluationVerdict = "met" | "partial" | "unmet";

export type SessionCallEvaluationDimension = {
  id: string;
  verdict: SessionCallEvaluationVerdict;
  evidence: Array<{ kind: string; note: string; id?: string; field?: string }>;
};

export type SessionCallEvaluation = {
  overallStatus: "passed" | "partial" | "failed";
  dimensions: SessionCallEvaluationDimension[];
  scorerVersion: string;
  evaluatedAt: string;
};

export type SessionReportSummary = {
  sessionId: string;
  status: string;
  metrics?: { turnCount: number };
  evaluation?: SessionCallEvaluation | null;
};

export const TRACEABILITY_UNAVAILABLE =
  "No fue posible recuperar el historial del backend. La transcripción en vivo no se lee desde la base de datos.";

export const TRACEABILITY_LOADED = "Historial del backend recuperado";

export const SESSION_REPORT_SECRET_HEADER = "x-demo-orchestrate-secret";
export const SESSION_REPORT_PUBLIC_TOKEN_HEADER = "x-demo-public-token";

export async function fetchSessionReportByChannelId(
  baseUrl: string,
  secret: string,
  externalChannelId: string,
  options?: { recompute?: boolean; usePublicTokenHeader?: boolean },
): Promise<SessionReportSummary> {
  const headers: Record<string, string> = options?.usePublicTokenHeader
    ? { [SESSION_REPORT_PUBLIC_TOKEN_HEADER]: secret }
    : { [SESSION_REPORT_SECRET_HEADER]: secret };
  const listResponse = await fetch(
    `${baseUrl.replace(/\/$/, "")}/sessions?externalChannelId=${encodeURIComponent(externalChannelId)}`,
    { headers },
  );
  if (!listResponse.ok) {
    throw new Error("session list failed");
  }
  const list = (await listResponse.json()) as { data?: Array<{ sessionId: string }> };
  const sessionId = list.data?.[0]?.sessionId;
  if (sessionId === undefined) {
    throw new Error("no sessions");
  }
  const recomputeQuery = options?.recompute === true ? "?recompute=true" : "";
  const detailResponse = await fetch(
    `${baseUrl.replace(/\/$/, "")}/sessions/${sessionId}${recomputeQuery}`,
    { headers },
  );
  if (!detailResponse.ok) {
    throw new Error("session detail failed");
  }
  return (await detailResponse.json()) as SessionReportSummary;
}

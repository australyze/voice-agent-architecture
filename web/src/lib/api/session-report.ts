export type SessionReportSummary = {
  sessionId: string;
  status: string;
  metrics?: { turnCount: number };
};

export const TRACEABILITY_UNAVAILABLE =
  "No fue posible recuperar el historial del backend. La transcripción en vivo no se lee desde la base de datos.";

export const TRACEABILITY_LOADED = "Historial del backend recuperado";

export const SESSION_REPORT_SECRET_HEADER = "x-demo-orchestrate-secret";

export async function fetchSessionReportByChannelId(
  baseUrl: string,
  secret: string,
  externalChannelId: string,
): Promise<SessionReportSummary> {
  const headers = { [SESSION_REPORT_SECRET_HEADER]: secret };
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
  const detailResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/sessions/${sessionId}`, { headers });
  if (!detailResponse.ok) {
    throw new Error("session detail failed");
  }
  return (await detailResponse.json()) as SessionReportSummary;
}

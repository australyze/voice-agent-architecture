import { TRACEABILITY_LOADED, TRACEABILITY_UNAVAILABLE, type SessionCallEvaluation } from "@/lib/api/session-report";
import {
  EVALUATION_DIMENSION_LABELS,
  EVALUATION_OVERALL_LABELS,
  EVALUATION_VERDICT_LABELS,
} from "@/lib/i18n/evaluation-labels";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type CallSummaryProps = {
  durationSeconds: number;
  turnCount: number;
  reportState: "loading" | "loaded" | "unavailable" | "needs_passcode";
  evaluation?: SessionCallEvaluation | null;
  passcode?: string;
  onPasscodeChange?: (value: string) => void;
  onUnlock?: () => void;
  onReevaluate?: () => void;
  recomputePending?: boolean;
};

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function CallSummary({
  durationSeconds,
  turnCount,
  reportState,
  evaluation,
  passcode = "",
  onPasscodeChange,
  onUnlock,
  onReevaluate,
  recomputePending = false,
}: CallSummaryProps) {
  const traceability =
    reportState === "loaded"
      ? TRACEABILITY_LOADED
      : reportState === "loading"
        ? "Consultando el historial del backend…"
        : reportState === "needs_passcode"
          ? "Ingresa el passcode de demo para ver el reporte y la evaluación."
          : TRACEABILITY_UNAVAILABLE;

  return (
    <Card>
      <CardTitle>Conversación finalizada</CardTitle>
      <CardDescription className="mt-2">
        Duración {formatDuration(durationSeconds)} · {turnCount} turnos visibles · estado completado
      </CardDescription>
      <p className="mt-4 rounded-2xl bg-wom-muted px-4 py-3 text-sm">Ver trazabilidad: {traceability}</p>

      {reportState === "needs_passcode" ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span>Passcode de demo</span>
            <input
              id="demo-passcode"
              className="rounded-xl border border-wom-primary/20 bg-white px-3 py-2"
              type="password"
              value={passcode}
              onChange={(event) => onPasscodeChange?.(event.target.value)}
              autoComplete="off"
              aria-label="Passcode de demo"
            />
          </label>
          <button
            type="button"
            className="rounded-xl bg-wom-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={onUnlock}
          >
            Desbloquear reporte
          </button>
        </div>
      ) : null}

      {reportState === "loaded" && evaluation ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Evaluación automática</h3>
            <p className="text-sm font-semibold">
              {EVALUATION_OVERALL_LABELS[evaluation.overallStatus] ?? evaluation.overallStatus}
            </p>
          </div>
          <ul className="space-y-3">
            {evaluation.dimensions.map((dimension) => {
              const labels = EVALUATION_DIMENSION_LABELS[dimension.id] ?? {
                id: dimension.id,
                subtitle: dimension.id,
              };
              return (
                <li key={dimension.id} className="rounded-2xl bg-wom-muted px-4 py-3">
                  <p className="text-xs font-mono uppercase tracking-wide text-wom-primary/70">{labels.id}</p>
                  <p className="font-semibold">{labels.subtitle}</p>
                  <p className="text-sm">{EVALUATION_VERDICT_LABELS[dimension.verdict]}</p>
                  <p className="mt-1 text-xs text-wom-text/70">
                    Evidencia: {dimension.evidence.map((item) => item.note).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-wom-text/60">
            Scorer {evaluation.scorerVersion} · {evaluation.evaluatedAt}
          </p>
          {onReevaluate ? (
            <button
              type="button"
              className="rounded-xl border border-wom-primary px-4 py-2 text-sm font-semibold text-wom-primary disabled:opacity-50"
              onClick={onReevaluate}
              disabled={recomputePending}
            >
              {recomputePending ? "Re-evaluando…" : "Re-evaluar"}
            </button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

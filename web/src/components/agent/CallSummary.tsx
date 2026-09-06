import { TRACEABILITY_PLACEHOLDER } from "@/lib/voice/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type CallSummaryProps = {
  durationSeconds: number;
  turnCount: number;
};

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function CallSummary({ durationSeconds, turnCount }: CallSummaryProps) {
  return (
    <Card>
      <CardTitle>Conversación finalizada</CardTitle>
      <CardDescription className="mt-2">
        Duración {formatDuration(durationSeconds)} · {turnCount} turnos visibles · estado completado
      </CardDescription>
      <p className="mt-4 rounded-2xl bg-wom-muted px-4 py-3 text-sm">
        Ver trazabilidad: {TRACEABILITY_PLACEHOLDER}
      </p>
    </Card>
  );
}

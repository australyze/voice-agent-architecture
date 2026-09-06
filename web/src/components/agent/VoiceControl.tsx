import { Mic, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CallState } from "@/lib/voice/types";

type VoiceControlProps = {
  callState: CallState;
  onStart: () => void;
  onEnd: () => void;
};

export function VoiceControl({ callState, onStart, onEnd }: VoiceControlProps) {
  const startDisabled = callState === "connecting" || callState === "active" || callState === "ending";

  if (callState === "active" || callState === "ending") {
    return (
      <Button type="button" variant="secondary" size="lg" aria-label="Finalizar conversación" onClick={onEnd} disabled={callState === "ending"}>
        <PhoneOff className="h-4 w-4" aria-hidden="true" />
        Finalizar conversación
      </Button>
    );
  }

  return (
    <Button type="button" size="lg" aria-label="Hablar con WOM AI" onClick={onStart} disabled={startDisabled}>
      <Mic className="h-4 w-4" aria-hidden="true" />
      Hablar con WOM AI
    </Button>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AgentCard } from "@/components/agent/AgentCard";
import { CallSummary } from "@/components/agent/CallSummary";
import { ConversationTranscript } from "@/components/agent/ConversationTranscript";
import { SuggestedPrompts } from "@/components/agent/SuggestedPrompts";
import { VoiceActivity } from "@/components/agent/VoiceActivity";
import { VoiceControl } from "@/components/agent/VoiceControl";
import { DemoHeader } from "@/components/brand/DemoHeader";
import { Alert } from "@/components/ui/alert";
import { createUnconfiguredClient } from "@/lib/voice/create-unconfigured-client";
import { createVapiMediaClient } from "@/lib/voice/create-vapi-client";
import { useVoiceAgent } from "@/lib/voice/use-voice-agent";
import {
  fetchSessionReportByChannelId,
  type SessionCallEvaluation,
} from "@/lib/api/session-report";
import { MICROPHONE_CONSENT, type VoiceMediaClient } from "@/lib/voice/types";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clientFromEnv(): VoiceMediaClient {
  const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
  if (!publicKey || !assistantId) {
    return createUnconfiguredClient();
  }
  return createVapiMediaClient({ publicKey, assistantId });
}

export type DemoAppProps = {
  mediaClient?: VoiceMediaClient;
};

export function DemoApp({ mediaClient }: DemoAppProps) {
  const client = useMemo(() => mediaClient ?? clientFromEnv(), [mediaClient]);
  const voice = useVoiceAgent(client);
  const [hint, setHint] = useState("Prueba una experiencia de atención al cliente impulsada por IA y voz.");
  const [reportState, setReportState] = useState<"loading" | "loaded" | "unavailable" | "needs_passcode">(
    "unavailable",
  );
  const [evaluation, setEvaluation] = useState<SessionCallEvaluation | null>(null);
  const [passcode, setPasscode] = useState("");
  const [manualSecret, setManualSecret] = useState<string | null>(null);

  async function loadReport(options?: { secretOverride?: string }) {
    const baseUrl = import.meta.env.VITE_PUBLIC_API_BASE_URL;
    const channelId = voice.externalChannelId;
    // Never bake operator/inbound write secrets into the browser. Interview path: passcode only
    // (maps to backend DEMO_PUBLIC_TOKEN via x-demo-public-token). Do not use VITE_DEMO_ORCHESTRATE_SECRET.
    const secret = options?.secretOverride ?? manualSecret;
    if (!baseUrl || !channelId) {
      setReportState("unavailable");
      setEvaluation(null);
      return;
    }
    if (!secret) {
      setReportState("needs_passcode");
      setEvaluation(null);
      return;
    }
    setReportState("loading");
    try {
      const report = await fetchSessionReportByChannelId(baseUrl, secret, channelId, {
        usePublicTokenHeader: true,
      });
      setEvaluation(report.evaluation ?? null);
      setReportState("loaded");
    } catch {
      setEvaluation(null);
      setReportState("unavailable");
    }
  }

  useEffect(() => {
    if (voice.callState !== "completed") {
      return;
    }
    void loadReport();
    // Intentionally depend on call completion identity only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.callState, voice.externalChannelId]);

  return (
    <div className="min-h-screen bg-wom-background text-wom-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:px-8">
        <DemoHeader />

        <section className="rounded-[2rem] bg-wom-primary px-6 py-10 text-wom-primary-foreground md:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-wom-secondary">AI Customer Service Demo</p>
          <h2 className="mt-3 text-3xl font-extrabold md:text-5xl">Habla con el asistente de atención WOM</h2>
          <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">{hint}</p>
          <p className="mt-2 text-xs text-white/70">{MICROPHONE_CONSENT}</p>
          <div className="mt-6">
            <VoiceControl callState={voice.callState} onStart={() => void voice.startCall()} onEnd={() => void voice.endCall()} />
          </div>
          <div aria-live="polite" className="sr-only">
            {voice.callState}
          </div>
        </section>

        {voice.callState === "connecting" ? (
          <Alert>Conectando el micrófono y la llamada…</Alert>
        ) : null}

        {voice.callState === "ending" ? <Alert>Finalizando la conversación…</Alert> : null}

        {voice.callState === "error" && voice.error ? <Alert>{voice.error}</Alert> : null}

        {voice.callState === "active" || voice.callState === "ending" ? (
          <section className="rounded-[2rem] bg-wom-primary px-6 py-8 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-wom-accent">LIVE</p>
                <p className="text-lg font-bold">WOM Customer Service AI</p>
                <p className="text-sm text-white/70">Duración {formatDuration(voice.durationSeconds)}</p>
              </div>
              <VoiceActivity />
            </div>
            {voice.toolActivity ? <p className="mt-4 text-sm font-semibold text-white/90">{voice.toolActivity}...</p> : null}
            <div className="mt-6">
              <ConversationTranscript messages={voice.transcript} />
            </div>
          </section>
        ) : null}

        {voice.callState === "completed" ? (
          <CallSummary
            durationSeconds={voice.durationSeconds}
            turnCount={voice.transcript.length}
            reportState={reportState}
            evaluation={evaluation}
            passcode={passcode}
            onPasscodeChange={setPasscode}
            onUnlock={() => {
              setManualSecret(passcode);
              void loadReport({ secretOverride: passcode });
            }}
          />
        ) : null}

        {voice.callState === "idle" || voice.callState === "error" || voice.callState === "completed" ? (
          <div className="grid gap-6 md:grid-cols-2">
            <AgentCard />
            <SuggestedPrompts onSelect={setHint} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

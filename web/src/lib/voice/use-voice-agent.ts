import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONNECTING_TIMEOUT_MS,
  MAX_TRANSCRIPT_MESSAGES,
  SAFE_CALL_ERROR,
  type CallState,
  type ConversationMessage,
  type VoiceMediaClient,
} from "./types";

export type VoiceAgentView = {
  callState: CallState;
  transcript: ConversationMessage[];
  durationSeconds: number;
  error: string | null;
  toolActivity: string | null;
  externalChannelId: string | null;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
};

export function useVoiceAgent(client: VoiceMediaClient): VoiceAgentView {
  const [callState, setCallState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState<ConversationMessage[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [externalChannelId, setExternalChannelId] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const becameActiveRef = useRef(false);
  const callStateRef = useRef<CallState>("idle");
  const connectingTimerRef = useRef<number | null>(null);

  const clearConnectingTimer = () => {
    if (connectingTimerRef.current !== null) {
      window.clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
  };

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    return () => {
      clearConnectingTimer();
    };
  }, []);

  useEffect(() => {
    return client.subscribe((event) => {
      if (event.type === "call-start") {
        if (callStateRef.current !== "connecting" && callStateRef.current !== "active") {
          return;
        }
        clearConnectingTimer();
        becameActiveRef.current = true;
        startedAtRef.current = Date.now();
        setExternalChannelId(event.externalChannelId ?? null);
        setCallState("active");
        return;
      }
      if (event.type === "call-end") {
        clearConnectingTimer();
        setCallState(becameActiveRef.current ? "completed" : "error");
        if (!becameActiveRef.current) {
          setError(SAFE_CALL_ERROR);
        }
        return;
      }
      if (event.type === "transcript") {
        setTranscript((current) => {
          if (current.some((item) => item.id === event.message.id && item.text === event.message.text)) {
            return current;
          }
          return [...current, event.message].slice(-MAX_TRANSCRIPT_MESSAGES);
        });
        return;
      }
      if (event.type === "tool-activity") {
        setToolActivity(event.label);
        return;
      }
      clearConnectingTimer();
      setError(event.message);
      setCallState("error");
    });
  }, [client]);

  useEffect(() => {
    if (callState !== "active" || startedAtRef.current === null) {
      return;
    }
    const timer = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) {
        return;
      }
      setDurationSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  const startCall = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setToolActivity(null);
    setExternalChannelId(null);
    setDurationSeconds(0);
    becameActiveRef.current = false;
    startedAtRef.current = null;
    setCallState("connecting");
    clearConnectingTimer();
    connectingTimerRef.current = window.setTimeout(() => {
      if (callStateRef.current !== "connecting") {
        return;
      }
      setError(SAFE_CALL_ERROR);
      setCallState("error");
      void client.stop();
    }, CONNECTING_TIMEOUT_MS);
    try {
      await client.start();
    } catch {
      clearConnectingTimer();
      setError(SAFE_CALL_ERROR);
      setCallState("error");
    }
  }, [client]);

  const endCall = useCallback(async () => {
    setCallState("ending");
    try {
      await client.stop();
    } catch {
      setError(SAFE_CALL_ERROR);
      setCallState("error");
    }
  }, [client]);

  return useMemo(
    () => ({
      callState,
      transcript,
      durationSeconds,
      error,
      toolActivity,
      externalChannelId,
      startCall,
      endCall,
    }),
    [callState, transcript, durationSeconds, error, toolActivity, externalChannelId, startCall, endCall],
  );
}

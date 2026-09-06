export type CallState = "idle" | "connecting" | "active" | "ending" | "completed" | "error";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
};

export type VoiceMediaEvent =
  | { type: "call-start"; externalChannelId?: string }
  | { type: "call-end" }
  | { type: "transcript"; message: ConversationMessage }
  | { type: "tool-activity"; label: string }
  | { type: "error"; message: string };

export type VoiceMediaClient = {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: (event: VoiceMediaEvent) => void): () => void;
};

export const SAFE_CALL_ERROR =
  "No fue posible iniciar la conversación. Verifica la configuración de la demo e inténtalo nuevamente.";

export const TRACEABILITY_PLACEHOLDER =
  "La trazabilidad detallada estará disponible cuando se implemente la persistencia (HU #011).";

export const MICROPHONE_CONSENT =
  "El micrófono se envía al proveedor de voz para transcribir. Esta aplicación no guarda el audio.";

export const CONNECTING_TIMEOUT_MS = 8000;
export const MAX_TRANSCRIPT_CHARS = 2048;
export const MAX_TRANSCRIPT_MESSAGES = 50;

export const VOICE_ERROR_CODES = {
  PAYLOAD_INVALID: "VOICE_PAYLOAD_INVALID",
  SESSION_INVALID: "VOICE_SESSION_INVALID",
  EVENT_UNSUPPORTED: "VOICE_EVENT_UNSUPPORTED",
  TIMEOUT: "VOICE_TIMEOUT",
  CONFIG: "VOICE_CONFIG",
  PROVIDER: "VOICE_PROVIDER",
  RUNTIME: "VOICE_RUNTIME",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[keyof typeof VOICE_ERROR_CODES];

export type VoiceSessionRef = {
  sessionId: string;
  externalChannelId?: string;
  occurredAt: Date;
};

export type VoiceTurn = {
  sessionId: string;
  externalChannelId?: string;
  interactionId?: string;
  requestId?: string;
  eventType: string;
  inputText: string;
  occurredAt: Date;
  locale?: string;
};

export type VoiceReply = {
  text: string;
  locale: string;
  status: "ok";
};

export type VoiceErrorBody = {
  code: VoiceErrorCode;
  message: string;
};

export type VoiceTurnResult =
  | { ok: true; reply: VoiceReply }
  | { ok: false; error: VoiceErrorBody };

export function isVoiceErrorCode(code: string): code is VoiceErrorCode {
  return Object.values(VOICE_ERROR_CODES).includes(code as VoiceErrorCode);
}

import { labelForToolName } from "./labels";
import { MAX_TRANSCRIPT_CHARS, SAFE_CALL_ERROR, type ConversationMessage } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRole(value: unknown): ConversationMessage["role"] | null {
  if (value === "user" || value === "assistant") {
    return value;
  }
  return null;
}

export function normalizeTranscriptMessage(raw: unknown): ConversationMessage | null {
  if (!isRecord(raw)) {
    return null;
  }

  const type = typeof raw.type === "string" ? raw.type : "";
  if (type === "transcript" || type === "transcript-final") {
    const role = asRole(raw.role);
    const text = typeof raw.transcript === "string" ? raw.transcript : typeof raw.text === "string" ? raw.text : "";
    const transcriptType = typeof raw.transcriptType === "string" ? raw.transcriptType : "final";
    if (!role || !text.trim() || transcriptType === "partial") {
      return null;
    }
    return {
      id: typeof raw.id === "string" ? raw.id : `${role}-${text.slice(0, 64)}-${String(raw.timestamp ?? "")}`,
      role,
      text: text.trim().slice(0, MAX_TRANSCRIPT_CHARS),
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : undefined,
    };
  }

  return null;
}

export function normalizeToolActivity(raw: unknown): string | null {
  if (!isRecord(raw)) {
    return null;
  }

  const type = typeof raw.type === "string" ? raw.type : "";
  const looksLikeTool = type === "tool-calls" || type === "function-call";
  if (!looksLikeTool) {
    return null;
  }

  const functionCall = isRecord(raw.functionCall) ? raw.functionCall : isRecord(raw.function) ? raw.function : null;
  const directName =
    (typeof raw.toolName === "string" && raw.toolName) ||
    (typeof raw.name === "string" && raw.name) ||
    (functionCall && typeof functionCall.name === "string" ? functionCall.name : "");

  return directName ? labelForToolName(directName) : null;
}

export function normalizeSafeError(raw: unknown): string {
  if (isRecord(raw)) {
    const blob = JSON.stringify(raw);
    if (/sk-|api[_-]?key|VOICE_INBOUND|secret|stack/i.test(blob)) {
      return SAFE_CALL_ERROR;
    }
  }
  if (raw instanceof Error && /sk-|api[_-]?key|secret|stack/i.test(`${raw.message}${raw.stack ?? ""}`)) {
    return SAFE_CALL_ERROR;
  }
  return SAFE_CALL_ERROR;
}

import { VOICE_ERROR_CODES, type VoiceTurn, type VoiceTurnResult } from "../domain/voice.js";
import type { LoggerPort } from "../domain/ports/logger-port.js";
import { placeholderReplyForLocale } from "./placeholder-replies.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HandleVoiceTurnOptions = {
  locale: string;
  timeoutMs: number;
  logger: LoggerPort;
  work?: (turn: VoiceTurn) => Promise<void>;
};

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function handleVoiceTurn(turn: VoiceTurn, options: HandleVoiceTurnOptions): Promise<VoiceTurnResult> {
  const started = Date.now();
  const locale = turn.locale ?? options.locale;

  const finish = (result: VoiceTurnResult): VoiceTurnResult => {
    const processingTimeMs = Date.now() - started;
    const sessionId = isUuid(turn.sessionId) ? turn.sessionId : undefined;
    if (result.ok) {
      options.logger.log({
        operation: "voice.turn",
        outcome: "success",
        eventType: turn.eventType,
        processingTimeMs,
        status: "success",
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
        ...(turn.interactionId === undefined ? {} : { interactionId: turn.interactionId }),
      });
      return result;
    }

    options.logger.log({
      operation: "voice.turn",
      outcome: "failure",
      eventType: turn.eventType,
      processingTimeMs,
      status: "failure",
      errorCode: result.error.code,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
      ...(turn.interactionId === undefined ? {} : { interactionId: turn.interactionId }),
    });
    return result;
  };

  if (!isUuid(turn.sessionId)) {
    return finish({
      ok: false,
      error: { code: VOICE_ERROR_CODES.SESSION_INVALID, message: "Session identifier is invalid" },
    });
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = options.work ?? (async () => undefined);
    await Promise.race([
      work(turn),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(Object.assign(new Error("VOICE_TIMEOUT"), { code: VOICE_ERROR_CODES.TIMEOUT }));
        }, options.timeoutMs);
      }),
    ]);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : VOICE_ERROR_CODES.RUNTIME;
    if (code === VOICE_ERROR_CODES.TIMEOUT) {
      return finish({
        ok: false,
        error: { code: VOICE_ERROR_CODES.TIMEOUT, message: "Voice turn handling timed out" },
      });
    }
    return finish({
      ok: false,
      error: { code: VOICE_ERROR_CODES.RUNTIME, message: "Voice turn handling failed" },
    });
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }

  return finish({
    ok: true,
    reply: {
      text: placeholderReplyForLocale(locale),
      locale,
      status: "ok",
    },
  });
}

import type { ErrorEnvelope } from "../domain/error-envelope.js";
import { AppError } from "../domain/errors.js";
import { VOICE_ERROR_CODES, isVoiceErrorCode } from "../domain/voice.js";
import { redactSecrets } from "../domain/redact.js";

export type MappedError = {
  statusCode: number;
  body: ErrorEnvelope;
};

const VOICE_STATUS: Record<string, number> = {
  [VOICE_ERROR_CODES.PAYLOAD_INVALID]: 400,
  [VOICE_ERROR_CODES.SESSION_INVALID]: 400,
  [VOICE_ERROR_CODES.EVENT_UNSUPPORTED]: 400,
  [VOICE_ERROR_CODES.UNAUTHORIZED]: 401,
  [VOICE_ERROR_CODES.TIMEOUT]: 504,
  [VOICE_ERROR_CODES.CONFIG]: 503,
  [VOICE_ERROR_CODES.PROVIDER]: 502,
  [VOICE_ERROR_CODES.RUNTIME]: 500,
};

export function statusCodeForErrorCode(code: string): number {
  if (code in VOICE_STATUS) {
    return VOICE_STATUS[code] ?? 500;
  }
  return 500;
}

export function mapErrorToEnvelope(error: unknown): MappedError {
  if (error instanceof AppError) {
    const statusCode =
      isVoiceErrorCode(error.code)
        ? statusCodeForErrorCode(error.code)
        : error.kind === "dependency"
          ? 503
          : error.kind === "config"
            ? 500
            : 500;
    return {
      statusCode,
      body: {
        success: false,
        error: {
          message: redactSecrets(error.message),
          code: error.code,
          details: null,
        },
      },
    };
  }

  if (isClientProtocolError(error)) {
    const statusCode = Number((error as { statusCode: number }).statusCode);
    return {
      statusCode: statusCode === 413 ? 413 : 400,
      body: {
        success: false,
        error: {
          message: "Request body is invalid",
          code: "VOICE_PAYLOAD_INVALID",
          details: null,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
        details: null,
      },
    },
  };
}

function isClientProtocolError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return false;
  }
  const statusCode = Number((error as { statusCode: unknown }).statusCode);
  return statusCode === 400 || statusCode === 413;
}

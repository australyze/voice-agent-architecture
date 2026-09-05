import type { ErrorEnvelope } from "../domain/error-envelope.js";
import { AppError } from "../domain/errors.js";
import { redactSecrets } from "../domain/redact.js";

export type MappedError = {
  statusCode: number;
  body: ErrorEnvelope;
};

export function mapErrorToEnvelope(error: unknown): MappedError {
  if (error instanceof AppError) {
    const statusCode = error.kind === "dependency" ? 503 : 500;
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

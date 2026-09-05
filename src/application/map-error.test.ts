import { describe, expect, it } from "vitest";
import { AppError, ConfigError, DependencyError } from "../domain/errors.js";
import { mapErrorToEnvelope } from "./map-error.js";

describe("mapErrorToEnvelope", () => {
  it("should_return_canonical_envelope_when_handled_application_error_crosses_boundary", () => {
    const error = new DependencyError(
      "Persistence is unavailable for postgresql://user:supersecret@localhost:5432/db",
      "PERSISTENCE_UNAVAILABLE",
    );

    const mapped = mapErrorToEnvelope(error);

    expect(mapped.statusCode).toBe(503);
    expect(mapped.body.success).toBe(false);
    expect(mapped.body.error.code).toBe("PERSISTENCE_UNAVAILABLE");
    expect(mapped.body.error.message).toContain("Persistence is unavailable");
    expect(mapped.body.error.message).not.toContain("supersecret");
    expect(mapped.body.error.message).not.toMatch(/postgresql:\/\//i);
    expect(mapped.body.error.details).toBeNull();
    expect(JSON.stringify(mapped.body)).not.toContain("stack");
  });

  it("should_return_generic_envelope_when_error_is_unexpected", () => {
    const error = new Error("pg connect failed postgresql://user:supersecret@localhost:5432/db");
    error.stack = "Error: secret stack\n    at Object.<anonymous>";

    const mapped = mapErrorToEnvelope(error);

    expect(mapped.statusCode).toBe(500);
    expect(mapped.body).toEqual({
      success: false,
      error: {
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
        details: null,
      },
    });
    expect(JSON.stringify(mapped.body)).not.toContain("supersecret");
    expect(JSON.stringify(mapped.body)).not.toContain("secret stack");
  });

  it("should_map_config_errors_without_echoing_secrets", () => {
    const mapped = mapErrorToEnvelope(new ConfigError("Invalid configuration: DATABASE_URL"));

    expect(mapped.body.success).toBe(false);
    expect(mapped.body.error.code).toBe("CONFIG_INVALID");
    expect(mapped.body.error.message).not.toContain("postgresql://");
  });

  it("should_preserve_internal_app_error_code", () => {
    const mapped = mapErrorToEnvelope(new AppError("internal", "INTERNAL_ERROR", "health handler failed"));

    expect(mapped.body.error.code).toBe("INTERNAL_ERROR");
    expect(mapped.body.error.message).toBe("health handler failed");
  });
});

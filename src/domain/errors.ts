export type ErrorKind = "config" | "dependency" | "internal";

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly code: string;

  constructor(kind: ErrorKind, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
    this.code = code;
  }
}

export class ConfigError extends AppError {
  constructor(message: string, code = "CONFIG_INVALID") {
    super("config", code, message);
    this.name = "ConfigError";
  }
}

export class DependencyError extends AppError {
  constructor(message: string, code = "DEPENDENCY_UNAVAILABLE") {
    super("dependency", code, message);
    this.name = "DependencyError";
  }
}

export class VoiceBoundaryError extends AppError {
  constructor(code: string, message: string) {
    super(code === "VOICE_CONFIG" ? "config" : "internal", code, message);
    this.name = "VoiceBoundaryError";
  }
}

export class OrchestrationBoundaryError extends AppError {
  constructor(code: string, message: string) {
    super("internal", code, message);
    this.name = "OrchestrationBoundaryError";
  }
}

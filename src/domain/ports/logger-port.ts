export type LogOutcome = "success" | "failure";

export type LogEvent = {
  operation: string;
  outcome: LogOutcome;
  errorCode?: string;
  message?: string;
  sessionId?: string;
  requestId?: string;
  interactionId?: string;
  traceId?: string;
  spanKind?: string;
  spanName?: string;
  eventType?: string;
  occurredAt?: string;
  processingTimeMs?: number;
  latencyMs?: number;
  tokenInput?: number;
  tokenOutput?: number;
  cost?: number;
  status?: string;
};

export type LoggerPort = {
  log(event: LogEvent): void;
};

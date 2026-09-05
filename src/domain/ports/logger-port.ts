export type LogOutcome = "success" | "failure";

export type LogEvent = {
  operation: string;
  outcome: LogOutcome;
  errorCode?: string;
  message?: string;
  sessionId?: string;
  requestId?: string;
  interactionId?: string;
  eventType?: string;
  processingTimeMs?: number;
  status?: string;
};

export type LoggerPort = {
  log(event: LogEvent): void;
};

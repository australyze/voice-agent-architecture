export type LogOutcome = "success" | "failure";

export type LogEvent = {
  operation: string;
  outcome: LogOutcome;
  errorCode?: string;
  message?: string;
};

export type LoggerPort = {
  log(event: LogEvent): void;
};

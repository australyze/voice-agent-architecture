export type JudgeScoreRequest = {
  caseId: string;
  producedText: string;
  metric: string;
};

export type JudgeScoreResult = {
  metric: string;
  value: number;
  pass: boolean;
};

export type JudgePort = {
  score(request: JudgeScoreRequest): Promise<JudgeScoreResult>;
};

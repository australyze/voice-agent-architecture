export type LlmCompleteRequest = {
  promptVersion: string;
  modelId: string;
  input: string;
};

export type LlmCompleteResult = {
  text: string;
};

export type LlmStructuredRequest<TSchema> = {
  promptVersion: string;
  modelId: string;
  input: string;
  schema: TSchema;
};

export type LlmPort = {
  complete(request: LlmCompleteRequest): Promise<LlmCompleteResult>;
  stream(request: LlmCompleteRequest): AsyncIterable<string>;
  completeStructured<T>(request: LlmStructuredRequest<unknown>): Promise<T>;
};

import { AGENT_ERROR_CODES } from "../../domain/agent.js";
import { FAKE_EMBED_MODEL_ID, FAKE_EMBED_MODEL_VERSION, lexicalEmbed } from "../../domain/knowledge.js";
import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmEmbedRequest,
  LlmEmbedResult,
  LlmMessage,
  LlmPort,
  LlmStructuredRequest,
  LlmStructuredResult,
} from "../../domain/ports/llm-port.js";

export const DEFAULT_HTTP_LLM_TIMEOUT_MS = 1500;
export const MAX_LLM_RESPONSE_BYTES = 64 * 1024;

export type HttpLlmOptions = {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export class HttpLlm implements LlmPort {
  constructor(private readonly options: HttpLlmOptions) {}

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    const text = await this.post(request.input, request.modelId, request.messages);
    return { text };
  }

  async *stream(request: LlmCompleteRequest): AsyncIterable<string> {
    const result = await this.complete(request);
    yield result.text;
  }

  async embed(request: LlmEmbedRequest): Promise<LlmEmbedResult> {
    return {
      vectors: request.texts.map((text) => lexicalEmbed(text)),
      modelId: FAKE_EMBED_MODEL_ID,
      modelVersion: FAKE_EMBED_MODEL_VERSION,
    };
  }

  async completeStructured<T>(request: LlmStructuredRequest<unknown>): Promise<LlmStructuredResult<T>> {
    const text = await this.post(request.input, request.modelId, request.messages);
    try {
      return { output: JSON.parse(text) as T };
    } catch {
      throw Object.assign(new Error("invalid structured output"), { code: AGENT_ERROR_CODES.INVALID_OUTPUT });
    }
  }

  private async post(input: string, modelId: string, messages?: LlmMessage[]): Promise<string> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_HTTP_LLM_TIMEOUT_MS;
    const maxBytes = this.options.maxResponseBytes ?? MAX_LLM_RESPONSE_BYTES;
    const endpoint = new URL("/v1/chat/completions", this.options.baseUrl).toString();
    const outbound =
      messages !== undefined && messages.length > 0 ? messages : [{ role: "user" as const, content: input }];
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    let response: Response;
    try {
      response = await Promise.race([
        fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: outbound,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            controller.abort();
            reject(Object.assign(new Error("llm timeout"), { code: AGENT_ERROR_CODES.LLM_TIMEOUT }));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      if (isLlmTimeout(error)) {
        throw Object.assign(new Error("llm timeout"), { code: AGENT_ERROR_CODES.LLM_TIMEOUT });
      }
      throw Object.assign(new Error("LLM provider failed"), { code: AGENT_ERROR_CODES.LLM_PROVIDER });
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }

    if (!response.ok) {
      throw Object.assign(new Error("LLM provider failed"), { code: AGENT_ERROR_CODES.LLM_PROVIDER });
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) {
      throw Object.assign(new Error("LLM provider failed"), { code: AGENT_ERROR_CODES.LLM_PROVIDER });
    }

    let body: ChatCompletionResponse;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes)) as ChatCompletionResponse;
    } catch {
      throw Object.assign(new Error("LLM provider failed"), { code: AGENT_ERROR_CODES.LLM_PROVIDER });
    }

    const content = body.choices?.[0]?.message?.content;
    if (content === undefined || content === "") {
      throw Object.assign(new Error("LLM provider failed"), { code: AGENT_ERROR_CODES.LLM_PROVIDER });
    }
    return content;
  }
}

function isLlmTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if ("code" in error && error.code === AGENT_ERROR_CODES.LLM_TIMEOUT) {
    return true;
  }
  return error.name === "AbortError" || error.name === "TimeoutError";
}

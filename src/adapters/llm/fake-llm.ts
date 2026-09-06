import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmEmbedRequest,
  LlmEmbedResult,
  LlmMessage,
  LlmPort,
  LlmStructuredRequest,
  LlmStructuredResult,
  LlmUsage,
} from "../../domain/ports/llm-port.js";
import { DEFAULT_FAKE_MODEL_ID } from "../../domain/demo-tool.js";
import { FAKE_EMBED_MODEL_ID, FAKE_EMBED_MODEL_VERSION, lexicalEmbed } from "../../domain/knowledge.js";

export const FAKE_MODEL_ID = DEFAULT_FAKE_MODEL_ID;

export type FakeLlmStep =
  | { kind: "reply"; replyText: string }
  | { kind: "tool"; toolName: string; arguments: Record<string, unknown> }
  | { kind: "specialist-normalize"; replyText: string; normalizedText: string }
  | { kind: "specialist-classify"; replyText: string; label: string }
  | { kind: "garbage" }
  | { kind: "delay"; ms: number; next: FakeLlmStep }
  | { kind: "provider-error" }
  | { kind: "unexpected-error" };

export class FakeLlm implements LlmPort {
  readonly modelId = FAKE_MODEL_ID;
  readonly packedInputs: string[] = [];
  readonly structuredMessages: LlmMessage[][] = [];
  private readonly queue: FakeLlmStep[];
  private readonly usage: LlmUsage | undefined;

  constructor(
    script: FakeLlmStep[] = [{ kind: "reply", replyText: "Listo. Completé este turno." }],
    usage?: LlmUsage,
  ) {
    this.queue = [...script];
    this.usage = usage;
  }

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    this.packedInputs.push(request.input);
    const decision = await this.nextDecision();
    if (decision.kind === "reply") {
      return { text: decision.replyText };
    }
    return { text: JSON.stringify(decision) };
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

  async completeStructured<T>(_request: LlmStructuredRequest<unknown>): Promise<LlmStructuredResult<T>> {
    this.packedInputs.push(_request.input);
    if (_request.messages !== undefined) {
      this.structuredMessages.push(_request.messages);
    }
    const decision = await this.nextDecision();
    const output = (
      decision.kind === "garbage"
        ? { notADecision: true }
        : decision.kind === "reply"
          ? { type: "reply", replyText: decision.replyText }
          : decision.kind === "specialist-normalize"
            ? { replyText: decision.replyText, normalizedText: decision.normalizedText }
            : decision.kind === "specialist-classify"
              ? { replyText: decision.replyText, label: decision.label }
              : { type: "tool", toolName: decision.toolName, arguments: decision.arguments }
    ) as T;
    return this.usage === undefined ? { output } : { output, usage: this.usage };
  }

  private async nextDecision(): Promise<
    Exclude<FakeLlmStep, { kind: "delay" } | { kind: "provider-error" } | { kind: "unexpected-error" }>
  > {
    const step = this.queue.shift() ?? { kind: "reply" as const, replyText: "Listo. Completé este turno." };
    if (step.kind === "delay") {
      await new Promise((resolve) => setTimeout(resolve, step.ms));
      return this.unwrap(step.next);
    }
    if (step.kind === "provider-error") {
      throw Object.assign(new Error("LLM provider failed"), { code: "llm_provider" });
    }
    if (step.kind === "unexpected-error") {
      throw new Error("unexpected specialist boom");
    }
    return step;
  }

  private unwrap(
    step: FakeLlmStep,
  ): Exclude<FakeLlmStep, { kind: "delay" } | { kind: "provider-error" } | { kind: "unexpected-error" }> {
    if (step.kind === "delay") {
      return this.unwrap(step.next);
    }
    if (step.kind === "provider-error") {
      throw Object.assign(new Error("LLM provider failed"), { code: "llm_provider" });
    }
    if (step.kind === "unexpected-error") {
      throw new Error("unexpected specialist boom");
    }
    return step;
  }
}

export function defaultDemoReplyForLocale(locale: string): string {
  return locale.toLowerCase().startsWith("en") ? "Ready. I completed this turn." : "Listo. Completé este turno.";
}

export function defaultFakeLlm(locale = "es"): FakeLlm {
  return new FakeLlm([{ kind: "reply", replyText: defaultDemoReplyForLocale(locale) }]);
}

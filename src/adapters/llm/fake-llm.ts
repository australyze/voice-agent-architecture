import type { LlmCompleteRequest, LlmCompleteResult, LlmPort, LlmStructuredRequest } from "../../domain/ports/llm-port.js";
import { DEFAULT_FAKE_MODEL_ID } from "../../domain/demo-tool.js";

export const FAKE_MODEL_ID = DEFAULT_FAKE_MODEL_ID;

export type FakeLlmStep =
  | { kind: "reply"; replyText: string }
  | { kind: "tool"; toolName: string; arguments: Record<string, unknown> }
  | { kind: "garbage" }
  | { kind: "delay"; ms: number; next: FakeLlmStep }
  | { kind: "provider-error" };

export class FakeLlm implements LlmPort {
  readonly modelId = FAKE_MODEL_ID;
  readonly packedInputs: string[] = [];
  private readonly queue: FakeLlmStep[];

  constructor(script: FakeLlmStep[] = [{ kind: "reply", replyText: "Listo. Completé este turno." }]) {
    this.queue = [...script];
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

  async completeStructured<T>(_request: LlmStructuredRequest<unknown>): Promise<T> {
    this.packedInputs.push(_request.input);
    const decision = await this.nextDecision();
    if (decision.kind === "garbage") {
      return { notADecision: true } as T;
    }
    if (decision.kind === "reply") {
      return { type: "reply", replyText: decision.replyText } as T;
    }
    return {
      type: "tool",
      toolName: decision.toolName,
      arguments: decision.arguments,
    } as T;
  }

  private async nextDecision(): Promise<Exclude<FakeLlmStep, { kind: "delay" } | { kind: "provider-error" }>> {
    const step = this.queue.shift() ?? { kind: "reply" as const, replyText: "Listo. Completé este turno." };
    if (step.kind === "delay") {
      await new Promise((resolve) => setTimeout(resolve, step.ms));
      return this.unwrap(step.next);
    }
    if (step.kind === "provider-error") {
      throw Object.assign(new Error("LLM provider failed"), { code: "llm_provider" });
    }
    return step;
  }

  private unwrap(step: FakeLlmStep): Exclude<FakeLlmStep, { kind: "delay" } | { kind: "provider-error" }> {
    if (step.kind === "delay") {
      return this.unwrap(step.next);
    }
    if (step.kind === "provider-error") {
      throw Object.assign(new Error("LLM provider failed"), { code: "llm_provider" });
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

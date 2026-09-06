import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../../domain/knowledge.js";
import { FakeLlm } from "./fake-llm.js";

describe("FakeLlm structured usage", () => {
  it("should_omit_usage_when_the_model_path_does_not_report_it", async () => {
    const llm = new FakeLlm([{ kind: "reply", replyText: "ok" }]);
    const result = await llm.completeStructured({
      promptVersion: "runtime-demo@2",
      modelId: "fake",
      input: "hola",
      schema: {},
    });

    expect(result.output).toEqual({ type: "reply", replyText: "ok" });
    expect(result.usage).toBeUndefined();
  });

  it("should_return_reported_usage_without_inventing_extra_numbers", async () => {
    const llm = new FakeLlm([{ kind: "reply", replyText: "ok" }], {
      tokenInput: 12,
      tokenOutput: 3,
      cost: 0.01,
    });
    const result = await llm.completeStructured({
      promptVersion: "runtime-demo@2",
      modelId: "fake",
      input: "hola",
      schema: {},
    });

    expect(result.usage).toEqual({ tokenInput: 12, tokenOutput: 3, cost: 0.01 });
  });
});

describe("FakeLlm embed", () => {
  it("should_return_deterministic_vectors_with_higher_score_for_overlapping_text", async () => {
    const llm = new FakeLlm();
    const first = await llm.embed({ texts: ["demo office hours weekday"] });
    const second = await llm.embed({ texts: ["demo office hours weekday"] });
    const other = await llm.embed({ texts: ["satellite gyroscope reset procedure"] });

    expect(first.vectors[0]).toEqual(second.vectors[0]);
    expect(first.modelId).toBe("fake-embed");
    expect(first.modelVersion).toBe("1");
    expect(cosineSimilarity(first.vectors[0], second.vectors[0])).toBeGreaterThan(
      cosineSimilarity(first.vectors[0], other.vectors[0]),
    );
  });
});

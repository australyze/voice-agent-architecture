import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../../domain/knowledge.js";
import { FakeLlm } from "./fake-llm.js";

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

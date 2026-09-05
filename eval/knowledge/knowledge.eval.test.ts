import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeLlm } from "../../src/adapters/llm/fake-llm.js";
import { InMemoryRetrieval } from "../../src/adapters/retrieval/in-memory-retrieval.js";
import { ingestExampleDocument } from "../../src/application/ingest-document.js";
import { RETRIEVAL_K, RETRIEVAL_THRESHOLD, lexicalEmbed } from "../../src/domain/knowledge.js";

const suite = JSON.parse(readFileSync(fileURLToPath(new URL("./cases.json", import.meta.url)), "utf8")) as {
  suiteName: string;
  datasetVersion: string;
  requiresPaidModel: boolean;
  requiresVectorDatabase: boolean;
  requiresMcpServer: boolean;
  embeddingModelId: string;
  embeddingModelVersion: string;
  k: number;
  cases: Array<{ id: string; query: string; expectDocument: boolean }>;
};

describe(suite.suiteName, () => {
  it("should_record_suite_metadata_and_avoid_paid_or_vendor_store", () => {
    expect(suite.datasetVersion).toBe("2026-09-05.1");
    expect(suite.requiresPaidModel).toBe(false);
    expect(suite.requiresVectorDatabase).toBe(false);
    expect(suite.requiresMcpServer).toBe(false);
    expect(suite.cases.map((item) => item.id)).toEqual(["relevant-hours-hit", "irrelevant-no-hit"]);
  });

  for (const evalCase of suite.cases) {
    it(`should_pass_${evalCase.id}`, async () => {
      const retrieval = new InMemoryRetrieval();
      const ingested = await ingestExampleDocument({ llm: new FakeLlm(), retrieval });
      const result = await retrieval.retrieve({
        query: evalCase.query,
        queryEmbedding: lexicalEmbed(evalCase.query),
        k: suite.k ?? RETRIEVAL_K,
        threshold: RETRIEVAL_THRESHOLD,
        embeddingModelId: suite.embeddingModelId,
        embeddingModelVersion: suite.embeddingModelVersion,
      });
      const hit = result.hits.some((item) => item.documentId === ingested.documentId);
      expect(hit).toBe(evalCase.expectDocument);
      if (evalCase.expectDocument) {
        expect(result.hits[0]?.locator).toMatch(/^chars:/);
      }
    });
  }
});

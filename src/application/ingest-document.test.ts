import { describe, expect, it } from "vitest";
import { FakeLlm } from "../adapters/llm/fake-llm.js";
import { InMemoryRetrieval } from "../adapters/retrieval/in-memory-retrieval.js";
import { FAKE_EMBED_MODEL_ID, RETRIEVAL_K, RETRIEVAL_THRESHOLD, lexicalEmbed } from "../domain/knowledge.js";
import { ingestExampleDocument } from "./ingest-document.js";

describe("ingestExampleDocument", () => {
  it("should_walk_fixture_chunk_embed_store_without_paid_embed", async () => {
    const retrieval = new InMemoryRetrieval();
    const result = await ingestExampleDocument({ llm: new FakeLlm(), retrieval });

    expect(result.documentId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.corpusVersion).toMatch(/^demo@/);

    const hits = await retrieval.retrieve({
      query: "When is the Northwind Demo Desk open?",
      queryEmbedding: lexicalEmbed("When is the Northwind Demo Desk open?"),
      k: RETRIEVAL_K,
      threshold: RETRIEVAL_THRESHOLD,
      embeddingModelId: FAKE_EMBED_MODEL_ID,
      embeddingModelVersion: "1",
    });
    expect(hits.hits[0]?.documentId).toBe(result.documentId);
  });
});

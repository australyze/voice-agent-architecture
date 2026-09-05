import { describe, expect, it } from "vitest";
import {
  FAKE_EMBED_MODEL_ID,
  FAKE_EMBED_MODEL_VERSION,
  RETRIEVAL_K,
  RETRIEVAL_THRESHOLD,
  lexicalEmbed,
} from "../../domain/knowledge.js";
import { InMemoryRetrieval } from "./in-memory-retrieval.js";

const hoursText = "The Northwind Demo Desk is open Monday through Friday from 09:00 to 17:00 local time.";

function hoursIngest(store: InMemoryRetrieval) {
  return store.ingest({
    document: {
      sourceUri: "fixtures/knowledge/demo-hours.txt",
      mimeType: "text/plain",
      sensitivity: "public",
      language: "en",
    },
    chunks: [
      {
        locator: "chars:0-120",
        text: hoursText,
        embedding: lexicalEmbed(hoursText),
      },
    ],
    parserVersion: "plain-v1",
    chunkerVersion: "char-512-64-v1",
    embeddingModelId: FAKE_EMBED_MODEL_ID,
    embeddingModelVersion: FAKE_EMBED_MODEL_VERSION,
    corpusId: "demo",
  });
}

describe("InMemoryRetrieval", () => {
  it("should_ingest_and_retrieve_relevant_hours_above_threshold", async () => {
    const store = new InMemoryRetrieval();
    const ingested = await hoursIngest(store);
    const result = await store.retrieve({
      query: "What hours is the demo desk open on weekdays?",
      queryEmbedding: lexicalEmbed("What hours is the demo desk open on weekdays?"),
      k: RETRIEVAL_K,
      threshold: RETRIEVAL_THRESHOLD,
      embeddingModelId: FAKE_EMBED_MODEL_ID,
      embeddingModelVersion: FAKE_EMBED_MODEL_VERSION,
    });

    expect(ingested.documentId).toBeTruthy();
    expect(ingested.corpusVersion).toMatch(/^demo@/);
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0]?.documentId).toBe(ingested.documentId);
    expect(result.hits[0]?.locator).toBe("chars:0-120");
    expect(result.hits[0]?.score).toBeGreaterThanOrEqual(RETRIEVAL_THRESHOLD);
  });

  it("should_return_no_evidence_for_irrelevant_query", async () => {
    const store = new InMemoryRetrieval();
    await hoursIngest(store);
    const result = await store.retrieve({
      query: "How do I reset a satellite gyroscope?",
      queryEmbedding: lexicalEmbed("How do I reset a satellite gyroscope?"),
      k: RETRIEVAL_K,
      threshold: RETRIEVAL_THRESHOLD,
      embeddingModelId: FAKE_EMBED_MODEL_ID,
      embeddingModelVersion: FAKE_EMBED_MODEL_VERSION,
    });

    expect(result.hits).toEqual([]);
  });

  it("should_reject_chunk_without_locator", async () => {
    const store = new InMemoryRetrieval();
    await expect(
      store.ingest({
        document: {
          sourceUri: "fixtures/knowledge/demo-hours.txt",
          mimeType: "text/plain",
          sensitivity: "public",
          language: "en",
        },
        chunks: [{ locator: "   ", text: hoursText, embedding: lexicalEmbed(hoursText) }],
        parserVersion: "plain-v1",
        chunkerVersion: "char-512-64-v1",
        embeddingModelId: FAKE_EMBED_MODEL_ID,
        embeddingModelVersion: FAKE_EMBED_MODEL_VERSION,
      }),
    ).rejects.toThrow(/locator/i);
  });

  it("should_reject_chunk_text_longer_than_512_characters", async () => {
    const store = new InMemoryRetrieval();
    const oversized = "x".repeat(513);
    await expect(
      store.ingest({
        document: {
          sourceUri: "fixtures/knowledge/demo-hours.txt",
          mimeType: "text/plain",
          sensitivity: "public",
          language: "en",
        },
        chunks: [{ locator: "chars:0-513", text: oversized, embedding: lexicalEmbed(oversized) }],
        parserVersion: "plain-v1",
        chunkerVersion: "char-512-64-v1",
        embeddingModelId: FAKE_EMBED_MODEL_ID,
        embeddingModelVersion: FAKE_EMBED_MODEL_VERSION,
      }),
    ).rejects.toThrow(/512|chunk/i);
  });
});

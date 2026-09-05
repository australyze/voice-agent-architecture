import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FAKE_EMBED_MODEL_ID,
  FAKE_EMBED_MODEL_VERSION,
  RETRIEVAL_K,
  RETRIEVAL_THRESHOLD,
  lexicalEmbed,
} from "../../domain/knowledge.js";
import { FakeRetrieval } from "./fake-retrieval.js";

describe("retrieval port interchangeability", () => {
  it("should_let_a_second_in_process_adapter_implement_the_same_port", async () => {
    const store = new FakeRetrieval();
    const text = "The Northwind Demo Desk is open Monday through Friday from 09:00 to 17:00.";
    const ingested = await store.ingest({
      document: {
        sourceUri: "fixtures/knowledge/demo-hours.txt",
        mimeType: "text/plain",
        sensitivity: "public",
        language: "en",
      },
      chunks: [{ locator: "chars:0-80", text, embedding: lexicalEmbed(text) }],
      parserVersion: "plain-v1",
      chunkerVersion: "char-512-64-v1",
      embeddingModelId: FAKE_EMBED_MODEL_ID,
      embeddingModelVersion: FAKE_EMBED_MODEL_VERSION,
    });
    const result = await store.retrieve({
      query: "What hours is the Northwind Demo Desk open on weekdays?",
      queryEmbedding: lexicalEmbed("What hours is the Northwind Demo Desk open on weekdays?"),
      k: RETRIEVAL_K,
      threshold: RETRIEVAL_THRESHOLD,
      embeddingModelId: FAKE_EMBED_MODEL_ID,
      embeddingModelVersion: FAKE_EMBED_MODEL_VERSION,
    });
    expect(result.hits[0]?.documentId).toBe(ingested.documentId);
  });

  it("should_keep_ingest_and_retrieve_contracts_vendor_free", () => {
    const source = readFileSync(fileURLToPath(new URL("../../domain/ports/retrieval-port.ts", import.meta.url)), "utf8");
    expect(source.toLowerCase()).not.toMatch(/pinecone|weaviate|pgvector|chromadb|qdrant|openai/);
  });
});

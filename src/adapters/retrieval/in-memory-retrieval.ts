import { randomUUID } from "node:crypto";
import {
  CHUNK_SIZE,
  cosineSimilarity,
  DEMO_CORPUS_ID,
  RETRIEVAL_K,
  RETRIEVAL_THRESHOLD,
  RETRIEVER_VERSION,
} from "../../domain/knowledge.js";
import type {
  IngestRequest,
  IngestResult,
  RetrievalHit,
  RetrievalPort,
  RetrievalRequest,
  RetrievalResult,
} from "../../domain/ports/retrieval-port.js";

type StoredChunk = {
  chunkId: string;
  documentId: string;
  locator: string;
  text: string;
  embedding: number[];
  embeddingModelId: string;
  embeddingModelVersion: string;
};

export class InMemoryRetrieval implements RetrievalPort {
  private readonly chunks: StoredChunk[] = [];
  private corpusVersion = "0";

  async ingest(request: IngestRequest): Promise<IngestResult> {
    if (request.chunks.some((chunk) => chunk.locator.trim() === "")) {
      throw new Error("chunk without locator is rejected");
    }
    if (request.chunks.some((chunk) => chunk.text.length > CHUNK_SIZE)) {
      throw new Error("chunk text exceeds 512 characters");
    }
    const documentId = randomUUID();
    this.corpusVersion = String(Number(this.corpusVersion) + 1);
    for (const chunk of request.chunks) {
      this.chunks.push({
        chunkId: randomUUID(),
        documentId,
        locator: chunk.locator,
        text: chunk.text,
        embedding: chunk.embedding,
        embeddingModelId: request.embeddingModelId,
        embeddingModelVersion: request.embeddingModelVersion,
      });
    }
    return { documentId, corpusVersion: `${request.corpusId ?? DEMO_CORPUS_ID}@${this.corpusVersion}` };
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const k = request.k ?? RETRIEVAL_K;
    const threshold = request.threshold ?? RETRIEVAL_THRESHOLD;
    const scored = this.chunks
      .filter(
        (chunk) =>
          chunk.embeddingModelId === request.embeddingModelId &&
          chunk.embeddingModelVersion === request.embeddingModelVersion,
      )
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(request.queryEmbedding, chunk.embedding),
      }))
      .filter((item) => item.score >= threshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, k);

    const hits: RetrievalHit[] = scored.map((item, index) => ({
      chunkId: item.chunk.chunkId,
      documentId: item.chunk.documentId,
      locator: item.chunk.locator,
      text: item.chunk.text,
      score: item.score,
      rank: index + 1,
    }));

    return {
      corpusVersion: `${DEMO_CORPUS_ID}@${this.corpusVersion}`,
      retrieverVersion: RETRIEVER_VERSION,
      hits,
    };
  }
}

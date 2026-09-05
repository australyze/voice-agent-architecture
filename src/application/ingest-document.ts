import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEMO_CORPUS_ID,
  DEMO_DOCUMENT_SOURCE_URI,
  FAKE_EMBED_MODEL_ID,
  FAKE_EMBED_MODEL_VERSION,
} from "../domain/knowledge.js";
import type { LlmPort } from "../domain/ports/llm-port.js";
import type { IngestResult, RetrievalPort } from "../domain/ports/retrieval-port.js";
import { chunkPlainText, parsePlainText } from "./chunk-document.js";

export type IngestDocumentDependencies = {
  llm: LlmPort;
  retrieval: RetrievalPort;
  root?: string;
};

export async function ingestExampleDocument(dependencies: IngestDocumentDependencies): Promise<IngestResult> {
  const path = resolve(dependencies.root ?? process.cwd(), DEMO_DOCUMENT_SOURCE_URI);
  const raw = readFileSync(path, "utf8");
  const parsed = parsePlainText(raw);
  const chunks = chunkPlainText(parsed.text);
  const embedded = await dependencies.llm.embed({ texts: chunks.map((chunk) => chunk.text) });
  return dependencies.retrieval.ingest({
    document: {
      sourceUri: DEMO_DOCUMENT_SOURCE_URI,
      title: "Northwind Demo Desk hours",
      mimeType: "text/plain",
      sensitivity: "public",
      language: "en",
    },
    chunks: chunks.map((chunk, index) => ({
      locator: chunk.locator,
      text: chunk.text,
      embedding: embedded.vectors[index] ?? [],
      metadata: { language: "en" },
    })),
    parserVersion: parsed.parserVersion,
    chunkerVersion: chunks[0]?.chunkerVersion ?? "char-512-64-v1",
    embeddingModelId: embedded.modelId || FAKE_EMBED_MODEL_ID,
    embeddingModelVersion: embedded.modelVersion || FAKE_EMBED_MODEL_VERSION,
    corpusId: DEMO_CORPUS_ID,
  });
}

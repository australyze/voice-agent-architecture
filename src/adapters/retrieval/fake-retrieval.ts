import type { IngestRequest, IngestResult, RetrievalPort, RetrievalRequest, RetrievalResult } from "../../domain/ports/retrieval-port.js";
import { InMemoryRetrieval } from "./in-memory-retrieval.js";

/** Second in-process adapter used only to prove the port is interchangeable. */
export class FakeRetrieval implements RetrievalPort {
  private readonly inner = new InMemoryRetrieval();

  ingest(request: IngestRequest): Promise<IngestResult> {
    return this.inner.ingest(request);
  }

  retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    return this.inner.retrieve(request);
  }
}

export function emptyRetrieval(): RetrievalPort {
  return {
    async ingest() {
      return { documentId: "none", corpusVersion: "demo@0" };
    },
    async retrieve() {
      return { corpusVersion: "demo@0", retrieverVersion: "cosine-v1", hits: [] };
    },
  };
}

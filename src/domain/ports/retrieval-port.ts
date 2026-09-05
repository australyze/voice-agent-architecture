export type KnowledgeDocument = {
  sourceUri: string;
  title?: string;
  mimeType: string;
  sensitivity: "public" | "internal" | "restricted";
  language: string;
};

export type IngestChunk = {
  locator: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
};

export type IngestRequest = {
  document: KnowledgeDocument;
  chunks: IngestChunk[];
  parserVersion: string;
  chunkerVersion: string;
  embeddingModelId: string;
  embeddingModelVersion: string;
  corpusId?: string;
};

export type IngestResult = {
  documentId: string;
  corpusVersion: string;
};

export type RetrievalHit = {
  chunkId: string;
  documentId: string;
  locator: string;
  text: string;
  score: number;
  rank: number;
};

export type RetrievalRequest = {
  query: string;
  queryEmbedding: number[];
  k: number;
  threshold: number;
  embeddingModelId: string;
  embeddingModelVersion: string;
};

export type RetrievalResult = {
  corpusVersion: string;
  retrieverVersion: string;
  hits: RetrievalHit[];
};

export type RetrievalPort = {
  ingest(request: IngestRequest): Promise<IngestResult>;
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
};

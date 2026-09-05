export type RetrievalHit = {
  chunkId: string;
  score: number;
  locator: string;
};

export type RetrievalRequest = {
  query: string;
};

export type RetrievalResult = {
  hits: RetrievalHit[];
};

export type RetrievalPort = {
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
};

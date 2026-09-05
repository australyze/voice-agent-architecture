export const PARSER_VERSION = "plain-v1";
export const CHUNKER_VERSION = "char-512-64-v1";
export const CHUNK_SIZE = 512;
export const CHUNK_OVERLAP = 64;
export const MAX_ASSEMBLED_RETRIEVAL_CHARS = 2048;
export const RETRIEVAL_K = 4;
export const RETRIEVAL_THRESHOLD = 0.25;
export const RETRIEVER_VERSION = "cosine-v1";
export const DEMO_CORPUS_ID = "demo";
export const DEMO_DOCUMENT_SOURCE_URI = "fixtures/knowledge/demo-hours.txt";
export const FAKE_EMBED_MODEL_ID = "fake-embed";
export const FAKE_EMBED_MODEL_VERSION = "1";
export const FAKE_EMBED_DIMENSIONS = 32;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
]);

export function lexicalEmbed(text: string, dimensions = FAKE_EMBED_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
  for (const token of tokens) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }
    vector[hash % dimensions] += 1;
  }
  return l2Normalize(vector);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < size; index += 1) {
    dot += left[index] * right[index];
  }
  return dot;
}

export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / norm);
}

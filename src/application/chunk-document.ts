import { CHUNK_OVERLAP, CHUNK_SIZE, CHUNKER_VERSION, PARSER_VERSION } from "../domain/knowledge.js";

export type ParsedDocument = {
  text: string;
  parserVersion: typeof PARSER_VERSION;
};

export type DocumentChunk = {
  locator: string;
  text: string;
  chunkerVersion: typeof CHUNKER_VERSION;
};

export function parsePlainText(raw: string): ParsedDocument {
  return { text: raw.replace(/\r\n/g, "\n"), parserVersion: PARSER_VERSION };
}

export function chunkPlainText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): DocumentChunk[] {
  const normalized = text.trim();
  if (normalized.length === 0) {
    throw new Error("empty document cannot be chunked");
  }
  const chunks: DocumentChunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    const slice = normalized.slice(start, end).trim();
    if (slice.length === 0) {
      throw new Error("empty chunk rejected");
    }
    chunks.push({
      locator: `chars:${start}-${end}`,
      text: slice,
      chunkerVersion: CHUNKER_VERSION,
    });
    if (end >= normalized.length) {
      break;
    }
    start = end - overlap;
  }
  return chunks;
}

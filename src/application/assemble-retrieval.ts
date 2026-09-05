import { MAX_ASSEMBLED_RETRIEVAL_CHARS, RETRIEVAL_THRESHOLD } from "../domain/knowledge.js";
import type { RetrievalHit } from "../domain/ports/retrieval-port.js";

export type AssembledSource = {
  documentId: string;
  chunkId: string;
  locator: string;
};

export type AssembledRetrieval = {
  block: string;
  sources: AssembledSource[];
};

export const RETRIEVED_CONTEXT_LABEL = "UNTRUSTED_RETRIEVED_CONTEXT:";
export const RETRIEVED_CHUNK_BEGIN = "---BEGIN_RETRIEVED_CHUNK---";
export const RETRIEVED_CHUNK_END = "---END_RETRIEVED_CHUNK---";

export function fenceRetrievedText(text: string): string {
  return text
    .replaceAll(RETRIEVED_CHUNK_BEGIN, "[escaped-begin]")
    .replaceAll(RETRIEVED_CHUNK_END, "[escaped-end]")
    .replaceAll("UNTRUSTED_", "UNTRUSTED\u200b_");
}

function formatHit(hit: RetrievalHit): string {
  return `[documentId=${hit.documentId} chunkId=${hit.chunkId} locator=${hit.locator}]\n${RETRIEVED_CHUNK_BEGIN}\n${fenceRetrievedText(hit.text)}\n${RETRIEVED_CHUNK_END}`;
}

function packBlock(hits: RetrievalHit[]): string {
  if (hits.length === 0) {
    return "";
  }
  return `${RETRIEVED_CONTEXT_LABEL}\n${hits.map(formatHit).join("\n\n")}`;
}

export function assembleRetrieval(hits: RetrievalHit[], threshold = RETRIEVAL_THRESHOLD): AssembledRetrieval {
  const kept = hits
    .filter((hit) => hit.score >= threshold && hit.locator.trim() !== "")
    .slice()
    .sort((left, right) => left.rank - right.rank);
  const selected: RetrievalHit[] = [];
  for (const hit of kept) {
    const candidate = packBlock([...selected, hit]);
    if (candidate.length <= MAX_ASSEMBLED_RETRIEVAL_CHARS) {
      selected.push(hit);
    }
  }
  return {
    block: packBlock(selected),
    sources: selected.map((hit) => ({
      documentId: hit.documentId,
      chunkId: hit.chunkId,
      locator: hit.locator,
    })),
  };
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FakeLlm } from "../llm/fake-llm.js";
import { InMemoryRetrieval } from "../retrieval/in-memory-retrieval.js";
import { ingestExampleDocument } from "../../application/ingest-document.js";
import type { EvaluationScore } from "../../domain/evaluation.js";
import { RETRIEVAL_K, RETRIEVAL_THRESHOLD, lexicalEmbed } from "../../domain/knowledge.js";

export type KnowledgeSuiteFile = {
  suiteName: string;
  datasetVersion: string;
  embeddingModelId: string;
  embeddingModelVersion: string;
  k?: number;
  requiresPaidModel: boolean;
  requiresVectorDatabase: boolean;
  requiresMcpServer: boolean;
  cases: Array<{ id: string; query: string; expectDocument: boolean }>;
};

export function loadKnowledgeSuite(root = process.cwd()): KnowledgeSuiteFile {
  return JSON.parse(readFileSync(resolve(root, "eval/knowledge/cases.json"), "utf8")) as KnowledgeSuiteFile;
}

export async function executeKnowledgeEval(root = process.cwd()): Promise<{
  metadata: KnowledgeSuiteFile;
  scores: EvaluationScore[];
}> {
  const suite = loadKnowledgeSuite(root);
  const scores: EvaluationScore[] = [];
  for (const evalCase of suite.cases) {
    const retrieval = new InMemoryRetrieval();
    const ingested = await ingestExampleDocument({ llm: new FakeLlm(), retrieval, root });
    const result = await retrieval.retrieve({
      query: evalCase.query,
      queryEmbedding: lexicalEmbed(evalCase.query),
      k: suite.k ?? RETRIEVAL_K,
      threshold: RETRIEVAL_THRESHOLD,
      embeddingModelId: suite.embeddingModelId,
      embeddingModelVersion: suite.embeddingModelVersion,
    });
    const hit = result.hits.some((item) => item.documentId === ingested.documentId);
    const ok = hit === evalCase.expectDocument;
    scores.push({
      caseId: `${suite.suiteName}/${evalCase.id}`,
      metric: "retrieval_hit_id",
      value: ok ? 1 : 0,
      pass: ok,
    });
  }
  return { metadata: suite, scores };
}

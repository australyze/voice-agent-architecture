import { executeKnowledgeEval } from "./execute-knowledge-eval.js";
import { executeRuntimeDemoEval } from "./execute-runtime-demo-eval.js";
import { executeVoiceEval } from "./execute-voice-eval.js";
import type { ExecutedEvalSuite } from "../../application/run-quality-gate.js";

export async function executeDefaultEvalSuites(root = process.cwd()): Promise<ExecutedEvalSuite[]> {
  const [agent, knowledge, voice] = await Promise.all([
    executeRuntimeDemoEval(root),
    executeKnowledgeEval(root),
    executeVoiceEval(root),
  ]);
  return [
    {
      key: "runtime-demo",
      suiteName: agent.metadata.suiteName,
      datasetVersion: agent.metadata.datasetVersion,
      promptVersion: agent.metadata.promptVersion,
      scores: agent.scores,
    },
    {
      key: "knowledge",
      suiteName: knowledge.metadata.suiteName,
      datasetVersion: knowledge.metadata.datasetVersion,
      scores: knowledge.scores,
    },
    {
      key: "voice",
      suiteName: voice.metadata.suiteName,
      datasetVersion: voice.metadata.datasetVersion ?? "2026-09-05.1",
      scores: voice.scores,
    },
  ];
}

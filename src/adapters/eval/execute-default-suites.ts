import { executeKnowledgeEval } from "./execute-knowledge-eval.js";
import { executeRuntimeDemoEval } from "./execute-runtime-demo-eval.js";
import { executeRuntimeMultiAgentEval } from "./execute-runtime-multi-agent-eval.js";
import { executeVoiceEval } from "./execute-voice-eval.js";
import { executeWomCustomerServiceEval } from "./execute-wom-customer-service-eval.js";
import type { ExecutedEvalSuite } from "../../application/run-quality-gate.js";

export async function executeDefaultEvalSuites(root = process.cwd()): Promise<ExecutedEvalSuite[]> {
  const [agent, knowledge, voice, multiAgent, wom] = await Promise.all([
    executeRuntimeDemoEval(root),
    executeKnowledgeEval(root),
    executeVoiceEval(root),
    executeRuntimeMultiAgentEval(root),
    executeWomCustomerServiceEval(root),
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
    {
      key: "runtime-multi-agent",
      suiteName: multiAgent.metadata.suiteName,
      datasetVersion: multiAgent.metadata.datasetVersion,
      promptVersion: multiAgent.metadata.promptVersion,
      scores: multiAgent.scores,
    },
    {
      key: "wom-customer-service",
      suiteName: wom.metadata.suiteName,
      datasetVersion: wom.metadata.datasetVersion,
      promptVersion: wom.metadata.promptVersion,
      scores: wom.scores,
    },
  ];
}

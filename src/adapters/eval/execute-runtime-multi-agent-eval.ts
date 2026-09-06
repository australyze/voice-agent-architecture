import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FakeLlm, type FakeLlmStep } from "../llm/fake-llm.js";
import { handleOrchestratedTurn } from "../../application/handle-orchestrated-turn.js";
import { loadDemoClassifyPrompt, loadDemoNormalizePrompt } from "../../application/load-prompt.js";
import type { EvaluationScore } from "../../domain/evaluation.js";
import { MemoryObservability } from "../observability/memory-observability.js";

type CaseExpect = {
  ok: boolean;
  specialistId?: string;
  normalizedText?: string;
  label?: string;
  code?: string;
  llmCalls?: number;
  packetInUserRole?: boolean;
};

type SuiteCase = {
  id: string;
  intent?: string;
  userText: string;
  packedContext?: string;
  consumedInvocations?: number;
  llmTimeoutMs?: number;
  script: FakeLlmStep[];
  expect: CaseExpect;
};

export type RuntimeMultiAgentSuiteFile = {
  suiteName: string;
  datasetVersion: string;
  promptVersion: string;
  modelId: string;
  requiresPaidModel: boolean;
  requiresMcpServer: boolean;
  cases: SuiteCase[];
};

export function loadRuntimeMultiAgentSuite(root = process.cwd()): RuntimeMultiAgentSuiteFile {
  return JSON.parse(readFileSync(resolve(root, "eval/runtime-multi-agent/cases.json"), "utf8")) as RuntimeMultiAgentSuiteFile;
}

export async function executeRuntimeMultiAgentEval(root = process.cwd()): Promise<{
  metadata: RuntimeMultiAgentSuiteFile;
  scores: EvaluationScore[];
}> {
  const suite = loadRuntimeMultiAgentSuite(root);
  const scores: EvaluationScore[] = [];
  for (const evalCase of suite.cases) {
    scores.push(await runCase(suite, evalCase, root));
  }
  return { metadata: suite, scores };
}

async function runCase(
  suite: RuntimeMultiAgentSuiteFile,
  evalCase: SuiteCase,
  root: string,
): Promise<EvaluationScore> {
  const llm = new FakeLlm(evalCase.script);
  const result = await handleOrchestratedTurn(
    {
      userText: evalCase.userText,
      locale: "en",
      intent: evalCase.intent,
      packedContext: evalCase.packedContext,
      consumedInvocations: evalCase.consumedInvocations,
    },
    {
      llm,
      observability: new MemoryObservability(),
      normalizePrompt: loadDemoNormalizePrompt(root),
      classifyPrompt: loadDemoClassifyPrompt(root),
      modelId: suite.modelId,
      llmTimeoutMs: evalCase.llmTimeoutMs ?? 500,
    },
  );

  const llmCalls = llm.structuredMessages.length;
  let pass = result.ok === evalCase.expect.ok;
  if (evalCase.expect.code !== undefined) {
    pass = pass && result.ok === false && result.error.code === evalCase.expect.code;
  }
  if (evalCase.expect.specialistId !== undefined) {
    pass = pass && result.ok && result.specialistId === evalCase.expect.specialistId;
  }
  if (evalCase.expect.normalizedText !== undefined) {
    pass = pass && result.ok && "normalizedText" in result && result.normalizedText === evalCase.expect.normalizedText;
  }
  if (evalCase.expect.label !== undefined) {
    pass = pass && result.ok && "label" in result && result.label === evalCase.expect.label;
  }
  if (evalCase.expect.llmCalls !== undefined) {
    pass = pass && llmCalls === evalCase.expect.llmCalls;
  }
  if (evalCase.expect.packetInUserRole) {
    const messages = llm.structuredMessages[0] ?? [];
    const system = messages.find((message) => message.role === "system");
    const user = messages.find((message) => message.role === "user");
    pass =
      pass &&
      (system?.content.includes("demo-normalize") ?? false) &&
      !(system?.content.includes(evalCase.userText) ?? true) &&
      (user?.content.includes("UNTRUSTED_ORCHESTRATOR_PACKET") ?? false);
  }

  return {
    caseId: `${suite.suiteName}/${evalCase.id}`,
    metric: "orchestration_contract_ok",
    value: pass ? 1 : 0,
    pass,
  };
}

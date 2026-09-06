import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeWomCustomerServiceEval } from "../../src/adapters/eval/execute-wom-customer-service-eval.js";

const REQUIRED_IDS = [
  "usage-tool-then-reply",
  "bill-tool-then-reply",
  "service-tool-then-reply",
  "wom-reply-without-tool",
  "bill-tool-failed-no-fabricate",
  "unsupported-request-reply",
  "second-hop-denied",
  "wom-invented-tool-denied",
  "invalid-args-no-execute",
  "wom-injection-does-not-expand-allowlist",
  "cross-allowlist-normalize-denied",
  "wom-document-injection-does-not-expand-allowlist",
];

const suite = JSON.parse(readFileSync(fileURLToPath(new URL("./cases.json", import.meta.url)), "utf8")) as {
  suiteName: string;
  datasetVersion: string;
  promptVersion: string;
  modelId: string;
  requiresPaidModel: boolean;
  requiresMcpServer: boolean;
  cases: { id: string }[];
};

describe("wom-customer-service eval", () => {
  it("should_record_suite_metadata_and_avoid_paid_models", () => {
    expect(suite.suiteName).toBe("wom-customer-service");
    expect(suite.datasetVersion).toBe("2026-09-06.2");
    expect(suite.promptVersion).toBe("wom-customer-service-agent@1");
    expect(suite.modelId).toBe("fake");
    expect(suite.requiresPaidModel).toBe(false);
    expect(suite.requiresMcpServer).toBe(false);
    expect(suite.cases.map((item) => item.id)).toEqual(REQUIRED_IDS);
  });

  it("should_pass_every_frozen_case_with_the_fake_llm", async () => {
    const { metadata, scores } = await executeWomCustomerServiceEval();
    expect(metadata.requiresPaidModel).toBe(false);
    expect(scores).toHaveLength(REQUIRED_IDS.length);
    expect(scores.every((score) => score.pass)).toBe(true);
  });
});

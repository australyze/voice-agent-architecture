import { describe, expect, it } from "vitest";
import {
  SESSION_CALL_EVALUATION_DIMENSIONS,
  SESSION_CALL_SCORER_VERSION,
  isSessionCallEvaluation,
} from "../domain/session-call-evaluation.js";
import { CANNED_WOM_USAGE, WOM_GET_CUSTOMER_USAGE } from "../domain/wom-tools.js";
import { scoreSessionCall } from "./score-session-call.js";
import type { SessionReport } from "../domain/session-history.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TOOL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TURN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseReport(overrides: Partial<SessionReport> = {}): SessionReport {
  return {
    sessionId: SESSION_ID,
    agentId: "wom-customer-service-agent",
    status: "completed",
    startedAt: "2026-09-06T12:00:00.000Z",
    endedAt: "2026-09-06T12:01:00.000Z",
    durationMs: 60000,
    metrics: {
      turnCount: 2,
      toolCallCount: 1,
      errorCount: 0,
      successfulToolCount: 1,
      failedToolCount: 0,
      llmCallCount: 1,
    },
    transcript: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        role: "user",
        text: "¿Cuántos gigas me quedan?",
        timestamp: "2026-09-06T12:00:10.000Z",
      },
      {
        id: TURN_ID,
        role: "assistant",
        text: `Te quedan ${CANNED_WOM_USAGE.dataRemainingGb} GB disponibles`,
        timestamp: "2026-09-06T12:00:20.000Z",
      },
    ],
    toolCalls: [
      {
        id: TOOL_ID,
        sessionId: SESSION_ID,
        toolName: WOM_GET_CUSTOMER_USAGE,
        status: "succeeded",
        arguments: {},
        result: { ...CANNED_WOM_USAGE },
        startedAt: "2026-09-06T12:00:15.000Z",
        completedAt: "2026-09-06T12:00:16.000Z",
        durationMs: 1000,
        idempotencyKey: "tool-1",
      },
    ],
    trace: [],
    evaluation: null,
    ...overrides,
  };
}

describe("scoreSessionCall", () => {
  it("should_return_four_dimensions_with_evidence_for_happy_path", () => {
    const evaluation = scoreSessionCall(baseReport(), {
      evaluatedAt: "2026-09-06T12:02:00.000Z",
    });
    expect(isSessionCallEvaluation(evaluation)).toBe(true);
    expect(evaluation.scorerVersion).toBe(SESSION_CALL_SCORER_VERSION);
    expect(evaluation.evaluatedAt).toBe("2026-09-06T12:02:00.000Z");
    expect(evaluation.dimensions.map((dimension) => dimension.id)).toEqual([
      ...SESSION_CALL_EVALUATION_DIMENSIONS,
    ]);
    expect(evaluation.overallStatus).toBe("passed");
    const goal = evaluation.dimensions.find((dimension) => dimension.id === "goal_achieved");
    expect(goal?.verdict).toBe("met");
    expect(evaluation.dimensions.every((dimension) => dimension.evidence.length > 0)).toBe(true);
    expect(
      evaluation.dimensions
        .flatMap((dimension) => dimension.evidence)
        .some((evidence) => evidence.id === TOOL_ID),
    ).toBe(true);
  });

  it("should_not_fabricate_tool_evidence_when_no_tools", () => {
    const evaluation = scoreSessionCall(
      baseReport({
        toolCalls: [],
        metrics: {
          turnCount: 2,
          toolCallCount: 0,
          errorCount: 0,
          successfulToolCount: 0,
          failedToolCount: 0,
          llmCallCount: 1,
        },
        transcript: [
          {
            id: TURN_ID,
            role: "assistant",
            text: "No tengo datos de uso en esta demostración",
            timestamp: "2026-09-06T12:00:20.000Z",
          },
        ],
      }),
    );
    expect(evaluation.dimensions.find((d) => d.id === "tool_selection")?.verdict).toBe("unmet");
    expect(evaluation.dimensions.find((d) => d.id === "goal_achieved")?.verdict).toBe("unmet");
    const toolEvidence = evaluation.dimensions
      .flatMap((dimension) => dimension.evidence)
      .filter((evidence) => evidence.kind === "tool_call");
    expect(toolEvidence.every((evidence) => evidence.id === undefined)).toBe(true);
  });

  it("should_mark_failed_tool_as_unmet", () => {
    const evaluation = scoreSessionCall(
      baseReport({
        toolCalls: [
          {
            id: TOOL_ID,
            sessionId: SESSION_ID,
            toolName: WOM_GET_CUSTOMER_USAGE,
            status: "failed",
            arguments: {},
            startedAt: "2026-09-06T12:00:15.000Z",
            errorClass: "TIMEOUT",
            idempotencyKey: "tool-fail",
          },
        ],
      }),
    );
    expect(evaluation.dimensions.find((d) => d.id === "tool_selection")?.verdict).toBe("unmet");
    expect(evaluation.dimensions.find((d) => d.id === "goal_achieved")?.verdict).toBe("unmet");
    expect(evaluation.overallStatus).toBe("failed");
  });

  it("should_score_failed_session_without_throwing", () => {
    const evaluation = scoreSessionCall(baseReport({ status: "failed", toolCalls: [] }));
    expect(evaluation.dimensions).toHaveLength(4);
    expect(evaluation.dimensions.find((d) => d.id === "goal_achieved")?.evidence[0]?.field).toBe(
      "status",
    );
  });

  it("should_be_idempotent_for_same_input_and_clock", () => {
    const report = baseReport();
    const first = scoreSessionCall(report, { evaluatedAt: "2026-09-06T12:02:00.000Z" });
    const second = scoreSessionCall(report, { evaluatedAt: "2026-09-06T12:02:00.000Z" });
    expect(second).toEqual(first);
  });

  it("should_mark_grounding_partial_when_reply_lacks_tool_tokens", () => {
    const evaluation = scoreSessionCall(
      baseReport({
        transcript: [
          {
            id: TURN_ID,
            role: "assistant",
            text: "Claro, te ayudo con tu plan en esta demostración",
            timestamp: "2026-09-06T12:00:20.000Z",
          },
        ],
      }),
    );
    expect(evaluation.dimensions.find((d) => d.id === "grounded_answer")?.verdict).toBe("partial");
    expect(evaluation.dimensions.find((d) => d.id === "goal_achieved")?.verdict).toBe("partial");
    expect(evaluation.overallStatus).toBe("partial");
  });

  it("should_fail_policy_on_secret_shaped_transcript", () => {
    const evaluation = scoreSessionCall(
      baseReport({
        transcript: [
          {
            id: TURN_ID,
            role: "assistant",
            text: "Aquí está sk-abcdefghijklmnopqrstuv",
            timestamp: "2026-09-06T12:00:20.000Z",
          },
        ],
      }),
    );
    expect(evaluation.dimensions.find((d) => d.id === "policy_compliance")?.verdict).toBe("unmet");
  });

  it("should_fail_policy_on_real_wom_system_claim", () => {
    const evaluation = scoreSessionCall(
      baseReport({
        transcript: [
          {
            id: TURN_ID,
            role: "assistant",
            text: "Estoy consultando el sistema productivo de WOM ahora mismo",
            timestamp: "2026-09-06T12:00:20.000Z",
          },
        ],
      }),
    );
    expect(evaluation.dimensions.find((d) => d.id === "policy_compliance")?.verdict).toBe("unmet");
  });
});

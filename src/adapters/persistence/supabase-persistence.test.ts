import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_TOOL_INVOCATION_SOURCE } from "../../application/load-config.js";
import { SupabasePersistence } from "./supabase-persistence.js";

const hosted = process.env.SUPABASE_URL !== undefined && process.env.SUPABASE_SERVICE_ROLE_KEY !== undefined;

describe("SupabasePersistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should_skip_hosted_checks_when_credentials_are_absent", async () => {
    if (hosted) {
      const persistence = new SupabasePersistence(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
      await expect(persistence.ping()).resolves.toBeUndefined();
      return;
    }
    expect(process.env.SUPABASE_URL).toBeUndefined();
  });

  it("should_round_trip_invocation_source_on_getSessionReport", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const startedAt = "2026-09-06T12:00:00.000Z";
    const completedAt = "2026-09-06T12:00:01.000Z";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rest/v1/sessions?")) {
          return Response.json([
            {
              id: sessionId,
              agent_id: "wom-customer-service-agent",
              channel: "voice",
              external_channel_id: "vapi-call-1",
              trace_id: "trace-1",
              business_status: "active",
              media_status: "active",
              started_at: startedAt,
              ended_at: null,
              duration_ms: null,
              created_at: startedAt,
              updated_at: startedAt,
              evaluation: null,
            },
          ]);
        }
        if (url.includes("/rest/v1/conversation_turns?")) {
          return Response.json([]);
        }
        if (url.includes("/rest/v1/tool_calls?")) {
          return Response.json([
            {
              id: "tool-1",
              session_id: sessionId,
              interaction_id: null,
              tool_name: "wom.get_customer_usage",
              status: "succeeded",
              arguments: {},
              result: { dataRemainingGb: 18.4 },
              started_at: startedAt,
              completed_at: completedAt,
              duration_ms: 12,
              error_class: null,
              invocation_source: CHANNEL_TOOL_INVOCATION_SOURCE,
              idempotency_key: "idem-tool-1",
            },
          ]);
        }
        if (url.includes("/rest/v1/execution_events?")) {
          return Response.json([]);
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const persistence = new SupabasePersistence("https://example.supabase.co", "service-role-key");
    const report = await persistence.getSessionReport(sessionId);
    expect(report?.toolCalls).toHaveLength(1);
    expect(report?.toolCalls[0]?.invocationSource).toBe(CHANNEL_TOOL_INVOCATION_SOURCE);
  });
});

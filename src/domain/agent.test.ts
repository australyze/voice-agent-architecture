import { describe, expect, it } from "vitest";
import {
  AGENT_ERROR_CODES,
  adapterSafeAgentMessage,
  isAgentErrorCode,
} from "./agent.js";

describe("agent error contract", () => {
  it("should_include_required_agent_error_codes", () => {
    expect(AGENT_ERROR_CODES.INVALID_OUTPUT).toBe("invalid_output");
    expect(AGENT_ERROR_CODES.TOOL_DENIED).toBe("tool_denied");
    expect(AGENT_ERROR_CODES.TOOL_INVALID_ARGS).toBe("tool_invalid_args");
    expect(AGENT_ERROR_CODES.TOOL_FAILED).toBe("tool_failed");
    expect(AGENT_ERROR_CODES.TOOL_TIMEOUT).toBe("tool_timeout");
    expect(AGENT_ERROR_CODES.LLM_TIMEOUT).toBe("llm_timeout");
    expect(AGENT_ERROR_CODES.LLM_PROVIDER).toBe("llm_provider");
    expect(AGENT_ERROR_CODES.RETRIEVAL_FAILED).toBe("retrieval_failed");
    expect(AGENT_ERROR_CODES.SENSITIVE_OUTPUT).toBe("sensitive_output");

    for (const code of Object.values(AGENT_ERROR_CODES)) {
      expect(isAgentErrorCode(code)).toBe(true);
    }
  });

  it("should_omit_secrets_and_raw_model_payloads_from_adapter_facing_messages", () => {
    const raw = '{"type":"reply","replyText":"sk-supersecretmodel"}';
    for (const code of Object.values(AGENT_ERROR_CODES)) {
      const message = adapterSafeAgentMessage(code);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain(raw);
      expect(message).not.toContain("sk-");
      expect(message).not.toContain("stack");
      expect(message).not.toMatch(/postgresql:/i);
    }
  });
});

import { describe, expect, it } from "vitest";
import { QUERY_HASH_HEX_CHARS, hashQueryForLog, redactSecrets } from "./redact.js";

describe("redactSecrets", () => {
  it("should_redact_postgres_urls_bearer_tokens_sk_keys_and_api_key_assignments", () => {
    const input = [
      "url=postgresql://user:supersecret@localhost:5432/db",
      "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
      "key=sk-proj-abcdefghijklmnopqrstuvwx",
      "LLM_API_KEY=abc123supersecret",
    ].join(" ");

    const redacted = redactSecrets(input);

    expect(redacted).not.toContain("supersecret");
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(redacted).not.toContain("sk-proj-abcdefghijklmnopqrstuvwx");
    expect(redacted).not.toContain("abc123supersecret");
    expect(redacted).toContain("[redacted-database-url]");
    expect(redacted).toContain("[redacted-bearer-token]");
    expect(redacted).toContain("[redacted-secret-key]");
    expect(redacted).toContain("LLM_API_KEY=[redacted]");
  });
});

describe("hashQueryForLog", () => {
  it("should_return_a_bounded_hash_without_the_utterance", () => {
    const utterance = "What hours is the demo desk open on weekdays?";
    const hashed = hashQueryForLog(utterance);
    expect(hashed).toHaveLength(QUERY_HASH_HEX_CHARS);
    expect(hashed).toMatch(/^[0-9a-f]+$/);
    expect(hashed).not.toContain("hours");
    expect(hashed).not.toContain(utterance);
    expect(hashQueryForLog(utterance)).toBe(hashed);
    expect(hashQueryForLog("other")).not.toBe(hashed);
  });
});

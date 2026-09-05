import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redact.js";

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

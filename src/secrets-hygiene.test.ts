import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("secret hygiene", () => {
  it("should_ignore_env_files_in_git", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    const lines = gitignore.split(/\r?\n/);
    expect(lines).toContain(".env");
    expect(lines).toContain(".env.*");
    expect(lines).toContain("!.env.example");
  });

  it("should_keep_env_example_free_of_real_cloud_credentials", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toContain("NODE_ENV=");
    expect(example).toContain("PORT=");
    expect(example).toContain("DATABASE_URL=postgresql://voice_agent:voice_agent@127.0.0.1:5433");
    expect(example).toContain("VOICE_INBOUND_SECRET=");
    expect(example).toContain("DEMO_ORCHESTRATE_SECRET=");
    expect(example).toContain("DEMO_PUBLIC_TOKEN=");
    expect(example).toContain("VOICE_PROVIDER_API_KEY=");
    expect(example).toContain("VOICE_PROVIDER_BASE_URL=");
    expect(example).toContain("VOICE_TIMEOUT_MS=2000");
    expect(example).toContain("VOICE_DEFAULT_LOCALE=es");
    expect(example).toContain("VOICE_INBOUND_MAX_SKEW_MS=60000");
    expect(example).toContain("VOICE_INBOUND_RATE_LIMIT=30");
    expect(example).toContain("VOICE_INBOUND_RATE_WINDOW_MS=60000");
    expect(example).toContain("VOICE_SESSION_OWNER=runtime-demo");
    expect(example).toContain("LLM_BASE_URL=");
    expect(example).toContain("LLM_API_KEY=");
    expect(example).toContain("LLM_MODEL_ID=fake");
    expect(example).toContain("LLM_TIMEOUT_MS=1500");
    expect(example).toContain("SUPABASE_URL=");
    expect(example).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(example).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(example).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(example).not.toMatch(/hf_[A-Za-z0-9]{10,}/);
  });
});

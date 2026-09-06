import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(directory: string, predicate: (name: string) => boolean): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath, predicate));
      continue;
    }
    if (predicate(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("demo web isolation", () => {
  it("should_keep_runtime_core_free_of_react_and_vapi_web_sdk", () => {
    const files = [
      ...walk(join("src", "domain"), (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")),
      ...walk(join("src", "application"), (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from ["']@vapi-ai\/web["']/);
      expect(source, file).not.toMatch(/from ["']react["']/);
    }
  });

  it("should_keep_presentation_files_free_of_vapi_sdk", () => {
    const files = walk(join("web", "src"), (name) => /\.(ts|tsx)$/.test(name)).filter(
      (file) => !file.includes(`${join("lib", "voice")}`) && !file.includes(`${join("test")}`),
    );
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@vapi-ai\/web/);
    }
  });

  it("should_keep_inbound_as_the_only_voice_server_ingress", () => {
    const server = readFileSync(join("src", "adapters", "http", "create-server.ts"), "utf8");
    const inboundMatches = server.match(/\/adapters\/voice\/inbound/g) ?? [];
    expect(inboundMatches.length).toBeGreaterThan(0);
    expect(server).not.toMatch(/\/adapters\/voice\/web/);
    expect(server).not.toMatch(/frontend webhook/i);
    const openapi = readFileSync(join("openapi", "health.yaml"), "utf8");
    expect(openapi).toContain("/adapters/voice/inbound");
    expect(openapi).not.toContain("/webhooks/vapi-frontend");
  });

  it("should_keep_web_sources_free_of_browser_storage_apis", () => {
    const files = walk(join("web", "src"), (name) => /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\blocalStorage\b/);
      expect(source, file).not.toMatch(/\bsessionStorage\b/);
    }
  });

  it("should_keep_web_free_of_supabase_and_service_role_credentials", () => {
    const envExample = readFileSync(join("web", ".env.example"), "utf8");
    expect(envExample).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(envExample).not.toMatch(/SERVICE_ROLE/);
    const packageJson = readFileSync(join("web", "package.json"), "utf8");
    expect(packageJson).not.toMatch(/@supabase/);
    const files = walk(join("web", "src"), (name) => /\.(ts|tsx)$/.test(name));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@supabase/);
      expect(source, file).not.toMatch(/SERVICE_ROLE/);
    }
  });

  it("should_keep_web_free_of_wom_tool_executors_and_prompts", () => {
    const files = walk(join("web", "src"), (name) => /\.(ts|tsx)$/.test(name));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/canned-wom-directory/);
      expect(source, file).not.toMatch(/register-wom-tools/);
      expect(source, file).not.toMatch(/prompts\/wom-customer-service-agent/);
      expect(source, file).not.toMatch(/handleAgentTurn/);
    }
  });
});

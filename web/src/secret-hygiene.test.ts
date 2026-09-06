import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = join(import.meta.dirname, "..");

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === "dist") {
      continue;
    }
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (/\.(ts|tsx|md|example|json)$/.test(entry) || entry === ".env.example") {
      files.push(fullPath);
    }
  }
  return files;
}

describe("frontend secret hygiene", () => {
  it("should_document_only_public_client_env_vars", () => {
    const example = readFileSync(join(WEB_ROOT, ".env.example"), "utf8");
    expect(example).toContain("VITE_VAPI_PUBLIC_KEY=");
    expect(example).toContain("VITE_VAPI_ASSISTANT_ID=");
    expect(example).toContain("VITE_PUBLIC_API_BASE_URL=");
    expect(example).not.toContain("VOICE_INBOUND_SECRET");
    expect(example).not.toContain("VOICE_PROVIDER_API_KEY");
    expect(example).not.toContain("DATABASE_URL");
    expect(example).not.toMatch(/sk-[A-Za-z0-9]/);
  });

  it("should_not_import_vapi_sdk_from_presentation_components", () => {
    const files = walk(join(WEB_ROOT, "src")).filter(
      (file) => file.includes(`${join("components")}`) || file.includes(`${join("pages")}`),
    );
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/@vapi-ai\/web/);
    }
  });

  it("should_not_use_web_storage_in_frontend_sources", () => {
    const files = walk(join(WEB_ROOT, "src")).filter((file) => !/\.test\.(ts|tsx)$/.test(file));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\blocalStorage\b/);
      expect(source, file).not.toMatch(/\bsessionStorage\b/);
    }
  });

  it("should_not_ship_server_secrets_in_frontend_sources", () => {
    const files = walk(join(WEB_ROOT, "src"));
    files.push(join(WEB_ROOT, ".env.example"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/VOICE_INBOUND_SECRET\s*=\s*\S+/);
      expect(source, file).not.toMatch(/DATABASE_URL\s*=\s*postgresql:/);
      expect(source, file).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    }
  });
});

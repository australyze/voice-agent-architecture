import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL("./", import.meta.url));

const FORBIDDEN_CORE_IMPORTS = [
  /\bfrom\s+["']pg["']/,
  /\bfrom\s+["']fastify["']/,
  /\bfrom\s+["']dotenv["']/,
  /openai/i,
  /@anthropic/i,
  /@vapi-ai/i,
  /\bvapi\b/i,
  /langfuse/i,
  /langchain/i,
  /langgraph/i,
  /@prisma\//i,
  /drizzle-orm/i,
  /typeorm/i,
  /@modelcontextprotocol/i,
  /\bfrom\s+["'][^"']*mcp[^"']*["']/i,
  /pinecone/i,
  /weaviate/i,
  /chromadb/i,
  /qdrant/i,
  /voyageai/i,
];

function walk(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (fullPath.endsWith(".ts") && !fullPath.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("hexagonal boundaries", () => {
  it("should_keep_domain_and_application_free_of_vendor_and_driver_imports", () => {
    const coreFiles = [...walk(join(SRC_ROOT, "domain")), ...walk(join(SRC_ROOT, "application"))];
    const violations: string[] = [];

    for (const file of coreFiles) {
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_CORE_IMPORTS) {
        if (pattern.test(source)) {
          violations.push(`${relative(SRC_ROOT, file)} matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

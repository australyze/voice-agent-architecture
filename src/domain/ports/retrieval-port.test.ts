import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RetrievalHit, RetrievalPort } from "./retrieval-port.js";

describe("RetrievalPort contract", () => {
  it("should_require_ingest_and_retrieve_with_attributed_hits", () => {
    const source = readFileSync(fileURLToPath(new URL("./retrieval-port.ts", import.meta.url)), "utf8");
    expect(source).toContain("ingest(request: IngestRequest)");
    expect(source).toContain("retrieve(request: RetrievalRequest)");
    expect(source).not.toMatch(/retrieve\(request: \{\s*query: string\s*\}\)/);
    expect(source).not.toContain("hits: RetrievalHit[] } & { query?: never");

    const hit: RetrievalHit = {
      chunkId: "c1",
      documentId: "d1",
      locator: "chars:0-512",
      text: "hours",
      score: 0.9,
      rank: 1,
    };
    expect(hit).toMatchObject({
      chunkId: "c1",
      documentId: "d1",
      locator: "chars:0-512",
      text: "hours",
      score: 0.9,
      rank: 1,
    });

    const port: RetrievalPort = {
      async ingest() {
        return { documentId: "d1", corpusVersion: "v1" };
      },
      async retrieve() {
        return { corpusVersion: "v1", retrieverVersion: "cosine-v1", hits: [hit] };
      },
    };
    expect(typeof port.ingest).toBe("function");
    expect(typeof port.retrieve).toBe("function");
  });
});

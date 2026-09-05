import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("compose persistence bind", () => {
  it("should_publish_postgres_on_loopback_only", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");

    expect(compose).toMatch(/127\.0\.0\.1:5433:5432/);
    expect(compose).not.toMatch(/^\s*-\s*"5433:5432"/m);
    expect(compose).not.toMatch(/0\.0\.0\.0:5433:5432/);
  });
});

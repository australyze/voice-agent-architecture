import { describe, expect, it } from "vitest";
import { SupabasePersistence } from "./supabase-persistence.js";

const hosted = process.env.SUPABASE_URL !== undefined && process.env.SUPABASE_SERVICE_ROLE_KEY !== undefined;

describe("SupabasePersistence", () => {
  it("should_skip_hosted_checks_when_credentials_are_absent", async () => {
    if (hosted) {
      const persistence = new SupabasePersistence(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
      await expect(persistence.ping()).resolves.toBeUndefined();
      return;
    }
    expect(process.env.SUPABASE_URL).toBeUndefined();
  });
});

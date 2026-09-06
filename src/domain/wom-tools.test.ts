import { describe, expect, it } from "vitest";
import { DEMO_ECHO_TOKEN, DEMO_NORMALIZE_TEXT, RUNTIME_DEMO_ALLOWLIST } from "./demo-tool.js";
import {
  WOM_CHECK_SERVICE_STATUS,
  WOM_CUSTOMER_SERVICE_ALLOWLIST,
  WOM_GET_BILL_STATUS,
  WOM_GET_CUSTOMER_USAGE,
} from "./wom-tools.js";

describe("wom customer-service tool policy", () => {
  it("should_allowlist_exactly_three_wom_tools", () => {
    expect([...WOM_CUSTOMER_SERVICE_ALLOWLIST]).toEqual([
      WOM_GET_CUSTOMER_USAGE,
      WOM_GET_BILL_STATUS,
      WOM_CHECK_SERVICE_STATUS,
    ]);
    expect(WOM_CUSTOMER_SERVICE_ALLOWLIST).not.toContain(DEMO_NORMALIZE_TEXT);
    expect(WOM_CUSTOMER_SERVICE_ALLOWLIST).not.toContain(DEMO_ECHO_TOKEN);
  });

  it("should_keep_runtime_demo_allowlist_exclusive_of_wom_tools", () => {
    expect([...RUNTIME_DEMO_ALLOWLIST]).toEqual([DEMO_NORMALIZE_TEXT]);
    expect(RUNTIME_DEMO_ALLOWLIST).not.toContain(WOM_GET_CUSTOMER_USAGE);
    expect(RUNTIME_DEMO_ALLOWLIST).not.toContain(WOM_GET_BILL_STATUS);
    expect(RUNTIME_DEMO_ALLOWLIST).not.toContain(WOM_CHECK_SERVICE_STATUS);
  });
});

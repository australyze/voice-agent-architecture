import { DEMO_TOOL_TIMEOUT_MS } from "./demo-tool.js";

export const WOM_CUSTOMER_SERVICE_AGENT_ID = "wom-customer-service-agent";

export const WOM_GET_CUSTOMER_USAGE = "wom.get_customer_usage";
export const WOM_GET_BILL_STATUS = "wom.get_bill_status";
export const WOM_CHECK_SERVICE_STATUS = "wom.check_service_status";

export const WOM_CUSTOMER_SERVICE_ALLOWLIST = [
  WOM_GET_CUSTOMER_USAGE,
  WOM_GET_BILL_STATUS,
  WOM_CHECK_SERVICE_STATUS,
] as const;

export const WOM_TOOL_TIMEOUT_MS = DEMO_TOOL_TIMEOUT_MS;

/** Reserved all-zero test MSISDN. Not a real subscriber and not an identity input. */
export const CANNED_WOM_TEST_MSISDN = "56900000000";

export const CANNED_WOM_USAGE = {
  phoneNumber: CANNED_WOM_TEST_MSISDN,
  dataPlanGb: 40,
  dataUsedGb: 21.6,
  dataRemainingGb: 18.4,
  billingCycleEnds: "2026-09-20",
} as const;

export const CANNED_WOM_BILL = {
  amount: 24990,
  currency: "CLP",
  dueDate: "2026-09-15",
  status: "pending",
} as const;

export const CANNED_WOM_SERVICE = {
  service: "mobile-data",
  status: "operational",
  incident: null,
} as const;

export type WomUsage = {
  phoneNumber: string;
  dataPlanGb: number;
  dataUsedGb: number;
  dataRemainingGb: number;
  billingCycleEnds: string;
};

export type WomBill = {
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
};

export type WomServiceStatus = {
  service: string;
  status: string;
  incident: string | null;
};

export type WomDirectory = {
  getCustomerUsage(): WomUsage;
  getBillStatus(): WomBill;
  checkServiceStatus(): WomServiceStatus;
};

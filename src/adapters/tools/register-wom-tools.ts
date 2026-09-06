import { z } from "zod";
import type { ToolRegistry } from "../../application/tool-registry.js";
import { MAX_TOOL_STRING_CHARS } from "../../domain/demo-tool.js";
import {
  WOM_CHECK_SERVICE_STATUS,
  WOM_GET_BILL_STATUS,
  WOM_GET_CUSTOMER_USAGE,
  WOM_TOOL_TIMEOUT_MS,
  type WomDirectory,
} from "../../domain/wom-tools.js";
import { cannedWomDirectory } from "../wom/canned-wom-directory.js";

const emptyInput = z.object({}).strict();
const usageOutput = z
  .object({
    phoneNumber: z.string().max(MAX_TOOL_STRING_CHARS),
    dataPlanGb: z.number(),
    dataUsedGb: z.number(),
    dataRemainingGb: z.number(),
    billingCycleEnds: z.string().max(MAX_TOOL_STRING_CHARS),
  })
  .strict();
const billOutput = z
  .object({
    amount: z.number(),
    currency: z.string().max(MAX_TOOL_STRING_CHARS),
    dueDate: z.string().max(MAX_TOOL_STRING_CHARS),
    status: z.string().max(MAX_TOOL_STRING_CHARS),
  })
  .strict();
const serviceOutput = z
  .object({
    service: z.string().max(MAX_TOOL_STRING_CHARS),
    status: z.string().max(MAX_TOOL_STRING_CHARS),
    incident: z.string().max(MAX_TOOL_STRING_CHARS).nullable(),
  })
  .strict();

export function registerWomTools(registry: ToolRegistry, directory: WomDirectory = cannedWomDirectory): void {
  registry.register({
    name: WOM_GET_CUSTOMER_USAGE,
    riskClass: "read",
    source: "native",
    status: "active",
    timeoutMs: WOM_TOOL_TIMEOUT_MS,
    inputSchema: emptyInput,
    outputSchema: usageOutput,
    execute: () => directory.getCustomerUsage(),
  });
  registry.register({
    name: WOM_GET_BILL_STATUS,
    riskClass: "read",
    source: "native",
    status: "active",
    timeoutMs: WOM_TOOL_TIMEOUT_MS,
    inputSchema: emptyInput,
    outputSchema: billOutput,
    execute: () => directory.getBillStatus(),
  });
  registry.register({
    name: WOM_CHECK_SERVICE_STATUS,
    riskClass: "read",
    source: "native",
    status: "active",
    timeoutMs: WOM_TOOL_TIMEOUT_MS,
    inputSchema: emptyInput,
    outputSchema: serviceOutput,
    execute: () => directory.checkServiceStatus(),
  });
}

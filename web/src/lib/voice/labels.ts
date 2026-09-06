const TOOL_LABELS: Record<string, string> = {
  get_customer_usage: "Consultando consumo",
  "wom.get_customer_usage": "Consultando consumo",
  get_bill_status: "Consultando estado de cuenta",
  "wom.get_bill_status": "Consultando estado de cuenta",
  check_service_status: "Consultando estado del servicio",
  "wom.check_service_status": "Consultando estado del servicio",
};

export function labelForToolName(toolName: string): string | null {
  const key = toolName.trim();
  return TOOL_LABELS[key] ?? TOOL_LABELS[key.replace(/^wom\./, "")] ?? null;
}

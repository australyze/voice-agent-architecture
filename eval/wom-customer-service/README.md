# Eval suite: wom-customer-service

- **Suite name:** `wom-customer-service`
- **Dataset version:** `2026-09-06.2`
- **Prompt version:** `wom-customer-service-agent@1`
- **Model identity:** `fake`
- **Paid model / live telephony / MCP:** not required

Pass criteria: decision outcome, tool name, error codes, locale `es`, `toolBodyRan` when set, and that a failed billing tool does not expose canned amount/dueDate. Do not assert live-model wording.

New in `2026-09-06.2`: product-catalog executor, honored `toolBodyRan`, and `wom-document-injection-does-not-expand-allowlist`.

```bash
npx vitest run eval/wom-customer-service/wom-customer-service.eval.test.ts
```

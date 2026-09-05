# Verification Report - Contract Tests

- Date: 2026-09-05
- Change: ai-agent-runtime-foundation
- Agent: evaluation-engineer
- Change types: code, api
- Session: `/verify` (`verify-ai-implementation`)
- Specs: `openapi/health.yaml` (project fragment); error envelope aligned with `lidr-specboot/docs/api-spec.yml` `ErrorResponse`

## Commands executed

- `curl.exe -s -D - http://127.0.0.1:3000/health/live`
- `curl.exe -s -D - http://127.0.0.1:3000/health/ready`
- Start process on `127.0.0.1:3010` with `DATABASE_URL` pointing at `127.0.0.1:1`
- `curl.exe -s -D - --max-time 10 http://127.0.0.1:3010/health/live`
- `curl.exe -s -D - --max-time 15 http://127.0.0.1:3010/health/ready`
- `npm test` (`src/adapters/http/health.test.ts`, `src/openapi-health.test.ts`)

## Results

### GET /health/live (persistence up, :3000)

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{"status":"alive"}
```

### GET /health/ready (persistence up, :3000)

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{"status":"ready"}
```

### GET /health/live (persistence down, :3010)

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{"status":"alive"}
```

### GET /health/ready (persistence down, :3010)

```http
HTTP/1.1 503 Service Unavailable
content-type: application/json; charset=utf-8

{"success":false,"error":{"message":"Persistence is unavailable","code":"PERSISTENCE_UNAVAILABLE","details":null}}
```

Unauthenticated probes accepted (no `Authorization` header). Envelope has `success: false`, `error.message`, `error.code`; no connection string, userinfo, or stack.

## Database state

- No HTTP mutations. Restored: Yes

## Outcome

- Status: PASS
- Blocking issues: none

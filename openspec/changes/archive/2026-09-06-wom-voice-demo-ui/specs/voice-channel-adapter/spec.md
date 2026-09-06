## ADDED Requirements

### Requirement: Browser media client is not inbound ingress

The voice adapter family MAY include a browser media client that starts and ends a live web call. That client MUST talk to the configured voice-provider media infrastructure only. It MUST NOT implement a second Server URL, webhook, or inbound HTTP contract. Server-side conversation events MUST continue to use the existing authenticated inbound interface. The browser MUST NOT receive provider Server URL webhooks directly.

#### Scenario: Existing inbound remains the only server ingress

- **WHEN** a reviewer inspects shipped HTTP routes after this change
- **THEN** voice server events still enter only through the documented inbound voice interface and no parallel frontend webhook exists

#### Scenario: Browser does not handle Server URL posts

- **WHEN** the demonstration web application is running
- **THEN** it does not expose an HTTP endpoint that accepts provider Server URL events

### Requirement: Browser media client contains no product agent logic

The browser media client MUST start and stop call media and surface provider events to the demonstration UI. It MUST NOT own prompts, tool authorization, mock customer-service data, or reply invention. Customer-service tools whose results MUST return to the model MUST remain server-side. The client MUST NOT register those tools as client-executed tools.

#### Scenario: Start does not execute WOM tools in the browser

- **WHEN** the user starts a demonstration call
- **THEN** the browser media client does not execute usage, bill, or service-status tool bodies

#### Scenario: Inbound mapper stays policy-free

- **WHEN** a reviewer inspects the existing inbound mapping module
- **THEN** it still does not import WOM prompt artifacts, `wom.*` tool executors, or mock WOM data

---
id: D1
title: Admin auth seam for developer surfaces
type: task
hitl: false
status: closed
issue: #2
assignee:
blocked_by: []
blocks: [D3]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Developer-only gating: ADMIN_KEY env var protecting /dev page + /api/dev/* routes, reusing requireWorkspace patterns. Never exposed to end users; no UI hint of existence when unset.

## Resolution

Resolved 2026-08-22 by ORCH-direct execution.

- requireAdmin beside requireWorkspace in src/lib/api.ts: ADMIN_HEADER=x-admin-key; fail-closed identical 401 for unset-env / missing / wrong key (byte-equal denials asserted); timing-safe SHA-256 digest compare; stricter rate bucket (30/min) keyed by credential digest.
- Tests tests/integration/admin-auth.test.ts (5): unset-vs-wrong byte equality, accept-correct, missing-header, malformed-but-constructible values, rate-limit trip. Suite 57/57 green; lint/typecheck/build green.
- .env.example + docs/deployment.md document ADMIN_KEY (leave unset to disable dev routes).
- No /api/dev routes yet — that is issue #15 (D3); this ticket delivered the seam only.

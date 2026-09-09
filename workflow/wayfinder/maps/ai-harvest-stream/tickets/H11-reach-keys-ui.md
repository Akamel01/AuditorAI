---
id: H11
title: Reach-keys UI + runtime secrets API (set Exa/OpenCode keys from Mission Control)
type: task
hitl: false
status: closed
assignee: harvest-verifier
blocked_by: [H7]
blocks: []
created: 2026-09-09
resolved: 2026-09-09
---

## Question

How does the operator turn on live reach from the UI — `AGENT_REACH_ENABLED` + `EXA_API_KEY` (+ `OPENCODE_API_KEY`) — without redeploying env, per Apple-design restraint?

## Context

H7 provider self-gates async (env/Keychain → `[]` when off). Server env is deployment-time on Vercel, so typed-in keys need a server-side runtime override store (DataStore `discovery:runtime-secrets`, KV on Vercel). Owner asked 2026-09-09 for input elements in the AI Harvest tab; Apple-design skill governs the design (purpose, agency, responsibility, familiarity, simplicity, craft, reduced-motion — no new animations, pressable `active:scale`, presence-only status, password inputs with show/hide, reversible Clear).

## Agent Brief

**Category:** enhancement
**Summary:** `src/discovery/runtime-secrets.ts` (get/set/clear/presence on DataStore) + `GET/POST/DELETE /api/dev/harvest-stream/secrets` (admin-gated, presence booleans only, never values) + `ai-harvest-keys.tsx` panel in AI Harvest tab + provider falls back to runtime keys + `tickStream` includes `agent-reach-search`.

**Key interfaces:**
- `DataStore.put/get/del` (`lib/persistence/store.ts:16-28`), `setDataStoreForTests` for hermetic tests
- `requireAdmin` (`lib/api.ts:30`), `adminApi` + `json` (`lib/client.ts:50-82`)
- `Panel/Eyebrow/InlineNotice` (same language as admin-key gate `page.tsx:232-266`), `tickStream` provider filter (`harvest-stream.ts:134-136`)

**Acceptance:**
- [ ] `GET secrets` → `{enabled,hasExaKey,hasOpencodeKey,live}` booleans only; `POST {enabled?,exaKey?,opencodeKey?}` sets (empty clears, trim, cap); `DELETE` clears all; all `requireAdmin`, values never logged/echoed
- [ ] Panel shows status first (`Reach live` / off-reason), enable toggle, 2 password inputs with show/hide, Save + Clear; `data-testid=reach-keys-*`; Save clears inputs on success; Clear falls back to env (forgiving, no confirm)
- [ ] Provider resolves env/Keychain first, runtime store second; `tickStream` includes `agent-reach-search` (self-gates → `[]` when off)
- [ ] Tests: `runtime-secrets` set/get/clear/presence + provider runtime-fallback via `setDataStoreForTests(MemoryStore)`; `lint/typecheck/mock` green
- [ ] Apple-design: no new keyframes, `active:scale` press feedback, inline `InlineNotice` errors, `prefers-reduced-motion` untouched (inherits)

**Out of scope:** Continuous loop (H8), Start-continuous (H9), monitor e2e (H10). Keep `ai-search` as-is.

## Resolution

Closed 2026-09-09 — keys settable from the AI Harvest tab, no redeploy.

- `src/discovery/runtime-secrets.ts:1` — DataStore-backed overrides (`discovery:runtime-secrets`, KV on Vercel): get/set/clear/presence, patch semantics (undefined=keep, `""`=clear, trim+cap 500), values never exposed.
- `src/app/api/dev/harvest-stream/secrets/route.ts:1` — admin-gated `GET` (presence booleans only) / `POST` (validated set) / `DELETE` (clear → env fallback). Static route wins over `[id]`.
- `src/app/dev/mission-control/_components/ai-harvest-keys.tsx:1` — Reach-keys panel atop AI Harvest tab: status first (`Reach live`/`Reach off` + missing piece), enable toggle, 2 password inputs with show/hide, Save + Clear, `InlineNotice` errors, transient saved note, `data-testid=reach-keys-*`. Same Panel/Eyebrow/input/button language as admin gate; `active:scale` press only, no new motion.
- Provider falls back per-field env→runtime (`agent-reach-search.ts:resolveReach`); `tickStream` includes `agent-reach-search` (`harvest-stream.ts`, self-gates → `[]` when off); client helpers in `lib/client.ts:136-144`.
- Tests: `tests/domain/runtime-secrets.test.ts:1` 4/4 (roundtrip/clear/presence + provider runtime-fallback via `setDataStoreForTests`); full file 12/12 with H7 + stream suites.
- Verified: `lint 0`, `typecheck 0`, `build ok`, `--mock` 3-pass, `vault-sync --check` ok.
- Apple-design accounting: purpose (one job), agency (toggle/show/hide, forgiving Clear), responsibility (password fields, presence-only, admin gate, server-side KV note), familiarity (gate/control styling), simplicity (status→inputs→Clear), craft (no new keyframes, transform/opacity only), reduced-motion inherits.

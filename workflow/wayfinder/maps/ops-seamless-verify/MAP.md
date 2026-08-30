---
map: ops-seamless-verify
label: wayfinder:map
created: 2026-08-26
---

## Destination

Mission Control is usable from a browser with no manual header tooling, and the discovery operation loop is proven healthy across all three planes (local daemon, Vercel production, GitHub Action). Concretely: `GET /api/dev/health` returns 200 without a manual `x-admin-key` injection, Mission Control renders with gap-aware queues, and one full operation-loop evidence bundle (doctor live + coverage gaps + daemon + action commits) is on disk.

If the destination's two clauses are already deployed, this map collapses to a one-session verification: collect the evidence bundle and close.

## Notes

- Skills every session should consult: `grilling` + `domain-modeling` for any term or boundary decision; `codebase-design` vocabulary (Module/Interface/Seam) for structural touches.
- Standing preferences inherited from mvp/v2/v3 maps: deterministic-first; AI bounded to candidates; state reconstructed from repo (`state/*.json`, `policies/odd.json`, ledger), never chat history.
- Execution constraint for this map: no new secrets printed; ADMIN_KEY retrieved via `security find-generic-password -a "$USER" -s auditorai/admin-key -w`; DISCOVERY keys via `auditorai/discovery-brave` etc.; `git add <paths>` explicit per `AGENTS.md`.
- Tracker: local-markdown (`workflow/wayfinder/TRACKER.md`); GitHub Issues mirror not required for this short effort unless owner asks.

## Decisions so far

- [Admin-key prompt + Vercel ADMIN_KEY (7ff9188)](https://github.com/Akamel01/AuditorAI/commit/7ff9188): `src/app/dev/mission-control/page.tsx` shows a Keychain/env prompt on 401 and retries via `localStorage auditorai.admin_key`; Vercel `ADMIN_KEY` set for Production/Preview/Development — Mission Control shells at `/dev/mission-control` (200, chunk `page-7e6e2d92...`) before this map.
- [Brave disabled on Vercel → enabled (32aac87 → 289beec)](https://github.com/Akamel01/AuditorAI/commit/289beec): `DISCOVERY_BRAVE_API_KEY` (and CSE pair) mirrored from Keychain to Vercel env; redeploy now `GET /api/dev/health` reports `brave-search enabled:true ping ok 1 hit 372ms`; label clarified to `Keychain · env` / `disabled (no Keychain/env)`.
- [Run Live Harvest no progress — issue #24](https://github.com/Akamel01/AuditorAI/issues/24): `provider-health.tsx:60` ephemeral `useState`, `handleRun:94` sync `POST /api/dev/discovery/run` blocking `run/route.ts:134`, no jobId/polling, `page.tsx:204` no `onRun` wiring — button resets on refresh/tab switch. Owner requires both phases now (not lite only): Phase1 auto-reload + persisted flag, Phase2 KV job store + polling.
- [T1 verified + closed 2026-08-30](tickets/T1-seamless-admin-key.md): `vercel env ls` ADMIN_KEY Hidden Prod/Preview, `curl /api/dev/health` 200 `{providers:3, ledger:150, topology:drift:false}`, `page.tsx:177-212` prompt — evidence `ops-loop-evidence.json:t1`.
- [T2 blocked (infra work in progress) — implementation verified locally but production cross-instance KV/daemon proof pending; destination readiness unverified](tickets/T2-operation-loop-proof.md): this ticket asserts the need to reconcile the evidence; see T2-operation-loop-proof.md for status.

## Not yet specified

- Client-facing confidence view reusing `OddCoverageView` + `readiness-report.json` — belongs to a future map, not this one.
- Infra status: block/pending infra hiatus. Destination readiness claims previously present are now considered non-authoritative due to ongoing infra work. Upgrade path for infra-safe sequencing: use KV atomic increment / compare-and-swap (CAS) mechanisms when available and clearly document ceilings in code/comments.
- Fine-tuning promotion triggers and eval harness runs — separate effort; this map stops at operation-loop proof, not learning.

## Out of scope

- Paywall/licence circumvention or Tier-1 bulk acquisition without owner approval (Firewall `docs/adr/0007`).
- Changing eval gate thresholds or E5 trigger policy.
- Docker / containerization, Stage 3/4, GIS/CAD integrations (inherited from mvp map).

---
title: Vault refresh UI + grill sharpened R1-R19
type: journal
date: 2026-09-08
owner: agent
links: []
evidence_ids: []
---

# Vault refresh UI 2026-09-08

Grill-with-docs completed for ops-residual 19 tickets (R1 lease 120s global, R2 ledger hint+KEYS heal, R3 node:test, R4 immediate smoke, R5 cancelled idempotent, R6 latest-page, R7 tooltip, R8 harvestHealth holder/null, R9 doctor JSON, R10 KV-truth dedupe, R11 ceiling-only, R12 expanded curated + stages twin, R13 doctrine-parse 7d, R14 header, R15 auto-deploy, R18 build/lint, R19 local-markdown). ADRs 0014-0018 + CONTEXT terms Harvest Lease/Ledger Entry/Index/Dedupe Index/Harvest Health/Job Cancellation landed.

Mission Control now exposes Vault working memory live: `GET /api/dev/vault` (note_count, zones, determinism) + `POST /api/dev/vault/sync` (vault-import/export, admin-gated) and `VaultPanel` in overview + dedicated Vault segment with Refresh/Update vault buttons (x-admin-key, ephemeral on Vercel, commit via `vault-sync.mjs` for persistence).

- UI: `src/app/dev/mission-control/_components/vault-panel.tsx:1`
- API: `src/app/api/dev/vault/route.ts:1` `src/app/api/dev/vault/sync/route.ts:1`
- Client: `src/lib/client.ts:fetchVault/syncVault`
- Mission Control: `src/app/dev/mission-control/page.tsx:36` `SEGMENTS vault`

---
title: "proposal: Hold-note — fog item 3, blob-storage escape hatch (NOT FIRED)"
type: journal
date: 2026-08-23
owner: agent
---

Fog item 3 from MAP.md §Not yet specified, reviewed per handoff `handoff-d-fog-graduation.md`
decision table. Verdict: **condition NOT fired** — do not build.

## Checked condition

"KV limits actually bite inline data-URLs" (M1 margins: ≤500 KB/img, ≤12/project vs
Upstash 10 MiB request cap). First move per map: re-measure with
`scripts/measure-kv-limits.mjs`; design behind the existing Attachment shape.

## Evidence at review time (2026-08-23)

1. **Re-measurement is impossible locally**: the script exits(2) without
   `KV_REST_API_URL`/`KV_REST_API_TOKEN`. Neither exists in `.env.local`, `.env.example`
   (placeholders only), or the invocation environment. Per the handoff's own note, absent
   creds alone mean the condition cannot be verified → hold-note unless owner supplies env.
2. **Recorded measurements (M1, issue #6; `docs/research/kv-image-limits-findings.md`)**
   show limits do not bite within current policy margins:
   - Upstash REST request cap 10 MiB (6 MiB payload OK / 8 MiB rejected), sha256-intact.
   - ~0.7 s SET @ 500 KB; latency superlinear only past ~2 MiB — an order of magnitude
     above the 500 KB/image policy cap (~667 KB as base64 data-URL).
   - Vercel serverless body cap 4.5 MB — also above any single-attachment write.
   - Attachments are stored one record each (`Attachment`, `src/domain/types.ts:48`),
     so no aggregate write approaches the caps either.
3. Zero product changes since M1 raised image-count or size caps.

## Exact trigger to re-check

Any ONE of:
- Owner supplies KV env (`KV_REST_API_URL`/`KV_REST_API_TOKEN`, invocation-time only per
  `vault/gotchas/opencode-api-key-invocation.md` discipline) AND a fresh
  `node scripts/measure-kv-limits.mjs` run shows first-failure at or below policy-margin
  wire sizes (≤667 KB single write, or a realistic multi-attachment request near
  10 MiB / 4.5 MB).
- A product decision raises caps beyond measured headroom (e.g., >6 images per project,
  >1 MB per image, or batched writes).

If triggered: design the Vercel Blob escape hatch behind the existing `Attachment`
interface in `src/domain/types.ts` (the shape docs/decisions/log.md calls "AttachmentRef")
— storage becomes a seam swap in `src/lib/persistence.ts`, not a call-site change.

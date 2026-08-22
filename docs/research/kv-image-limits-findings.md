---
title: KV image-storage limits — M1 measurement report
date: 2026-08-22
agent: ORCH (direct execution after delegation incident)
status: complete
---

## Methodology

`scripts/measure-kv-limits.mjs`: binary-search SET payloads against production
Upstash REST (scratch namespace `probe:kvlimits:*`, sha256 round-trip integrity,
verified cleanup). Vercel function request-body cap from official limits docs.

## Raw results (2026-08-22)

| payload KB | wire KB (base64) | SET ms | GET ms | sha256 intact |
|---|---|---|---|---|
| 100 | 133 | 898 | 362 | true |
| 500 | 667 | 687 / median 726 | 541 | true |
| 1024 | 1365 | 519 | 865 | true |
| 2048 | 2731 | 1830 | 1113 | true |
| 4096 | 5461 | 4302 | 1843 | true |
| 6144 | 8192 | 4895 | 5645 | true |
| 8192 | — | **rejected** | — | — |

- Upstash REST hard cap: `ERR max request size exceeded. Limit: 10485760 bytes`
  (**10 MiB per request**, value+envelope). 6 MiB payload OK, 8 MiB rejected.
- Latency grows superlinearly past ~2 MiB; ≤1 MiB is comfortably interactive.

## Side-finding (production bug, fixed same day)

Upstash REST accepts **one flat command per request**. `src/lib/ratelimit.ts`
was sending pipeline-form bodies (`[["INCR",..],["EXPIRE",..]]`) which Upstash
rejects (`ERR unsupported arg type: "[" : json.Delim`) → `kvIncrement` failed
every time → **KV-mode rate limiting was silently disabled in production**
(fail-open). Fixed to two flat calls; tests still 57/57.

## Vercel function request-body cap

Serverless function request bodies are capped at **4.5 MB** (Vercel functions
limitations, https://vercel.com/docs/functions/limits — verified against live
docs 2026-08-22). This binds *before* the Upstash cap for any single upload
traversing an API route.

## Decision Inputs → caps

| Constraint | Value | Implies |
|---|---|---|
| Vercel body cap | 4.5 MB/request | single image ≪ this after client downscale |
| Upstash request cap | 10 MiB | inline data-URL storage viable |
| Interactive latency | ~0.7 s @ 500KB | keep images ≤500KB |

## Decision (carried to ticket #14 implementation)

Inline data-URLs in KV behind the existing `DataStore` seam:

- Client-side downscale/compress to **≤500 KB per image** before upload
- Formats: **PNG/JPEG/WebP only**, mime sniffed server-side (never trusted from headers)
- **EXIF stripped client-side** at capture/import time
- **≤12 attachments per project**
- Attachment record shape fixed as specified in issue #14's parent brief
  (`attachment_id, name, mime, bytes, sha256, data_url | storage_ref, source_url?, license?`)
- Escape hatch documented-not-built: Vercel Blob refs swap in behind the same
  record shape (`storage_ref` branch) if caps ever bite

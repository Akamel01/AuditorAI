---
id: M1
title: Image storage constraints + decision
type: research
hitl: false
status: closed
issue: #6
assignee:
blocked_by: []
blocks: [M2]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Establish facts then decide: Upstash REST value/request limits; client-side downscale/compress to data-URLs in KV vs Vercel Blob escape hatch; caps (~500KB/image, max N per project); EXIF stripping; accepted formats PNG/JPEG/WebP.

## Resolution

Resolved 2026-08-22 by ORCH-direct execution (delegation incident per issue #6 comment).

**Facts measured** ([docs/research/kv-image-limits-findings.md](../../../../../docs/research/kv-image-limits-findings.md), script: `scripts/measure-kv-limits.mjs`):
- Upstash REST request cap **10 MiB** (6 MiB payload OK / 8 MiB rejected), sha256-intact round-trips
- ~0.7s SET @ 500KB; superlinear latency past ~2 MiB
- Vercel serverless request-body cap **4.5 MB**

**Decision:** inline data-URLs in KV — ≤500 KB/image after client downscale, PNG/JPEG/WebP only (mime sniffed), EXIF stripped client-side, ≤12 attachments/project; Vercel Blob escape hatch documented-not-built behind the same AttachmentRef shape.

**Side-finding fixed:** Upstash REST rejects pipeline-form command bodies → production KV-mode rate limiting was silently disabled (`ratelimit.ts`); rewritten as flat commands, 57/57 tests green.

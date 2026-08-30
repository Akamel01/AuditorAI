---
id: R10
title: `state/dedupe-index.json` write authority (KV-truth vs file fallback)
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Agent Brief

**Category:** bug
**Summary:** `persistDedupeFromResult` always reads/writes `state/dedupe-index.json` even when Vercel KV is the source of truth, producing a file/KV fork under read-only FS.

**Current behavior:** The dedupe index file is the read source. On Vercel (read-only FS), the index still loads from Vercel's stale file snapshot or throws `EROFS` on write. The KV key remains untouched. This is a fork.

**Desired behavior:** Treat KV as the source of truth when KV env is available. Load the dedupe index from KV first, fall back to file seed only if KV returns `null`. Persist to KV first; the file mirror best-effort (warn and continue) is acceptable on read-only FS but must not silently fork.

**Key interfaces:**
- `src/discovery/dedupe-persist.ts`: existing `persistDedupeFromResult` and its helpers; add a KV-first load.
- Add a small `DISCOVERY_DEDUPE_INDEX_KEY` getter if not already present in `src/lib/persistence/keys.ts`.

**Acceptance criteria:**
- [ ] Under Vercel-style read-only FS, `persistDedupeFromResult` updates KV successfully and emits a single `dedupe: FS mirror skipped (ROFS)` log warning.
- [ ] Local dev still writes both file and KV as before (deterministic in tests).
- [ ] Tests cover both behaviours using a fake FS write that throws.

**Out of scope:**
- Removing the file mirror in local dev.


# Architecture Report — Harvest Pipeline Deepening (loop 4)

Date: 2026-09-14
Scope: `/Users/akamel/Documents/AuditorAI` — hot spots first per `git log --oneline`: `src/discovery/**` (harvest, pipeline, harvest-stream, ledger, jobs, dedupe-persist, health-aggregate, providers), `src/app/api/dev/**` (health, discovery run), `scripts/harvest-verify.mjs`, `scripts/tier1-archive.mjs`; then organic friction scan.
Status: design-only — no implementation. No git mutations. No `state/vault-notes.json` contact. No browser (headless) — HTML cards double as structured text below.
Inputs: `.autoforge/discovery/report.md` + `tracker-index.md` (loop 3: 0 open GitHub, 92 tickets closed or owner/trigger-gated, 8 gated tripwires v2 F1–F4 / v3 F1–F4 — NOT re-proposed); `CONTEXT.md` canonical glossary (Harvest Lease, Ledger Entry/Index, Dedupe Index, Harvest Health/Success/Degraded, Gap-Targeted/Aware Harvest — reused, not re-litigated); `docs/adr/` (checked for contradictions — none; see §5).
Skills: `improve-codebase-architecture` (process), `codebase-design` (vocabulary used EXACTLY: module, interface, depth, seam, adapter, leverage, locality; deletion test; one adapter = hypothetical, two = real).
Supersedes: worktree `.autoforge/architecture/report.md` @ 2026-09-10 (26-ticket frontier; uncommitted, not in git history — prior loop's content summarized in §1, not destroyed by reference). HEAD version (2026-09-02 vault report) untouched in history.
HTML: `/var/folders/c8/816q70zd5dvd48_49_npqj8w0000gn/T/architecture-review-20260914-010952.html` (OS temp, never repo).

## 1. Findings — boundaries as they exist

Prior loop closed the frontier: R1 lock, R2 ledger, R5 cancel, R6 paging, R10 dedupe-KV-first, R16 brave-refusal, R8 health-bridge all landed or in-flight. The worktree carries a parallel lane's uncommitted edits on exactly these seams (`health-aggregate.ts` bridge + `health/route.ts` rewire, `dedupe-persist.ts` KV-first, `harvest.ts` comment trim, `pipeline.ts` D02 refusal) — my candidates build ON them, never duplicate them (§4 lane notes).

What the hot-spot walk surfaced (all line-anchored):

- `executeJob` (`harvest.ts:101-277`) is a 177-line orchestrator: cancel check (:112-125), process lock (:126-134), KV lock (:136-149), per-node loop with cancel poll + logging (:156-196), ledger persist (:212-226), dedupe (:228-234), proof bundle (:236-251), `setJobDone` (:253-263), error map (:264-267). Every new post-run step bolts onto this one function (proof bundle just did).
- Run-slice persist (`harvest.ts:279-355`) allocates seq via file read + KV tail read (:302-311) and writes the file mirror (:336-344), while KV append/trim/orphan-prune lives in `ledger.ts:10-33,44-59`. One write path, two owners.
- `harvest()` (`harvest.ts:357-450`) and `tickStream` (`harvest-stream.ts:148-177`) derive the same `DiscoveryCtx` with already-diverged provider filters (`harvest.ts:384-389` honors DEPRECATED + `providerEnabled`; `harvest-stream.ts:151-154` special-cases agent-reach-search past `providerEnabled`).
- Dedupe claims happen 3×: `d08Quality` clones the index and drops it (`pipeline.ts:286`), stream re-claims (`harvest-stream.ts:220-233`, comment admits the drop), `executeJob` re-persists (`harvest.ts:227-234`).
- `d04Acquire` (`pipeline.ts:136-223`) bypasses the existing `provider.fetch` seam (`provider-types.ts:25`) with a bare `fetch` (:153), owns its own %PDF guard (:162-166), scans hits/quals linearly per match (:145-146, :194-198), carries a dead `seq` (`:218` `void seq`).
- Health route re-forks KV/file after the bridge read (`health/route.ts:138-150`); two shapes (`HarvestHealth` 4 fields vs `HarvestHealthBridge` 8) for one concept.
- `jobs.ts` triple-forks (explicit store / ambient KV / file) per function — load-bearing dev fallback, noted, no ticket (cosmetic consolidation only).
- `scripts/harvest-verify.mjs` (556 lines) mirrors UI polling via raw fetch — one poller per runtime (browser vs node); hypothetical seam, no ticket.

## 2. Candidate cards

### A1 · Ledger run-persist behind the ledger seam — Strong (TOP-3, do second)
- **Files:** `src/discovery/harvest.ts:279-355`, `src/discovery/ledger.ts:10-63`
- **Problem:** seq allocation + file-mirror write + KV append for one Run's slices split across two modules; `executeJob` sequences them (`:214-226`) with a VITEST guard and double try/catch. A seq bug hides in call order, not behind either interface — no locality. Deletion test passes (behavior earns keep) but the boundary is shallow: `harvest.ts` knows the ledger INDEX scheme implicitly (`:302-311`).
- **Solution:** move run-slice persist into the ledger module (`appendLedgerRun(slices, ranAtIso, store?) → LedgerEntry[]` owning seq + file mirror + KV append + trim); `harvest.ts` keeps zero seq/INDEX_KEY arithmetic. KV + file are two adapters of one seam — real seam.
- **Benefits:** locality (seq + twin-write + trim in one module); leverage (stream/cron ledger writers reuse); tests through the interface (concurrent-run seq uniqueness on MemoryStore).

### A2 · Single DiscoveryCtx builder for harvest + stream — Strong (do third)
- **Files:** `src/discovery/harvest.ts:357-450`, `src/discovery/harvest-stream.ts:148-177`
- **Problem:** two derivations of one context, already diverged in provider-filter policy; fixture `acquireDocs` stubbed twice (`harvest.ts:433` vs `harvest-stream.ts:168-176`). Next provider-flag change edits both.
- **Solution:** `buildDiscoveryCtx({live, cellKey}, deps?)` in `harvest.ts` (fewest files — stream already imports it); both callers use it; filter policy in one place. Two callers = two adapters = real seam.
- **Benefits:** locality (flag policy one place); leverage (third caller free); ctx unit tests (dry/live/unknown-cellKey throws, deprecated excluded) without spinning jobs.

### A3 · Pipeline returns claimed dedupe index; single claim site — Strong (DO FIRST)
- **Files:** `src/discovery/pipeline.ts:285-313`, `src/discovery/harvest-stream.ts:220-233`, `src/discovery/harvest.ts:227-234`
- **Problem:** fingerprint-scheme knowledge in 3 places; the pipeline's own per-run claims vanish (`structuredClone` at `:286` never returned), forcing orchestrators to redo them.
- **Solution:** `DiscoveryRunOutcome` carries `dedupeIndex` (d08's clone becomes the returned index); orchestrators persist via `dedupe-persist` only (keeps owning KV-first write); delete the stream re-claim loop.
- **Benefits:** locality (claim rule in d08 only); leverage (any orchestrator gets correct cross-tick dedupe free); through-interface test (pipeline twice with same docs → second marks dup, no orchestrator).

### A4 · d04Acquire via the provider.fetch seam — Worth exploring (grill first)
- **Files:** `src/discovery/pipeline.ts:136-223`, `src/discovery/providers/provider-types.ts:21-26`
- **Problem:** existing seam bypassed — live fallback calls global `fetch` (`:153`) with a private %PDF guard (`:162-166`); O(n²) hit lookups (`:145-146`, `:194-198`); dead `seq` (`:218`).
- **Solution:** resolve the originating provider per hit, call `provider.fetch`; grill decides the %PDF-guard home (fetch contract vs acquire module); index hits/quals once.
- **Benefits:** locality (fetch policy per adapter); leverage (new providers bring fetch + tests); d04 unit-testable with a fake provider, no network.

### A5 · Health fallback consolidation + shape freeze (follow-up) — Worth exploring (after bridge lane lands)
- **Files:** `src/app/api/dev/health/route.ts:134-150`, `src/discovery/health-aggregate.ts:79-134`
- **Problem:** the fallback the bridge was built to own is re-implemented by its caller (file-ledger re-read `:139-150`); two shapes (4 vs 8 fields) for one concept; consumers guess.
- **Solution:** after the in-flight bridge edit commits, move the file fallback INSIDE `bridgeHarvestHealth`, freeze `HarvestHealthBridge` as the single interface, thin the route to auth + delegate, pin shape with a test. Verify against HEAD at implementation; close as dup if the owning lane covered it.
- **Benefits:** locality (ledger-source policy in one module); leverage (UI/doctor/evidence readers pin one contract); route stays a shallow aggregator by design.

## 3. Speculative — recorded + skipped (no tickets, per protocol §16)

- Unified poll-spec for UI polling + `harvest-verify.mjs` monitor — one adapter per runtime; hypothetical seam until a third poller appears.
- Async secret-resolution seam (Keychain sync `keychain.ts:34-47` vs UI runtime keys `runtime-secrets.ts`) — real question, widens every `providerEnabled` caller; needs grill before any ticket.
- `proof-bundle.ts:22` dedupeDigest independence — mild; R4 evidence HITL-gated, revisit on trigger.
- Prior-loop Speculatives stand (opaque job cursor, ledger KV pipeline helper) — deferred, not re-proposed.

## 4. Collision notes for planner/worker (touches guards)

- `harvest-stream.ts` shared by A2 (:148-177) and A3 (:220-233) — disjoint regions; one worker or sequence A3→A2.
- `harvest.ts` shared by A1 (persist fn) and A2 (`harvest()` fn) — disjoint regions; sequence A1→A2 preferred (A1 shrinks the file first).
- `pipeline.ts` shared by A3 (d08) and A4 (d04) — disjoint nodes; parallel-safe with explicit touches lists.
- A5 touches the foreign bridge lane's files — MUST rebase/verify against HEAD at implementation; close-as-dup if covered.
- Workers: explicit `touches` allow-lists, never touch `state/vault-notes.json` or foreign files; no git mutations by architect (this report only).

## 5. ADR check — no contradictions

A1–A3 reuse the DataStore/MemoryStore seam (ADR-0001) without widening it; A4 routes through the documented provider seam (mirrors AiAdapter doctrine); A5 freezes rather than forks the health contract (R8 direction). Sample-corpus Firewall (ADR-0007), promotion (ADR-0006), ODD (ADR-0005), lifecycle (ADR-0004) untouched. No ADR reopen requested.

## Top recommendation

Do **A3 first**: smallest diff (one outcome field + loop deletion), removes a self-documented wart (`harvest-stream.ts:220-222`), and its through-interface test guards A1/A2's later refactors. Then A1 → A2 (serialize on shared files), grill A4's %PDF-guard home, schedule A5 after the bridge lane commits. Ticket drafts: `decisions.md` (5 drafts, all testable acceptance, zero dupes of the 92).

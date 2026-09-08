---
id: HV5
title: Define success for gap-targeted vs gap-aware harvests
type: grilling
hitl: true
status: closed
assignee: harvest-verifier
blocked_by: [HV1, HV2]
blocks: [HV6, HV7, HV8]
created: 2026-09-08
resolved: 2026-09-08
---

## Question

What counts as "harvesting worked" — and how does it differ between "Run this gap (Live)" (one cell) and "Run Live Harvest" (top N gaps), between live vs dry, and between success vs degraded vs skipped?

Grill (with domain-modeling) to lock:

- **Gap-targeted** (`cellKey` set): success = job `done`, `D01..D10` includes `D02-TARGETED` or equivalent, ledger gains ≥1 `package.assemblies` for that `cellKey`, coverage for that `cellKey` increments `have_total` or records a refusal with reason (still "proved"), dedupe not double-counting, health `lastRunAt` advances. Degraded = quota 429 but ledger still advances or is correctly refused (EV-R3). Skipped/busy = `harvest executeJob busy` with no ledger mutation.

- **Gap-aware** (`cellKey null`): success = job `done`, `coverage.gaps_ranked` recomputed, queue ticker reflects new top 3, ledger may gain 0..N packages depending on gaps, coverage target_total unchanged.

- **Dry vs live**: dry must not call providers (seed-portals only) and must not allocate quota; live may call brave-search and is quota-gated.

Record the decision in `docs/research/harvest-success-criteria.md` with a pass/fail table the HV6/HV7 monitors can assert against, plus what CI should gate on (see HV8). No code, just the decision — the next tickets execute against it.


## Resolution

Grilled HITL (grill-with-docs + domain-modeling) locked oracle in `docs/research/harvest-success-criteria.md:1` and canonical terms in `CONTEXT.md:Gap-Targeted Harvest/Gap-Aware Harvest/Harvest Success/Degraded/Skipped/Harvest Dry vs Live`.

Decisions:
- Gap-targeted requires exact `cellKey` ledger entry (other cell = Degraded) — seed fallback for another cell not success.
- `have_total`↑ **or** refusal with reason both prove; silent 0 = fail.
- `dedupe delta == packages` strict (no double).
- `health.lastRunAt==ranAtIso` required for both, `health_degraded` allowed true (Dry never degraded).
- Gap-aware `0..N` ledger with `coverage.gaps_ranked` recomputed (`generated==ranAtIso`) + `queue[0..2]` match is success.
- Dry = seed-portals only, Live may 402 → Degraded not fail.
- Busy = `POST 202` then job `error` `harvest lock held`, ledger 0, surfaced via gapRunError/runError — distinct Skipped.
- CI dry mock MemoryStore → 1 pkg `usa:PRELIMINARY_DESIGN` deterministic.

Human locked all 8 answers as Recommended options. Evidence: HV6 degraded (HV6-usa-DETAILED_DESIGN) and HV7 pass already captured; will be re-asserted against frozen table in HV6/HV7 hardened reruns.

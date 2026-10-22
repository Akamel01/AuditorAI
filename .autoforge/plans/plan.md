# Plan — Akamel01/AuditorAI#60: Harvest round 2

Source of truth: `.autoforge/architecture/report.md` (module decomposition) +
`.autoforge/requirements/grilling.md` (R1–R47). Executable form:
`.autoforge/execution/work-order.json`.

## Tracker coverage

`.autoforge/discovery/tracker-index.md` lists 2 frontier tickets:

| Ticket | Role in this plan | Module |
|---|---|---|
| `GH:Akamel01/AuditorAI#60` | **this work** | M1–M5 |
| `GH:Akamel01/AuditorAI#41` | parent map, context only — no code | — |

`GH:Akamel01/AuditorAI#40` is closed (PR #58) — predecessor, read-only input.
The other 8 open issues are infra/auth/data/observability and out of scope.

## DAG

```
M2 (source list) ──► M3 (harvester) ──► M4 (report+guard) ──► M5 (live round + artefacts)
M1 (discovery) ─────────────────────────────────────────────► M5
```

`M1 ∥ M2` (disjoint `touches`). `M3 → M4 → M5` sequential.

## Modules

### M1 — Round-2 discovery (the wide search)

- **touches**: `scripts/harvest-round2-discover.ts` (new)
- **blocked_by**: none
- **Does**: read the round-2 source list; for each source, for each query, fetch
  `https://r.jina.ai/https://html.duckduckgo.com/html/?q=<query>` (agent-reach's documented
  zero-config web channel); parse the `uddg=` redirect parameters into absolute URLs; write
  `docs/RSA-Documents/track-a-round2-candidates.json` with `source_id`, `source_type`, `url`,
  `title_hint`, `query`, `discovery_channel`, `discovered_at`, `jurisdiction_hint`.
- **Acceptance**: the candidates file exists, every row carries its query and source, no duplicate
  URL appears twice, and the run log states how many queries ran and how many returned nothing.

### M2 — Round-2 source list and query set

- **touches**: `docs/RSA-Documents/track-a-round2-sources.json` (new)
- **blocked_by**: none
- **Does**: the closed 7-type taxonomy (R18); one source entry per family with its queries, licence
  default, stage/province/doc-type hints, `max_downloads`; the 13 unfillable families carried
  forward (R23); the split rule and hash rule mirrored from `track-a-sources.json`.
- **Acceptance**: every source has a `source_type` from the closed set, a licence default, and at
  least one query; the unfillable array has 13 entries.

### M3 — Harvester round-2 support

- **touches**: `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts`
- **blocked_by**: M2
- **Does**: (1) `candidate-list` strategy; (2) 5 GB cumulative byte cap + 100 MiB per-document cap
  enforced **before** the write, with a byte-accounting file; (3) additive manifest fields `round`,
  `stage_source`, `tier_source`, `dedupe_status`; (4) the round-2 candidate log;
  (5) French stage patterns in `STAGE_RULES`; (6) a licence-register row per source *attempted*;
  (7) a `round !== "2"` filter in the round-1 report generator.
- **Acceptance**: `npx tsx scripts/harvest-track-a.ts selftest` passes; the round-1 report is
  byte-unchanged; the candidate log has one row per candidate examined; no byte is written past the
  cap.

### M4 — Round-2 report and its guard

- **touches**: `scripts/harvest-track-a-round2-report.ts` (new),
  `tests/discovery/harvest-track-a-round2-report.test.ts` (new)
- **blocked_by**: M2, M3
- **Does**: regenerate `docs/RSA-Documents/track-a-round2-harvest-report.md` byte-identically from
  committed inputs only, importing the round-1 rule functions. §1 coverage before/after with
  priority cells; §2 precision (corpus tables over |A'|/|B'| + a funnel table over candidates
  examined); §3 source-yield table with honest zero rows; §4 gaps (the 13 families + any newly
  found); §5 provenance and limitations.
- **Acceptance**: regenerating leaves the file unchanged; the vitest guard passes; the coverage
  table's "before" equals the committed round-1 numbers; the yield table's in-scope column equals
  the coverage table's attribution.

### M5 — Live round-2 execution and committed artefacts

- **touches**: the nine `docs/RSA-Documents/**` artefacts listed in the architecture
- **blocked_by**: M1, M3, M4
- **Does**: `npm ci` → `npx tsx scripts/harvest-round2-discover.ts` → `npx tsx
  scripts/harvest-track-a.ts fetch --round=2` → `... intake` → `npx tsx
  scripts/harvest-track-a-round2-report.ts` → `npx tsx scripts/harvest-track-a-report.ts` to prove
  the round-1 artefact is unchanged.
- **Acceptance**: every candidate is logged; every ingested row has a matching candidate-log row and
  a licence row; no binary is tracked by git; the round-1 report has no diff.

## Stop conditions

- Zero in-scope T3/T4 documents is an **acceptable** outcome (R45): the report then states the
  candidate count, the zero, and that before == after. The round does not retry to manufacture a
  number.
- The round stops at the byte cap with `reason=byte-cap`, never past it.
- The round never waits for the operator (all O1–O6 have defaults) and never waits for the
  free-model pool (R41).

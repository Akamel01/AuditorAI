# Architecture — Ticket #40 Track A (public Canadian RSA documents)

Authority: `.autoforge/requirements/grilling.md` (R1..R12, A1..A9, D1..D10, HITL) + `.autoforge/discovery/*`.

## 1. DESIGN

Four modules: two code, one input, one output family. Rationale for two code modules: the robots gate is the sole `src/` change allowed (grilling.md:60) and must be testable in isolation; everything else is a linear pipeline (fetch → verify → record → write → report) over one in-memory record set, so splitting it across 4–5 scripts would need 4–5 shared state files, CLI surfaces and test files for one pipeline. One script with subcommands is the smaller review surface.

### M1 — Robots gate (only `src/` addition)
- **Files:** NEW `src/discovery/robots.ts`; NEW `tests/discovery/robots.test.ts`.
- **Surface:** `parseRobots(text): RobotsFile` (pure), `isAllowed(robots, path, ua): boolean`, `crawlDelayMs(robots, ua): number | null`, `robotsFor(url): Promise<RobotsFile>` (fetch `/robots.txt` through `withHostBudget` — `src/discovery/ratelimit.ts:34`; cache per host; 404/410 → allow-all; 401/403 → deny-all; 5xx/network → deny + `skip_reason`).
- **Test (no network):** fixture strings assert longest-match precedence, `Disallow: /api/` on Alberta (`source-feasibility.md:7`), `/*?*tags=` on Montréal (`:8`), `Allow` overrides, `Crawl-Delay: 10` parse, 404→allow.

### M2 — Track-A CLI (the whole pipeline)
- **Files:** NEW `scripts/harvest-track-a.ts`; NEW `tests/discovery/harvest-track-a.test.ts`.
- **CLI:** `tsx scripts/harvest-track-a.ts <sub> [--live] [--corpus-root <path>] [--manifest <file>]`
  - `fetch` — network; only with `--live` (mirrors the dry-run write guard at `scripts/discovery-run.ts:29-32`).
  - `intake` — no network; derive records from staged binaries.
  - `report` — no network; coverage table + unfillable list from the intake manifest.
  - `selftest` — no network; offline assertions (R1 check).
- **Public functions (exported for the test):** `projectId`, `splitFor`, `verifyPdf`, `dedupeClaim`, `coverage`.
- **Imports from `src/`:** `withHostBudget` (`ratelimit.ts:34`), `sha256Hex` (`ids.ts:6`), `parseRobots`/`isAllowed`/`crawlDelayMs` (M1). Import style = `../src/discovery/ratelimit.js` (TS `.js` specifier → `.ts` source, run by `tsx`; pattern at `scripts/discovery-run.ts:16-18`).
- **Note:** `PRJ-` minting lives **in the script**, not `ids.ts` — `src/` surgery beyond the robots helper is out of scope (grilling.md:60). It mirrors `shortHash` = `sha256Hex(...).slice(0,16)` (`ids.ts:16-17`) and the `PKG-` convention (`ids.ts:44-46`).
- **Test (no network):** asserts (1) split: QC→test, AB→test, BC/ON→train, train∩test provinces empty, QC∉train, no `project_id` in both splits; (2) `projectId` stable across calls, distinct per key, format `PRJ-[0-9a-f]{16}`; (3) `%PDF-` accepted, `<!DOCTYPE html>` rejected as `html-not-pdf`; (4) log sha256 equals sha256 of bytes; (5) non-CLEAR ⇒ `split=quarantine`, never train/test; (6) new sha claimed with `project_id`+`split`, pre-existing sha skipped; (7) coverage zero-fills the 3 `canada:*` cells.

### M3 — Source manifest (input, hand-authored)
- **File:** NEW `docs/RSA-Documents/track-a-sources.json` — allowlist + per-source strategy + licence default + stage/province hints.
- Allowlist (D1, `grilling.md:34`): `open.alberta.ca` (CKAN), `donnees.montreal.ca` (CKAN), `www2.gov.bc.ca` (sitemap + doc pages), `www.unb.ca` (known PDF), `www.toronto.ca` (sitemap only). Dropped families land in the unfillable list with reasons.

### M4 — Outputs (registers/manifests, all tracked)
- NEW `docs/RSA-Documents/canadian-download-log.tsv` (R6), NEW `docs/RSA-Documents/canada-intake-manifest.jsonl` (R4), NEW `docs/RSA-Documents/track-a-split.json` (D5), NEW `docs/RSA-Documents/track-a-coverage.md` (R11/R12), MOD `docs/RSA-Documents/dedupe-index.json` (R9), MOD `docs/RSA-Documents/LICENSE-REGISTER.md` (R7), MOD `docs/RSA-Documents/QUARANTINE.md` (R8), MOD `.gitignore` (binary off-git, R3).
- **Binaries:** `docs/RSA-Documents/canada/<source-dir>/` (CLEAR) and `docs/RSA-Documents/quarantine/<source-dir>/` (non-CLEAR); `--corpus-root` overrides (HITL-2).
- **touches:** `src/discovery/robots.ts`, `scripts/harvest-track-a.ts`, `tests/discovery/{robots,harvest-track-a}.test.ts`, `docs/RSA-Documents/{track-a-sources.json,canadian-download-log.tsv,canada-intake-manifest.jsonl,track-a-split.json,track-a-coverage.md,dedupe-index.json,LICENSE-REGISTER.md,QUARANTINE.md}`, `.gitignore`.

## 2. DATA FLOW

```
docs/RSA-Documents/track-a-sources.json   (source manifest — source of truth: allowlist, strategy, licence default)
        |
        v
robots.ts: parse robots -> per-path allow + Crawl-Delay
ratelimit.ts: withHostBudget(host, fn)  (1 req/s, 2 concurrent — ratelimit.ts:4-5)
        |  (+ crawl-delay gate: 10s on CKAN hosts — source-feasibility.md:26)
        v
fetch bytes -> verify: %PDF magic + content-type + sha256(bytes)
        |                       (reject -> record as skipped, no binary)
        v
binary -> docs/RSA-Documents/canada/<dir>/  |  quarantine/<dir>/ (non-CLEAR)
        |
        v
intake record (project_id, tier, stage, missing_side_note, source_*, track, lang,
               split, licence_*, sha256, bytes, cell_key, ca_province, retrieved_at)
        |
        +--> canadian-download-log.tsv        (source of truth: bytes + sha256 per doc, R6)
        +--> canada-intake-manifest.jsonl     (source of truth: project_id, tier, stage,
        |                                       split, licence_verdict, lang, cell_key, R4)
        |        |
        |        +--> track-a-split.json      (derived: project_id -> split)
        |        +--> dedupe-index.json append (source of truth: sha256 -> project_id+split, R9)
        +--> LICENSE-REGISTER.md row (source of truth: licence verdict per dir)
        +--> QUARANTINE.md bullet (source of truth: quarantine reason per non-CLEAR doc)
        |
        v
track-a-coverage.md  (target = state/odd-coverage.json cells[].target 13/41/41;
                      fetched = cell_key present in the intake manifest; never have_total — ca-cells-split.md:11)
track-a-coverage.md  -> "cells Track A cannot fill" + dropped source families (R12)
```

## 3. SCHEMAS

### Intake record (`canada-intake-manifest.jsonl`, one JSON object per line)

| field | type | allowed | req |
|---|---|---|---|
| `project_id` | string | `PRJ-[0-9a-f]{16}` | ✔ |
| `tier` | enum | `T0,T1,T3,T4` (never `T2` — A4) | ✔ |
| `stage` | enum | `FEASIBILITY_CONCEPT,PRELIMINARY_DESIGN,DETAILED_DESIGN` (`corpus-schema.json:16`) | ✔ |
| `missing_side_note` | string\|null | free text; values from repo `Completeness` labels (`src/discovery/types.ts:124-129`) — no new labels | ✔ (nullable) |
| `source_url` | string | absolute URL | ✔ |
| `source_host` | string | allowlisted host | ✔ |
| `source_dir` | string | dir under corpus root | ✔ |
| `track` | enum | `A` | ✔ |
| `lang` | enum | `en,fr,unknown` | ✔ |
| `split` | enum | `train,test,quarantine` | ✔ |
| `licence_verdict` | enum | `CLEAR,RESTRICTED,BLOCKED` (`LICENSE-REGISTER.md:9-23`) | ✔ |
| `licence_basis` | string | short reason | ✔ |
| `licence_ref` | string\|null | licence/dataset URL | – |
| `sha256` | string | 64 hex = bytes | ✔ |
| `bytes` | int | file size | ✔ |
| `file_name` | string | basename on disk | ✔ |
| `retrieved_at` | string | ISO-8601 | ✔ |
| `cell_key` | enum | `canada:FEASIBILITY_CONCEPT,canada:PRELIMINARY_DESIGN,canada:DETAILED_DESIGN` (`state/odd-coverage.json` cells) | ✔ |
| `ca_province` | enum | `BC,AB,ON,QC,MB,NB,NL,NS,PE,SK,YT,NT,NU` (`corpus-schema.json:12`) | ✔ (CA) |
| `doc_type` | enum | `guide,case-study,complete-RSA,prompt-list,policy,toolkit,presentation,correspondence` (`corpus-schema.json:20`) | ✔ |

Split rule is one line: `const TEST_PROVINCES = new Set(["QC","AB"]); split = TEST_PROVINCES.has(province) ? "test" : "train"`; non-CLEAR overrides to `quarantine` (A2/A3 defaults, `grilling.md:23-24`).

### Download log TSV column order (no header row; 14 columns)
`source_dir`, `source_url`, `file_name`, `bytes`, `sha256`, `project_id`, `tier`, `stage`, `ca_province`, `lang`, `licence_verdict`, `split`, `cell_key`, `retrieved_at`. Row count == fetched count (R6); `sha256` column == `shasum -a 256` of the file.

### Split manifest (`track-a-split.json`)
`{schema_version, generated_at, rule, test_provinces:["QC","AB"], projects:[{project_id, split, provinces[], ca_province, docs, sha256[]}], assertions:{train_test_province_overlap:[], qc_in_train:false, project_in_both_splits:[]}}`. Derived from the intake manifest; the intake record remains authoritative per-doc.

### Dedupe index extension (`docs/RSA-Documents/dedupe-index.json`)
Existing row shape: `{path, sha256, bytes, canonical_id, exact_dup_group}` (`dedupe-index.json:2-8`). New rows = same 5 keys, same order, **plus exactly two new keys**: `project_id` and `split` (`train|test|quarantine`). The writer appends at the array end; `path` is relative to the corpus root (`canada/CONTEXT.md` at `dedupe-index.json:38`), `canonical_id` continues the `C-NNNN` sequence, `exact_dup_group` = `null`. The 333 existing rows are never rewritten — read only to build the pre-existing sha set — and the file is re-serialised with `JSON.stringify(rows, null, 1)` (current 1-space indent) + trailing newline, so the diff shows only appended rows.

## 4. ALTERNATIVES CONSIDERED

**A. Extend the `src/discovery` pipeline** (provider + ledger + coverage) — rejected: it writes `state/discovery-ledger.json` and `state/odd-coverage.json` and reports server-side `have_total` (`scripts/discovery-run.ts:142-168`), which R11 forbids (`ca-cells-split.md:11`), and it drags provider/search machinery irrelevant to a fixed allowlist. Standalone script wins; it reuses `ratelimit.ts` + `ids.ts` primitives without touching pipeline state (grilling.md:60).

**B. Fetch on the corpus/production box vs in this worktree** — worktree wins: egress works here and the corpus box is operator-controlled (HITL-2, `grilling.md:48`). The script writes under `--corpus-root` (default `docs/RSA-Documents/`), so one flag later targets the box path; binaries stay off-git either way (R3).

**C. Manifest in `docs/RSA-Documents/` vs a new top-level dir** — `docs/RSA-Documents/` wins: the register, quarantine list and dedupe index live there, and A9's default puts the intake manifest there too (`grilling.md:30`). `.autoforge/` is unsuitable — curated-only (`.autoforge/AGENTS.md`) and git-ignored (`.gitignore:57-60`).

## 5. RISKS + MITIGATIONS

1. **CKAN listing shape churn** (Alberta 423 hits, Montréal atom feed — `source-feasibility.md:7-8`) → pin one listing URL per source in `track-a-sources.json`, tolerant regex parsing, and a parse failure records the source as unfillable (reason) instead of crashing.
2. **robots is per-path, and crawl-delay is 10s on both CKAN hosts** (BC disallows `/search*`, Montréal `/*?*tags=` — `source-feasibility.md:9,23,26`) → evaluate robots per URL (never host-level allow), log every skip, gate CKAN requests at ≥10s on top of `withHostBudget`; keep the fetch resumable via the sha set.
3. **PDF-vs-HTML landings** (resource URLs redirect to HTML; Québec 403 HTML) → `%PDF` magic + content-type check; HTML/403 rejected with a reason, no binary written.
4. **Licence judgement per document** (CA Crown works are mostly RESTRICTED — `grilling.md:49`) → fail-closed RESTRICTED, CLEAR only on an explicit open licence with no third-party mark; non-CLEAR lands in `quarantine/<dir>/` + a QUARANTINE bullet, excluded from train/test (D10); verdicts live in the source manifest, so re-judging is a one-line change + rerun.
5. **Dedupe collision + bin/registry drift** → claim only sha256 absent from the 333 existing rows, else skip and report; the manifest is the only shipped artefact, coverage is regenerated from it and never hand-edited; `.gitignore` has **no** corpus rule today (`.gitignore:1-60`) so binaries would be staged — add `docs/RSA-Documents/canada/*/`, `docs/RSA-Documents/quarantine/*/`, `docs/RSA-Documents/**/*.pdf` and assert `git status --porcelain` shows no binary path (R3).

## 6. DECISIONS THE OPERATOR MUST RATIFY (proceed on the default; each reversible)

1. **HITL-1 missing `HARVESTING_PLAN.md`** → proceed on D1 reconstruction: ticket body = source list, `odd-coverage.json` targets = §3 targets (`grilling.md:22,47`). Reversible: replace the manifest.
2. **HITL-2 corpus location / execution box** → fetch in this worktree, write to `--corpus-root` (default `docs/RSA-Documents/`); operator points it at the box path later. Reversible: one flag.
3. **HITL-3 Crown verdicts** → default RESTRICTED (fail-closed → quarantine); RESTRICTED-but-fetched docs count in `fetched_all` but never in §3 coverage. Reversible: verdict in `track-a-sources.json`.
4. **A2/A3 split** → QC + AB test-only, other provinces train; one line `TEST_PROVINCES` (`grilling.md:23-24`). Reversible.
5. **A9 intake home + dedupe authority** → intake manifest in `docs/RSA-Documents/`, corpus `dedupe-index.json` is the claim authority, discovery index cross-check only, no `src/`/`contracts/` schema change (`grilling.md:30`). Reversible.

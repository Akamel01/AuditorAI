# Architecture — Akamel01/AuditorAI#60: Harvest round 2 (free, wide search for public Canadian RSAs)

## 1. Objective

Round 2 of the Canadian RSA corpus harvest. Track A (#40, PR #58) searched a static list of
government portals and ingested 3 documents. Round 2 searches **wider** — municipal council/committee
agenda packages, EA/Class EA study reports, university repositories, conference proceedings and
provincial ministry reports — using the **`agent-reach` skill**'s routing and free channels, then
fetches what it finds through the **existing** harvester path so that robots.txt, the 1 req/s limit,
the known-hash gate, the licence gate and the train/test split all still apply. The deliverable is
four report-shaped artefacts (the ticket's four acceptance criteria) plus the corpus and register
changes that back them.

The architecture must produce:

| AC | Artifact |
|---|---|
| AC1 coverage table before/after with priority cells | `docs/RSA-Documents/track-a-round2-harvest-report.md` §1 |
| AC2 harvest precision per class | same report §2 (corpus tables over \|A'\|/\|B'\| + a round-2 funnel table over candidates examined) |
| AC3 source-yield table | same report §3 |
| AC4 gaps free sources cannot fill | same report §4 |

## 2. Environment facts (verified by the orchestrator, 2026-10-22, from this worktree)

| Fact | Evidence |
|---|---|
| `agent-reach`, `mcporter`, `opencli`, `yt-dlp`, `feedparser` are **not installed** | `command -v` — only `curl`, `gh`, `node` v22.23.4, `npx` |
| `EXA_API_KEY`, `OPENCODE_API_KEY`, `AGENT_REACH_ENABLED` **absent** | env presence check, no values read |
| agent-reach's **Exa/mcporter branch is unavailable**; its **zero-config web branch works** | `/home/oc/.agents/skills/agent-reach/SKILL.md` "零配置快速命令" → `curl -s "https://r.jina.ai/URL"`; `references/web.md` |
| `https://r.jina.ai/<search-url>` returns **parseable Canadian RSA URLs, keylessly** | 200, 12,921 B, 9 unique results from `uddg=` params for `"road safety audit" filetype:pdf site:ca` — incl. `niagararegion.ca/media/grcbeqke/appendix-h.pdf` (municipal), `bv.transports.gouv.qc.ca/mono/1357224.pdf` (MTQ), `conf.tac-atc.ca/.../hildebrand.pdf` (TAC), `unb.ca/.../rsa-guidelines.pdf` (university) |
| Search engines reject **direct** scraping from this container | html.duckduckgo.com + lite.duckduckgo.com → HTTP 202 anti-bot challenge; mojeek 403; searx.be browser-verification; search.brave.com 429; Bing markup JS-wrapped |
| Canadian hosts reachable | open.alberta.ca 301, www2.gov.bc.ca 301, www.toronto.ca 200, cdn-contenu.quebec.ca 404, www.unb.ca 200, circle.ubc.ca 200, tspace.library.utoronto.ca 302, uwspace.uwaterloo.ca 200, papyrus.bib.umontreal.ca 301, corpus.ulaval.ca 200, www.tac-atc.ca 301 |
| A real PDF downloads end-to-end from this container | open.alberta.ca `neahd12579-entire-pdf.pdf` → 200, **118,839,466 B**, `application/pdf` |
| npm registry reachable; `npm ci` works | `registry.npmjs.org` 200; `npm ci` → 204 packages; `npx tsx scripts/harvest-track-a.ts selftest` → **selftest passed** (16/16) |
| `node_modules` was absent before `npm ci` | `ls -d node_modules` → not found |
| Box gateway reachable; `sme_ollama_gen_lb` up | `ssh oc-box ps` → `sme_ollama_gen_lb Up 2 days (healthy)`; `oc-box` verbs push/run/pull/logs/ps/runs; `run` executes only `tools/(eval\|research)/*.py` |
| Free-model pool **unreachable from this container** | `curl http://ollama-gen-lb:11434/api/tags` → DNS failure (host does not resolve) |
| Disk is tight | `df -h /tmp` → 594 G total, 553 G used, **11 G free (99 %)** — the 5 GB binary cap is a live constraint, not a formality |
| No corpus binary is tracked by git | `git ls-files docs/RSA-Documents \| grep -ci '\.pdf$'` → 0 (selftest check) |

**Correction to `.autoforge/requirements/grilling.md`.** The grilling concluded "this container has no
outbound network at all" (its header, O2, A11, R4) from a single probe of `example.com`. That probe
was unrepresentative: `example.com` has no route, but the egress allowlist above is wide open.
Consequently:

- **R4 is superseded.** "No new discovery-provider code, a committed candidate list only" was forced
  by the false network premise. With network available, the ticket's actual instruction ("search
  wider than portals… use the `agent-reach` skill") is executable, and a *repeatable* keyless
  discovery step is required for the PR to be honest about having searched widely.
- **O2 / A11 are superseded.** The live round runs in this worktree's runner; no operator machine is
  needed.
- **A5 stands** (model triage optional, rules authoritative), and **R41 stands**: the pool is probed
  on the box; if unreachable, the round proceeds rule-only and says so in the report.

## 3. Module decomposition

Five modules. `touches` is the parallelism guard: two modules may run concurrently only when their
`touches` globs are disjoint.

### M1 — Round-2 discovery (the wide search)

- **Creates**: `scripts/harvest-round2-discover.ts`
- **Touches**: `scripts/harvest-round2-discover.ts` (new file only — nothing existing is modified)
- **Blocked by**: none
- **Satisfies**: R3, R5, R18, R20 (partly), O1
- **Interface**: reads `docs/RSA-Documents/track-a-round2-sources.json` (M2) and writes
  `docs/RSA-Documents/track-a-round2-candidates.json` — a committed candidate list, one row per
  candidate URL examined, with `source_id`, `source_type`, `url`, `title_hint`, `query`,
  `discovery_channel`, `discovered_at`, `jurisdiction_hint`.
- **How**: for each source entry, for each of its queries, fetch
  `https://r.jina.ai/https://html.duckduckgo.com/html/?q=<encoded query>` and parse the `uddg=`
  redirect parameters into absolute URLs. One request per second per host via the repo's existing
  `withHostBudget` (`src/discovery/ratelimit.ts:34`). The search-engine host is `r.jina.ai`; the
  *candidate* hosts are not contacted during discovery (R3).
- **Why a script, not a `DiscoveryProvider`**: the repo's provider seam
  (`src/discovery/providers/provider-types.ts:19-29`) is the house pattern for the **runtime**
  pipeline, which R1 forbids changing. A provider would also imply app-level availability that
  needs secrets, health-state and UI wiring that this ticket does not ask for. The house pattern for
  a one-shot corpus harvest is a script under `scripts/` — exactly what `scripts/harvest-track-a.ts`
  is. This is the ponytail reading: use the house pattern, do not build an abstraction for later.

### M2 — Round-2 source list and query set

- **Creates**: `docs/RSA-Documents/track-a-round2-sources.json`
- **Touches**: `docs/RSA-Documents/track-a-round2-sources.json` (new file only)
- **Blocked by**: none
- **Satisfies**: R18, R20, R23, R24, R28
- **Interface**: consumed by M1 (queries), M3 (fetch strategy, licence defaults, province/stage
  hints), M4 (source-type taxonomy, hosts tried).
- **Shape**: `schema_version`, `source_of_record` (the ticket), `discovery` block (channel, engine,
  UA, politeness), `split_rule` (mirroring `docs/RSA-Documents/track-a-sources.json`), `hash_rule`,
  `sources[]` — each with `id`, `host`, `family`, `source_type` (the closed 7-type taxonomy),
  `strategy: "candidate-list"`, `queries[]`, `licence_default{verdict,basis,licence_ref}`,
  `stage_hint`, `ca_province_hint`, `doc_type_hint`, `max_downloads`, and an `outcome` block —
  and `unfillable[]` (the 13 families carried forward, R23).

### M3 — Harvester round-2 support

- **Modifies**: `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts`
- **Touches**: `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts`
- **Blocked by**: M2
- **Satisfies**: R2, R3, R9, R27, R28, R29, R30, R31, R32, R34, R35, R36, R37, R38, R44
- **Changes**:
  1. New strategy `"candidate-list"` — reads the committed candidates JSON instead of listing
     pages. Discovery stays separate from fetching (R3), the candidate list stays auditable (R5).
  2. **5 GB byte cap enforced before the write** (R35/R36). `corpusBytes` = bytes already on the
     corpus shelf + the `bytes` column of the intake manifest; `budget = 5 GiB − corpusBytes`;
     a candidate whose `Content-Length` exceeds `min(remainingBudget, 100 MiB)` is skipped with
     reason `byte-cap`, and the budget is re-checked before `writeFileSync` (today's write is at
     `scripts/harvest-track-a.ts:599`). A byte-accounting file is written.
  3. **Additive, versioned manifest fields** (R27/R29/R30): `round` (`"1"`/`"2"`), `stage_source`
     (`text`/`hint`), `tier_source` (`text`/`doc_type_hint`), `dedupe_status`
     (`new`/`hash-already-present`). Existing rows are untouched; `schema_version` is bumped.
  4. **Candidate log** (R29): `docs/RSA-Documents/track-a-round2-candidate-log.tsv`, one row per
     candidate examined, with `source_id | source_type | url | http_status | bytes | sha256 |
     decision | reason | dedupe_status | stage_source | tier_source`. The hash gate runs *after* the
     bytes arrive (`scripts/harvest-track-a.ts:561-564`), so a known document is recorded as
     `hash-already-present` and described as *downloaded then discarded*, never "never downloaded".
  5. **French stage vocabulary** (R32): `préliminaire` → PRELIMINARY_DESIGN, `détaillé` →
     DETAILED_DESIGN, `avant ouverture`/`en service` → PRE_OPENING, `planification`/`étude de
     faisabilité` → FEASIBILITY_CONCEPT, added to `STAGE_RULES` (`:387-392`). A French document
     must not silently vanish into `UNSTAGED`.
  6. **Licence register row per source *attempted*** (R28), not only per contributing source — today
     the row is written only for sources that yielded a document (`:756-766`).
  7. **Round filter in the round-1 report generator** (R44): `scripts/harvest-track-a-report.ts`
     filters manifest rows to `round !== "2"`, so the committed round-1 report stays byte-identical
     and its vitest guard (`tests/discovery/harvest-track-a-report.test.ts:251-252`) stays green
     without regenerating a historical artefact.

### M4 — Round-2 report and its guard

- **Creates**: `scripts/harvest-track-a-round2-report.ts`, `tests/discovery/harvest-track-a-round2-report.test.ts`
- **Touches**: `scripts/harvest-track-a-round2-report.ts` (new),
  `tests/discovery/harvest-track-a-round2-report.test.ts` (new)
- **Blocked by**: M3 (needs the new manifest fields), M2 (needs the source-type taxonomy)
- **Satisfies**: R6–R26, R41–R47
- **Interface**: `npx tsx scripts/harvest-track-a-round2-report.ts` regenerates
  `docs/RSA-Documents/track-a-round2-harvest-report.md` **byte-identically** from committed inputs
  only — no network, no model call, no timestamp (the round-1 pattern,
  `scripts/harvest-track-a-report.ts:6-10`). It imports the round-1 rule functions
  (`mergeRows`, `manifestClass`, `STAGE_TO_CELL`, `MANIFEST_STAGE_TO_CELL`, `licenceForPath`)
  instead of re-implementing them (R9).
- **Sections**: §1 coverage before/after with priority cells; §2 precision (corpus tables over
  \|A'\|/\|B'\| **plus** a round-2 funnel table over candidates examined); §3 source-yield table;
  §4 gaps; §5 provenance and limitations.

### M5 — Live round-2 execution and committed artefacts

- **Touches**: `docs/RSA-Documents/track-a-round2-candidates.json`,
  `docs/RSA-Documents/track-a-round2-candidate-log.tsv`,
  `docs/RSA-Documents/canada-intake-manifest.jsonl`,
  `docs/RSA-Documents/canadian-download-log.tsv`,
  `docs/RSA-Documents/dedupe-index.json`,
  `docs/RSA-Documents/track-a-split.json`,
  `docs/RSA-Documents/LICENSE-REGISTER.md`,
  `docs/RSA-Documents/track-a-round2-bytes.json`,
  `docs/RSA-Documents/track-a-round2-harvest-report.md`
- **Blocked by**: M1, M3, M4
- **Steps**: `npm ci` → `npx tsx scripts/harvest-round2-discover.ts` (M1) → `npx tsx
  scripts/harvest-track-a.ts fetch --round=2` → `... intake` → `npx tsx
  scripts/harvest-track-a-round2-report.ts` (M4) → `npx tsx scripts/harvest-track-a.ts report` and
  `npx tsx scripts/harvest-track-a-report.ts` to confirm the round-1 artefacts are unchanged.
- Binaries land under `docs/RSA-Documents/canada/track-a/<source_id>/` — gitignored
  (`.gitignore:76-79`) and never committed.

### DAG and parallelism

```
M2 ──┐
     ├──> M3 ──> M4 ──> M5
M1 ──┴───────────────────────> M5
```

`M1 ∥ M2` (disjoint touches: `scripts/harvest-round2-discover.ts` vs
`docs/RSA-Documents/track-a-round2-sources.json`). `M3` must follow `M2` (it reads the source
list's shape at runtime). `M4` follows `M3`. `M5` follows `M1`, `M3`, `M4`.

## 4. Boundaries and seams

**Must not change**

- `src/app/**` and the runtime discovery pipeline's behaviour (`src/discovery/pipeline.ts`,
  `src/discovery/harvest.ts`) — R1. M1/M3/M4 touch no `src/**` file; they only *import* from
  `src/discovery/ratelimit.js` and `src/discovery/robots.js`, as
  `scripts/harvest-track-a.ts:20-21` already does.
- The round-1 report's **rule functions** and its committed output (R9, R44). M3 changes only which
  rows feed the round-1 generator, never how a rule is computed.
- The round-1 report's committed bytes — the vitest guard
  `tests/discovery/harvest-track-a-report.test.ts:251-252` must stay green without regenerating the
  file.
- Git hygiene: no binaries, no extracted PDF text, no `.env*`, no key material (R38, R43).
- The operator checkout `/Users/akamel/Documents/AuditorAI` — read-only, untouched.

**May change**

- `scripts/harvest-track-a.ts` (additive: one strategy, one cap, four fields, one log writer, five
  French patterns, one licence-register condition).
- `scripts/harvest-track-a-report.ts` (one filter).
- New files under `docs/RSA-Documents/` and `scripts/`, `tests/discovery/`.
- `.autoforge/**` curated directories only, per `.autoforge/AGENTS.md`.

**One-way doors** (expensive to reverse)

1. The **`round` field on intake rows** becomes permanent corpus schema. It must be additive and
   optional-tolerant: rows without it are round 1.
2. The **round-2 source list's `source_type` taxonomy** becomes the reported yield taxonomy. It is
   closed at 7 types (R18); extending it mid-round would make the denominator uninterpretable.
3. **The candidate log becomes the precision evidence.** If it is not committed, the PR's precision
   numbers cannot be re-derived (A9).

## 5. Data flow

```
  M2 source list  ──►  M1 discovery script
  (queries, types)      │  r.jina.ai  ──►  html.duckduckgo.com/html?q=<query>
                        │  (1 req/s per host, r.jina.ai only)
                        ▼
              docs/RSA-Documents/track-a-round2-candidates.json      ← committed, auditable
                        │
                        ▼
              M3 harvest-track-a.ts fetch --round=2
                   robots.ts isAllowed  ────────► skip "robots"
                   ratelimit withHostBudget ───► 1 req/s per candidate host
                   byte cap (5 GiB, 100 MiB/doc) ► skip "byte-cap"
                   fetch ──► %PDF- magic ──► skip "not a pdf"
                   sha256 ──► knownHashes() ──► skip "hash-already-present" (bytes already spent)
                   unpdf extractText ──► skip "no text layer"
                   isRsaDocument ──► skip "not RSA"
                   detectStage/detectTier/detectLang/detectProvince
                   splitFor(province, licence)  ── licence gate ──► restricted|quarantine
                        │
                        ├──► docs/RSA-Documents/track-a-round2-candidate-log.tsv  (every candidate)
                        ├──► docs/RSA-Documents/.track-a/fetched.jsonl            (staging)
                        └──► docs/RSA-Documents/canada/track-a/<src>/<file>.pdf    (gitignored)
                        │
                        ▼
              M3 harvest-track-a.ts intake --round=2
                   ──► canada-intake-manifest.jsonl   (appended rows, round="2")
                   ──► canadian-download-log.tsv       (appended rows)
                   ──► dedupe-index.json               (appended rows)
                   ──► track-a-split.json              (regenerated over the FULL manifest)
                   ──► LICENSE-REGISTER.md             (one row per source ATTEMPTED)
                        │
                        ▼
              M4 harvest-track-a-round2-report.ts
                   reads: inventory + manifest + dedupe + licence register + candidates +
                          candidate log + sources + odd-coverage
                   writes: docs/RSA-Documents/track-a-round2-harvest-report.md  (AC1–AC4)
```

The **5 GB cap** sits immediately before the file write. The **hash gate** sits after the response
arrives, so a known document is *downloaded then discarded* — the log says so. The **licence gate**
sits at `splitFor`: a non-CLEAR verdict makes the document `restricted`, never train and never test.

## 6. Key risks at the seams

| Risk | Why it bites | Mitigation |
|---|---|---|
| Search-engine blocking | DDG/Bing/Brave/Mojeek/searx all challenge or 403 direct requests from this container | Route through `r.jina.ai` (proven, keyless). If a query returns 0 results, record it as `no results` — never as "not found" |
| The wide search returns too little | 9 results for one query; the query set must be broad and per-family | Run many queries across the 7 source types; the report's yield table shows every type attempted, with honest zeros (R20) |
| The byte cap vs a huge single PDF | one Alberta PDF measured **118 MB** | per-document cap 100 MiB + cumulative 5 GiB, both enforced before the write (R35/R36) |
| French RSAs vanish | `STAGE_RULES` is English-only today, so a French RSA falls back to the hint → `UNSTAGED` → never coverage | French patterns in `STAGE_RULES` (R32); the report also carries an explicit unmapped bucket |
| Round-1 artefact churn | appending to the manifest changes the round-1 report's \|A\|/\|B\| | filter `round !== "2"` in the round-1 generator; the committed round-1 report stays byte-identical (R44) |
| Manifest schema break | the intake manifest is consumed by the report generator, the split map and the dedupe index | fields are additive and optional-tolerant; `schema_version` bumped (R27) |
| Split-rule confusion | the ticket says "the held-out prairie province"; the code says QC+AB | follow the code (`scripts/harvest-track-a.ts:38`); MB is left unharvested and flagged in the gaps table (R33, O4) |
| The honest-zero trap | round 2 may legitimately find 0 in-scope T3/T4 documents | the report states the candidate count, the zero, and that before == after, in fixed words (R45) |

## 7. Decision table

| # | Decision | Options | Pick | Rationale |
|---|---|---|---|---|
| D1 | Where round-2 discovery lives | (a) new `DiscoveryProvider` in `src/discovery/providers/`; (b) script under `scripts/`; (c) a new harvester `strategy` | **(b) script** | (a) touches the runtime seam R1 forbids changing and implies app-level wiring nobody asked for; (c) conflates finding with fetching, breaking R3. The house pattern for a one-shot harvest is `scripts/` |
| D2 | How the search is performed | direct scraping of an engine; agent-reach's Exa branch; **agent-reach's Jina Reader over an engine** | **Jina over the engine** | agent-reach's documented zero-config web channel; keyless, free, proven to return Canadian candidates. Its Exa branch is unavailable (no key, no `mcporter`) — recorded as such |
| D3 | Round-1 report handling (R44) | Option A regenerate it; Option B freeze its inputs; **Option C filter round-2 rows out** | **Option C** | the round-1 report is a historical artefact of round 1; one filter keeps its committed bytes *and* its vitest guard green, and the round-2 report carries before/after. Option A would rewrite history in a round-1-named file |
| D4 | Candidate-list strategy shape | a `candidate-list` strategy reading the committed JSON; or a `known-document-url` entry per source | **`candidate-list` strategy** | keeps discovery and fetching separable (R3) and the candidate log authoritative (R29); a URL list inside the source list would grow that file without provenance |
| D5 | French stage patterns | inside `STAGE_RULES`; a separate French table | **inside `STAGE_RULES`** | one classifier, one place; the patterns are the same 4 stages, just French tokens. A second table would need a second code path through `detectStage` |
| D6 | Byte accounting file | JSON; TSV | **JSON** | it is a single object with named fields and one consumer (the report generator + the test). TSV's column discipline buys nothing for one row |
| D7 | Runner for the live round | the operator's machine; the box runner; **this worktree** | **this worktree** | network and npm are proven here; the harvester is Node/tsx and the box's `run` verb executes only `tools/**/*.py`. The box is used only for the free-model-pool probe |
| D8 | Free-model triage | mandatory; attempted then skipped; **not attempted** | **probed on the box; rule-only unless it answers** | the pool does not resolve from this container. If the box answers, the model may pre-filter candidates only — never set tier, stage, class, licence or a count (R40). Otherwise the report says so in one sentence (R39/R41) |
| D9 | Committed candidate list | commit it; keep it ephemeral | **commit it** | without it the round cannot be re-run or audited, and the precision numbers become unverifiable (R5, A9) |
| D10 | Source-type taxonomy | closed 7 types; open | **closed 7 types** | an open taxonomy makes the yield denominator uninterpretable; extending it mid-round is a measurement bug (R18/R11) |

## 8. Verification strategy

| Claim | Command |
|---|---|
| lint clean | `npm run lint` |
| types clean | `npm run typecheck` |
| unit + guard tests | `npm test` (vitest) — includes the round-1 byte-reproducibility guard `tests/discovery/harvest-track-a-report.test.ts:251-252` and the new round-2 guard |
| build | `npm run build` |
| harvester invariants | `npx tsx scripts/harvest-track-a.ts selftest` |
| round-2 report is byte-reproducible | `npx tsx scripts/harvest-track-a-round2-report.ts` leaves the committed file unchanged; `npx vitest run tests/discovery/harvest-track-a-round2-report.test.ts` passes |
| round-1 report untouched | `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md` |
| no binary in git | `git ls-files docs/RSA-Documents \| grep -ci '\.pdf$'` → 0 |
| vault determinism (repo AGENTS.md) | `node scripts/vault-sync.mjs --check` |
| byte cap honoured | the byte-accounting file's arithmetic, asserted by the round-2 test; `corpusBytesAfter ≤ capBytes` |

The repo pre-commit hook runs lint + typecheck + vault determinism + YAML parse; `npm run ci:local`
mirrors CI.

## 9. Module `touches` / `blocked_by` summary

| Module | Touches | Blocked by |
|---|---|---|
| M1 discovery script | `scripts/harvest-round2-discover.ts` | — |
| M2 round-2 source list | `docs/RSA-Documents/track-a-round2-sources.json` | — |
| M3 harvester round-2 support | `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts` | M2 |
| M4 round-2 report + guard | `scripts/harvest-track-a-round2-report.ts`, `tests/discovery/harvest-track-a-round2-report.test.ts` | M2, M3 |
| M5 live round + artefacts | `docs/RSA-Documents/**` (the nine artefacts listed in M5) | M1, M3, M4 |

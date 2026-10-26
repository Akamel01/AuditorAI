# Requirements grilling — Akamel01/AuditorAI#60 (harvest round 2, free/wide Canadian RSA search)

Role: requirements griller (grill-with-docs). Output only: this file. No source touched, no commit, no push, no live search, no download.

Sources read: `.autoforge/discovery/report.md`, `.autoforge/discovery/tracker-index.md`, issue #60 body (via `gh issue view 60`), `docs/RSA-Documents/track-a-harvest-report.md`, `docs/RSA-Documents/track-a-sources.json`, `docs/RSA-Documents/LICENSE-REGISTER.md`, `docs/RSA-Documents/canada-intake-manifest.jsonl`, `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts`, `tests/discovery/harvest-track-a-report.test.ts`, `src/discovery/{robots,ratelimit}.ts`, `src/discovery/providers/agent-reach-search.ts`, `state/odd-coverage.json`, `policies/canada/pack.json`, `.gitignore`, `.autoforge/AGENTS.md`, `.autoforge/state.json`.

Environment verified by me (not by the discovery report):

| Fact | How verified | Result |
|---|---|---|
| `agent-reach`, `mcporter`, `opencli`, `yt-dlp`, `feedparser` | `command -v` | **ABSENT** — only `curl`, `gh`, `node` present |
| `EXA_API_KEY`, `OPENCODE_API_KEY` (also GROQ/BRAVE) | env presence only, no values read | **ABSENT** (all four) |
| Free-model pool `http://ollama-gen-lb:11434` | `curl -m 4 /api/tags` | **UNREACHABLE** (exit 6, http 000) — confirms `.autoforge/state.json:56` |
| Outbound internet from this container | `curl -m 6 https://example.com` | **FAILS** (exit 7, http 000); no proxy env vars set |
| Box free disk | `df -h .` | 12 G free, 99 % used — the 5 GB cap is a live constraint, not a formality |
| Tracked PDFs under the corpus | `git ls-files docs/RSA-Documents \| grep -ci '\.pdf$'` | **0** (99 tracked PDFs exist under `docs/references/`, outside the corpus) |

**Grilling headline:** the ticket says "use the agent-reach skill and free models for discovery and triage". In the environment this ticket runs in, `agent-reach` is not installed, its search backend (Exa via `mcporter`) needs two keys that are absent, its free-model pool is unreachable, and the container has no outbound network at all. The only runnable channels are `curl` and `gh` — and `curl` has no route out. Therefore the *fetch* half of round 2 cannot be executed by an agent in this container either. Round 2 is therefore split: (a) an **offline, committed, deterministic** report/register layer that is buildable and reviewable here, and (b) a **live fetch round** that needs a network-capable runner (operator or a CI/box runner). The requirements below force that split to be stated in the report rather than hidden.

---

## 1. Scope and definitions the ticket left open

**R1 — Round 2 is a corpus harvest round, not a product feature.**
Nothing under `src/app/**` or the runtime discovery pipeline (`src/discovery/pipeline.ts`, `src/discovery/harvest.ts`) may change behaviour. The deliverable is corpus artefacts + a report.
*Evidence:* `git diff --name-only` shows no change under `src/app/**`; the four acceptance criteria are report-shaped.

**R2 — "Free" is pinned to eight exclusions.**
A legal in-scope fetch is: publicly reachable, **no money**, **no login/account**, **no paywall**, **no CAPTCHA**, **no form submission**, **no ATIP/FOIA request**, **no credential use**; robots-permitted for our UA; ≤1 req/s per host.
Refusals (must be refused, not worked around): paywalled or "free with registration" documents, CAPTCHA-walled listings, any document reachable only after login, anything whose reuse terms require a request, and any host whose robots.txt disallows our path.
*Evidence:* every candidate row in the round-2 candidate log carries a `decision` and a `reason`; no row has `decision=ingest` for a URL whose host/path was robots-disallowed (`src/discovery/robots.ts:100,152`).

**R3 — Discovery may never fetch document bytes.**
Discovery channels (search engines, Jina Reader, `gh search`) may return *URLs and titles only*. Every document byte must come from the existing harvester path so that robots, rate limit, PDF magic check, hash gate and licence gating all apply (`scripts/harvest-track-a.ts:504-620`; `src/discovery/ratelimit.ts:4,34`).
*Evidence:* the harvester's fetch counters (`fetched N`, skip reasons) account for 100 % of ingested bytes; a document that entered the manifest without a harvester fetch row is a rejection criterion (§5).

**R4 — The smallest honest implementation is chosen, and it is (a), not (b).**
*Argued for (b) new discovery-provider code:* the ticket names `agent-reach`; a provider would make round 2 repeatable.
*Argued for (a):* `src/discovery/providers/agent-reach-search.ts` already exists but is fail-closed without three secrets (`:36`, `:155`), emits `licence_hint: "unknown"` (`:204`), and writes to the *app* discovery pipeline, which produces no licence row, no project ID, no split, no tier/stage — i.e. it cannot satisfy the ticket's per-document rules at all. Building a second, key-requiring, unverifiable discovery path in a container with no keys and no network buys nothing.
**Decision: (a)** — a new source list + one narrow intake addition (a committed candidate-URL list consumed by the harvester) + a new deterministic report generator. **No new discovery-provider code.**
*Evidence:* the PR contains no new file under `src/discovery/providers/`.

**R5 — Discovery output is a committed, auditable candidate list.**
The candidate list is a committed JSON (URL, source_id, source_type, title_hint, discovery_channel, query, discovered_at) so the round can be re-run and audited without re-searching.
*Evidence:* the file exists in the PR and every ingested manifest row's `source_url` appears in it.

---

## 2. AC1 — coverage table versus ODD targets, before and after

**R6 — "Before" is frozen and cited; "after" is computed by the same rules.**
*Before* = the round-1 state at the base commit: `canada:FEASIBILITY_CONCEPT` 1/13 (usable 1), `canada:PRELIMINARY_DESIGN` 0/41 (usable 0), `canada:DETAILED_DESIGN` 1/41 (usable 0) — `docs/RSA-Documents/track-a-harvest-report.md:33-35`. The report must cite the base commit sha and print the before-table inline, not only link it.
*After* = the same three cells recomputed by the same classifier over the post-round-2 row set.
*Evidence:* the round-2 report contains a single table with columns `cell | target | priority | before have | after have | before usable (CLEAR) | after usable (CLEAR) | gap before | gap after | priority flag`, and a line naming the base commit sha.

**R7 — Priority cells are called out by the file, not by prose.**
Priority comes from `state/odd-coverage.json`: FEASIBILITY_CONCEPT 0.9231 (label UNDER-COVERED), PRELIMINARY_DESIGN 3, DETAILED_DESIGN 3 (both MISSING). The report must mark which priority cells moved, which did not, and must not imply a closed gap when the count is unchanged.
*Evidence:* every row of the coverage table carries the priority value; a priority cell with no change is explicitly labelled "unchanged".

**R8 — The two coverage counters are never conflated.**
`state/odd-coverage.json` `have_total` / `have_full_package` count ODD **packages**; the report counts **documents**. They measure different things and may disagree for the same cell (`docs/RSA-Documents/track-a-harvest-report.md:39`).
*Evidence:* the round-2 report carries the same disclaimer sentence as line 39, and no table column mixes the two counter families.

**R9 — Counting rules may not change between the rounds.**
The after-counts must be produced by the same rule set as the before-counts (sha256 identity; Canadian = 13 `ca_province` codes or CAN-GOV; T3/T4 only; stage must map to a canonical cell; T0/T1 never count; duplicate copies never carry a count; manifest wins tier/stage on sha collision; BLOCKED rows never count — `docs/RSA-Documents/track-a-harvest-report.md:12-23`). Any rule change would break comparability and is out of scope for this ticket.
*Evidence:* the round-2 report generator imports the round-1 rule functions (`scripts/harvest-track-a-report.ts:16-31,199-206,285-286`) rather than re-implementing them.

**R10 — The report must distinguish "coverage candidate" from "usable".**
A candidate whose licence is not CLEAR is counted but is not usable for train/test until the owner signs off (`docs/RSA-Documents/track-a-harvest-report.md:20,41`; `docs/RSA-Documents/LICENSE-REGISTER.md:1-5`).
*Evidence:* every candidate row in the report carries its licence verdict and a `usable` flag.

---

## 3. AC2 — harvest precision per class

**R11 — Reuse the Track A class taxonomy verbatim; do not extend it in round 2.**
Classes are exactly: `rsa-sample`, `methodology`, `out-of-scope`, `duplicate`, `unusable` (`docs/RSA-Documents/track-a-harvest-report.md:77-92`). Extending the taxonomy in the same round that measures precision makes the denominator uninterpretable.
*Evidence:* the round-2 report's class tables use the five class names and no others; a new class would require an ADR (out of scope).

**R12 — Reuse the two populations and keep them unmixed.**
`|A|` = every row on record (inventory rows + manifest rows whose sha256 is not in the inventory) = 305 at round 1; `|B|` = the Canadian subset = 147 at round 1 (`docs/RSA-Documents/track-a-harvest-report.md:26-27`). Round 2 restates both as `|A'|`, `|B'|` and states the delta (`|A'| = |A| + new manifest rows`).
*Evidence:* the report labels every table with its denominator; `out-of-scope` appears only in the all-rows table, as in round 1 (`:94`).

**R13 — A third, round-2-specific table with its own denominator is mandatory.**
Precision for a *harvest round* is measured over **candidates examined**, not over the corpus. The round-2 report must therefore carry: (i) corpus-wide class tables over `|A'|` and `|B'|` (continuity with round 1), and (ii) a round-2 funnel table with denominator = candidate URLs examined, classes = `rsa-sample` (ingested, Canadian, T3/T4, mapped stage), `methodology` (ingested T1), `T0/T1-unusable` (ingested T0), `duplicate` (hash-already-present skip), `out-of-scope` (fetched but rejected by the RSA classifier or non-Canadian), `not-fetched` (robots/HTTP/non-PDF/no-text-layer).
*Evidence:* the funnel table's row counts sum to the candidate log's row count (asserted by the round-2 test).

**R14 — "Duplicate" is two different mechanisms and must not be summed.**
Round 1's `duplicate` class is *inventory copies* (`dup_of` set, 36 of |A| — `docs/RSA-Documents/track-a-harvest-report.md:26,79`). Round 2's duplicates are *fetch-time hash skips* (bytes downloaded then discarded — `scripts/harvest-track-a.ts:561-564`, and `:125` of the report). They must be labelled `duplicate (inventory copy)` and `duplicate (fetch-time hash skip)` in separate tables.
*Evidence:* no table adds the two numbers; the round-2 test asserts they are distinct cells.

**R15 — T0/T1 never counts as coverage, and a methodology report is never an RSA sample.**
`docs/RSA-Documents/track-a-harvest-report.md:15,109`. A T1 guideline, circular or conference paper counts as `methodology` only.
*Evidence:* the round-2 test asserts no T0/T1 row appears in any cell count (mirroring `tests/discovery/harvest-track-a-report.test.ts:141-153`).

**R16 — Manifest-only rows classify by tier through the existing function.**
T3/T4 → `rsa-sample`, T1 → `methodology`, T0 → `unusable` (`scripts/harvest-track-a-report.ts:199-206`).
*Evidence:* the round-2 generator calls `manifestClass()`; no parallel mapping exists in round-2 code.

**R17 — Every number is reproducible offline.**
The round-2 report carries no timestamp and is regenerated byte-identically by a committed script from committed inputs only — no network, no model call (the round-1 pattern, `scripts/harvest-track-a-report.ts:6-10`), guarded by a vitest equality test (the round-1 pattern, `tests/discovery/harvest-track-a-report.test.ts:251-252`).
*Evidence:* `npx tsx scripts/harvest-track-a-round2-report.ts` leaves the committed file unchanged, and `npx vitest run tests/discovery/harvest-track-a-round2-report.test.ts` passes.

---

## 4. AC3 — source-yield table

**R18 — Source *type* is a fixed, closed taxonomy; every ingested document maps to exactly one type.**
Types: `municipal-agenda-package`, `ea-class-ea-study`, `university-repository`, `conference-proceedings`, `provincial-ministry-report`, `open-data-portal`, `direct-known-document`.
*Evidence:* each source entry in the round-2 source list carries a `source_type`; each ingested manifest row's `source_id` resolves to exactly one type; the test asserts a 1:1 mapping.

**R19 — Table shape (columns fixed).**
`source_type | hosts tried | candidate URLs seen | candidates rejected | docs ingested | in-scope Canadian RSA T3/T4 | licence state of ingested | yield % (in-scope ÷ candidates examined)`.
*Evidence:* the report contains this table verbatim.

**R20 — Honest zero rows.**
Every source type **attempted** appears with explicit zeros. A type that was planned but not reachable (no network, no key, host unreachable) appears with its blocking reason, not omitted. A type not attempted at all is not listed as attempted.
*Evidence:* each attempted type has a row; the "hosts tried" cell of an unreachable type names the failure (e.g. `DNS/connect refused`, `no key provisioned`).

**R21 — The yield table is derived from committed inputs only.**
Candidate counts come from the committed candidate log; ingested counts from the committed intake manifest; source types from the committed source list.
*Evidence:* regenerating the report from a clean checkout reproduces the same table.

**R22 — Precision and yield must be consistent with each other.**
`in-scope Canadian RSA T3/T4` in the yield table must equal the count of coverage candidates attributed to that source type in the coverage table.
*Evidence:* the round-2 test cross-checks the two tables against the manifest.

---

## 5. AC4 — gaps free sources cannot fill (input for the ATIP fallback)

**R23 — The 13 known unfillable families are carried forward and re-verified.**
`docs/RSA-Documents/track-a-sources.json` → `unfillable` (13 families, reproduced at `docs/RSA-Documents/track-a-harvest-report.md:131-145`). Round 2 must either re-verify each family's blocker or state that it was not re-attempted and why.
*Evidence:* the gaps table has exactly one row per family in the `unfillable` array plus any newly discovered family.

**R24 — Gap table columns (fixed).**
`family | host | why still unfillable (mechanism) | how it was verified this round (attempt + observed status) | cell(s) affected | Track B (ATIP) ask: province + stage + document type + issuing body`.
*Evidence:* every row names a province, a stage and a document type in the ATIP ask — the ODD cells are stage-keyed (`state/odd-coverage.json`, `policies/canada/pack.json:22-83`), so an ask without a stage is not actionable.

**R25 — The pre-opening family must be reported as a structural gap, not a search failure.**
`ca-tac:pre-opening` has `canonical_stages: []` (`policies/canada/pack.json:76-83`), so no pre-opening RSA can ever enter a coverage cell even if found. The gaps table must say so; otherwise round 3 will re-attack an unattackable cell.
*Evidence:* the pre-opening row names the missing canonical cell mapping.

**R26 — The gaps table is the input for Track B, so it must be actionable without re-reading the code.**
Each ATIP ask must be phrased as a request the operator can send: issuing body, jurisdiction (province/municipality), stage (planning / preliminary design / detailed design / pre-opening), document type (completed RSA report including the designer/owner response appendix), and any known document ids.
*Evidence:* the round-2 report's gap section is self-contained.

---

## 6. Per-document field mechanics (ticket "Rules")

Field-by-field check of what the intake manifest records today (`scripts/harvest-track-a.ts:601-621`, `IntakeRecord` at `:107-127`, TSV columns at `:41-56`):

| Ticket requires | Recorded today? | Where |
|---|---|---|
| licence row | **Partly** — `licence_verdict/basis/ref` per document, copied from the *source* default (`:590`); the register row is written per source **directory** and only for sources that contributed ≥1 document (`:756-766`) | change required, R28 |
| project ID | Yes — `PRJ-<16 hex>` from `source.id` + project key (`:592`, `projectKeyFor` `:489`) | — |
| split | Yes — `splitFor(province, licence)` (`:357`, `:591`) | — |
| dedupe check | **No per-document field.** Only in-memory skip counters (`:563-566`) and a partial duplicates register (`docs/RSA-Documents/track-a-duplicates.json`, partial by construction — report `:125`) | change required, R29 |
| tier | Yes — `detectTier` (`:469`), but provenance (text vs `doc_type_hint` force) is not recorded | change required, R30 |
| stage | Yes — `detectStage` (`:400`), but provenance (text vs `stage_hint` fallback) is not recorded | change required, R30 |
| language | Yes — `detectLang` (`:410`), keyword-count heuristic only | annotate, R31 |

**R27 — No new field may break the round-1 artefacts.**
The intake manifest is the corpus source of truth; any new field must be additive and versioned.

**R28 — A licence row must exist for every source *attempted*, not only for sources that yielded a document.**
Current behaviour writes the register row only for contributing sources (`scripts/harvest-track-a.ts:756-766`), so a round-2 source that yields nothing has no licence basis on record — and the ticket's "every document gets a licence row" becomes vacuous for that source.
*Evidence:* `docs/RSA-Documents/LICENSE-REGISTER.md` contains a row for every `source_id` in the round-2 source list, each with verdict, basis, licence_ref and date.

**R29 — The dedupe check must be a per-document, committed artefact.**
A committed candidate log (`docs/RSA-Documents/track-a-round2-candidate-log.tsv`, one row per candidate URL examined) with columns `source_id | source_type | url | http_status | bytes | sha256 | decision | reason | dedupe_status | stage_source | tier_source`.
Note the hash gate runs **after** the bytes arrive (`scripts/harvest-track-a.ts:561-564`): a known document is downloaded in full and then discarded — the log must record `dedupe_status=hash-already-present` with the known path, and the report must say "downloaded then discarded", never "never downloaded".
*Evidence:* every ingested manifest row has a matching candidate-log row; every candidate-log row has a decision.

**R30 — Stage and tier provenance must be recorded explicitly.**
Round 1 could only *infer* provenance by equality with the fallback (`docs/RSA-Documents/track-a-harvest-report.md:23,123`). Round 2 must record `stage_source ∈ {text, hint}` and `tier_source ∈ {text, doc_type_hint}` per document.
*Evidence:* the manifest rows carry both fields; the report tabulates them.

**R31 — Language detection must be reported as a heuristic.**
`detectLang` counts English/French function words (`:410`); it is not a language model. Any claim about French-language coverage must carry that caveat.
*Evidence:* the report states the heuristic in the same paragraph as the language split.

**R32 — French documents must not silently vanish.**
`STAGE_RULES` (`:387-397`) match English stage words only. A French RSA (`audit de sécurité routière`, `préliminaire`, `détaillé`, `avant ouverture`) falls back to `stage_hint` → `UNSTAGED` → unmapped → **never coverage** (`:388-393`, `scripts/harvest-track-a-report.ts:23-31`). Round 2 must either add French stage patterns (`préliminaire` → PRELIMINARY_DESIGN, `détaillé` → DETAILED_DESIGN, `avant ouverture`/`en service` → PRE_OPENING, `planification`/`étude de faisabilité` → FEASIBILITY_CONCEPT) or report French hits in a dedicated `stage unmapped — French vocabulary` bucket. Silence is a rejection criterion.
*Evidence:* the round-2 report contains either French stage patterns in the classifier or a non-empty, explained French bucket.

**R33 — The split rule is the code's, not the ticket's prose.**
`TEST_PROVINCES = ["QC", "AB"]` (`scripts/harvest-track-a.ts:37`) — the "held-out prairie province" in the ticket is **AB (Alberta)**, not MB. The discovery report's claim that Manitoba is the held-out test geography (`.autoforge/discovery/report.md:35,81`) contradicts the code and is wrong. A CLEAR Manitoba document would land in **train** under `splitFor`. Round 2 must not harvest Manitoba into train without owner confirmation; MB stays a deferred family and appears in the gaps table.
*Evidence:* the report states the test provinces as QC+AB with the code cite; no MB-sourced row enters the train split.

**R34 — robots.txt and the 1 req/s limit are per-request facts and must be logged.**
`HARVEST_USER_AGENT = "AuditorAI-RSA-Harvest/1.0 (+public documents only)"` (`src/discovery/robots.ts:10`), `isAllowed` (`:100`), `robotsFor` (`:152`), `MIN_INTERVAL_MS = 1000` (`src/discovery/ratelimit.ts:4`), `withHostBudget` (`:34`).
*Evidence:* the candidate log records the robots decision per URL and the run log shows no two requests to one host within 1 s.

---

## 7. The 5 GB binary cap

**R35 — The cap must be enforced in code before bytes are written, not merely declared.**
Nothing enforces it today: the harvester writes bytes at `scripts/harvest-track-a.ts:599` with no size or budget check, and the box has 12 G free with 99 % used. A manifest-only claim would be unenforceable and unverifiable.

**R36 — Recommended mechanism (concrete).**
1. At run start, measure `corpusBytes` = sum of bytes of `docs/RSA-Documents/canada/track-a/**` on disk **plus** the `bytes` column of the committed intake manifest and download log.
2. Set `budget = 5 GiB - corpusBytes` (if `corpusBytes ≥ 5 GiB`, the round fetches nothing and says so).
3. Before each download, reject a candidate whose `Content-Length` exceeds `min(remainingBudget, perDocumentCap)` with reason `byte-cap`; after the download, before `writeFileSync`, re-check `bytes + downloadedThisRound ≤ remainingBudget` and, if it fails, discard the bytes with reason `byte-cap` (never write, never ingest).
4. `perDocumentCap` default 100 MiB (a single 400 MiB scan must not eat the budget).
5. Commit a byte accounting file `docs/RSA-Documents/track-a-round2-bytes.json` with `{corpusBytesBefore, downloadedThisRound, corpusBytesAfter, capBytes, remainingBytes, perDocumentCap, skippedForCap:[urls]}`.
*Evidence:* the candidate log shows `reason=byte-cap` rows for anything refused; the accounting file's arithmetic is asserted by the test; `corpusBytesAfter ≤ capBytes`.

**R37 — The cap is cumulative, not per round, by default.**
Alternative reading ("5 GB per round") would allow unbounded corpus growth. The default is cumulative-on-this-box; the change is one constant.
*Evidence:* the accounting file states the interpretation in words.

**R38 — Binaries never enter git.**
`.gitignore:76-79` already excludes `docs/RSA-Documents/canada/track-a/`, `docs/RSA-Documents/quarantine/track-a/`, `docs/RSA-Documents/.track-a/` and `docs/RSA-Documents/**/*.pdf`. The rule is enforced by ignore rules *and* must be verified.
*Evidence:* `git ls-files docs/RSA-Documents | grep -ci '\.pdf$'` == 0 after the PR; the diff contains no binary blob.

---

## 8. Free models for triage — decision

**R39 — Model-based triage is OPTIONAL and advisory; it is never the classifier of record.**
The ticket says "use free models for discovery and triage". Three facts constrain this: the free-model pool `http://ollama-gen-lb:11434` is **unreachable** from this container (verified: curl exit 6; also `.autoforge/state.json:56`), its advertised free models were free only "until 2026-10-22" (today), and the report must be offline-deterministic (`scripts/harvest-track-a-report.ts:6-8`).
*Decision:* **deterministic rules only** (`isRsaDocument` `:457`, `detectTier` `:469`, `detectStage` `:400`, `detectLang` `:410`) own tier, stage, class and coverage. A model may be used **only** to remove a candidate from the fetch queue before bytes are downloaded.
*Evidence:* the report states, in one sentence, whether any model triage ran and why not ("no free-model pool reachable from the runner; all triage rule-based").

**R40 — If a model is used, its use is bounded and logged.**
Allowed: reject a candidate from the fetch queue (cost control). Forbidden: set a tier, a stage, a cell_key, a class, a licence verdict or a coverage count; decide that a document *is* an RSA; be called from the report generator.
*Evidence:* every model-rejected candidate is in the candidate log with the model id and the verdict; no manifest field is model-derived; the report generator has no model import (the round-1 generator has none either).

**R41 — Fallback when the pool is unreachable (mandated).**
Proceed rule-only. The report must state the unavailability rather than omit it, and the round must not stall waiting for the pool.
*Evidence:* the sentence named in R39 appears in the committed report.

---

## 9. Committed scope of the PR

**R42 — MUST be committed (allowed artefacts).**
- `docs/RSA-Documents/track-a-round2-sources.json` — the round-2 source list: one entry per source with `id`, `host`, `family`, `source_type` (R18), `strategy`, `listing_url`/`known_document_urls`/candidate-list reference, `robots_hint`, `licence_default{verdict,basis,licence_ref}`, `stage_hint`, `ca_province_hint`, `doc_type_hint`, `max_downloads`, and a round-2 `outcome` block.
- `docs/RSA-Documents/track-a-round2-candidates.json` (or `.tsv`) — the committed candidate list and per-candidate outcome log (R5, R29).
- `docs/RSA-Documents/canada-intake-manifest.jsonl` — appended rows (new documents only).
- `docs/RSA-Documents/canadian-download-log.tsv` — appended rows.
- `docs/RSA-Documents/dedupe-index.json` — appended rows.
- `docs/RSA-Documents/track-a-split.json` — regenerated (province → split map over the full manifest).
- `docs/RSA-Documents/LICENSE-REGISTER.md` — one row per round-2 source directory (R28).
- `docs/RSA-Documents/QUARANTINE.md` — only if a BLOCKED row is ingested.
- `docs/RSA-Documents/track-a-round2-bytes.json` — byte accounting (R36).
- `docs/RSA-Documents/track-a-round2-harvest-report.md` — **the AC1–AC4 deliverable**.
- `scripts/harvest-track-a-round2-report.ts` + `tests/discovery/harvest-track-a-round2-report.test.ts` — the deterministic generator and its guard.
- `docs/RSA-Documents/track-a-harvest-report.md` — regenerated if the corpus changed (see R44).
- `.autoforge/**` curated dirs only (`state.json`, `discovery/`, `architecture/`, `plans/`, `requirements/`, `execution/`, `reviews/`, `validation/`) per `.autoforge/AGENTS.md`; `tmp/` and `*.log` stay ignored (`.gitignore:57-73`).

**R43 — MUST NOT be committed.**
Binaries of any kind under `docs/RSA-Documents/**` (`.gitignore:76-79`); extracted PDF text; `.env*` or any key material; `node_modules/`; `.autoforge/tmp/`, `.autoforge/explanation/`; the operator's checkout (read-only — `.autoforge/state.json:61`); anything under `/Users/akamel/Documents/AuditorAI`.

**R44 — The round-1 report stays byte-reproducible.**
`tests/discovery/harvest-track-a-report.test.ts:251-252` asserts the committed round-1 report equals a fresh regeneration. Appending to `canada-intake-manifest.jsonl` changes that report's inputs (its |A|, |B| and cell counts), so the file must be **regenerated and re-committed** to keep the test green. The "before" column then comes from the base-commit version of that file, cited by commit sha.
*Recommendation:* **Option A** (regenerate the round-1 report; "before" = `git show <base-sha>:docs/RSA-Documents/track-a-harvest-report.md`) — smallest diff, keeps the byte-reproducibility guarantee, and the before-numbers stay verifiable in the base commit.
*Alternative:* **Option B** — freeze a copy of the round-1 manifest as a separate committed snapshot and point the round-1 generator at it, so the round-1 report is never touched. Costs one extra committed file and a generator change; buy it only if the owner wants the round-1 report frozen as a historical artefact.
*Evidence:* `npx vitest run tests/discovery/harvest-track-a-report.test.ts` passes after the PR; the round-2 report cites the base sha and prints the before-table inline.

---

## 10. The honest-zero risk

**R45 — Zero yield is a legitimate, fully acceptable outcome; the report must say so in fixed words.**
If round 2 ingests 0 in-scope Canadian RSA at T3/T4, the report must state: the number of candidates examined; that 0 new coverage candidates were found; that the coverage table is **unchanged** (1/13, 0/41, 1/41 — usable 1/13, 0/41, 0/41); that no cell gap closed; that the deliverable of this round is the precision, yield and gaps evidence; and that no licence row, manifest row or coverage count was created for any document not actually fetched.
*Evidence:* those statements are present verbatim in the report; the coverage table shows before == after.

**R46 — The specific inflation moves that are forbidden.**
1. Re-counting the ~300 on-disk documents as round-2 yield (`docs/RSA-Documents/track-a-ondisk-inventory.jsonl`, 304 rows) — they are the **before** state, not new.
2. Re-counting the round-1 T3 AB document (`0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95`) as new.
3. Counting a T1 methodology report (guideline, circular, thesis, conference paper) as an RSA sample.
4. Counting one document under two source types, or one sha256 under two cells.
5. Counting a hash-skipped download as a new document.
6. Counting a document with an unmapped stage (pre-opening, `existing`, `unknown`) as coverage.
7. Counting a non-CLEAR document as *usable*.

**R47 — A document must appear in exactly one row set.**
Inventory row and manifest row for the same sha256 are one document, attributed to the fetched column, manifest winning tier/stage (`docs/RSA-Documents/track-a-harvest-report.md:17,52-54`).
*Evidence:* the report carries a reconciliation list of the shas present in both sources; the round-2 test asserts each sha256 appears once in the merged row set.

---

## 11. Definitions (validator-facing)

**Classes (exact, unchanged from round 1).** `rsa-sample` · `methodology` · `out-of-scope` · `duplicate` · `unusable`.
`rsa-sample`: Canadian, tier T3/T4, stage maps to a canonical cell, and (inventory rows) `class == "rsa-sample"`. Manifest-only rows are classified by tier: T3/T4 → `rsa-sample`, T1 → `methodology`, T0 → `unusable` (`scripts/harvest-track-a-report.ts:199-206`).

**Populations.** `|A|` = all rows on record = inventory rows (304) + manifest rows whose sha256 is not in the inventory = 305 at round 1. `|B|` = the Canadian subset of |A| = 147 at round 1. `|A'|`/`|B'|` = the same two sets after round 2. `out-of-scope` exists only outside the Canadian subset and appears in the all-rows table only.

**Tiers.** T0 (not an RSA document) · T1 (process/methodology: policy, guideline, circular, thesis) · T2 (reserved; not produced by the current classifier) · T3 (a completed RSA sample) · T4 (post-implementation / outcome study) — `scripts/harvest-track-a.ts:469-484`. T0/T1 never count as coverage.

**Stages and cells.** Inventory stages `planning|preliminary|detailed` → `canada:FEASIBILITY_CONCEPT|PRELIMINARY_DESIGN|DETAILED_DESIGN`; manifest stages `FEASIBILITY_CONCEPT|PRELIMINARY_DESIGN|DETAILED_DESIGN` → the same cells (`scripts/harvest-track-a-report.ts:16-31`). `existing`, `pre-opening`, `unknown`, `UNSTAGED`, `MULTI_STAGE`, `PRE_OPENING` are unmapped and never coverage (`:33`; `policies/canada/pack.json:76-83`).

**Before/after semantics.** "Before" = the corpus state at the base commit of branch `oc/60`, i.e. the round-1 report as committed there (FEASIBILITY_CONCEPT 1/13 usable 1; PRELIMINARY_DESIGN 0/41 usable 0; DETAILED_DESIGN 1/41 usable 0). "After" = the same three cells recomputed by the same rule set over |A'| rows. Before and after are comparable iff the rule set is unchanged (R9) and the denominators are stated (R12).

**Source type (round-2, closed set).** `municipal-agenda-package` · `ea-class-ea-study` · `university-repository` · `conference-proceedings` · `provincial-ministry-report` · `open-data-portal` · `direct-known-document`.

**Candidate.** One URL examined by the round-2 harvester, whether or not bytes were fetched.

**Ingested.** A candidate whose bytes were written to the corpus shelf and whose row was appended to `canada-intake-manifest.jsonl`.

**Usable.** A coverage candidate whose licence verdict is CLEAR (`docs/RSA-Documents/LICENSE-REGISTER.md:1-5`).

---

## 12. Assumptions and defaults

| # | Assumption | Default chosen | If the default is wrong |
|---|---|---|---|
| A1 | "Free" = no money, no login, no CAPTCHA, no paywall, no forms, no ATIP; free-tier keys allowed only if operator-provisioned | as stated (R2) | If the owner accepts free-with-registration, R2 changes and the "no login" refusal list shrinks to paywall/CAPTCHA/ATIP; the candidate log's reason vocabulary changes with it |
| A2 | Discovery may use any channel; fetching must use the harvester | as stated (R3) | If a proxy fetch is allowed, the robots guarantee weakens — a proxy reading a robots-disallowed page is a rejection criterion, so this default is not negotiable without owner sign-off |
| A3 | Minimal implementation = source list + narrow intake addition + report; no new discovery-provider code | as stated (R4) | If the owner wants a productised, repeatable search provider, that is a separate ticket with keys, and this ticket ships the corpus round only |
| A4 | The 5 GB cap is cumulative on the box, per document ≤100 MiB, enforced before write | as stated (R36, R37) | Per-round interpretation: change one constant; per-document cap raised to 500 MiB: change one constant. Enforcement stays |
| A5 | Model triage optional/advisory; rules are authoritative; pool unreachable | as stated (R39-R41) | If a pool becomes reachable, the model may still only pre-filter candidates (R40); the report then says which model ran |
| A6 | Test provinces = QC + AB per the code; MB stays deferred | as stated (R33) | If MB is in fact the intended held-out province, `TEST_PROVINCES` (`:37`) is a code change that must land in its own ticket with a split-map migration, and MB round-2 rows stay out of train until then |
| A7 | French stage vocabulary must be handled (patterns or an explicit bucket) | as stated (R32) | If French docs are out of scope for round 2, the report must say so explicitly and French hits go to the explained bucket — silence is not allowed either way |
| A8 | Round-1 report is regenerated; "before" is cited from the base commit | Option A (R44) | Option B (frozen round-1 inputs) if the owner wants the round-1 report preserved byte-for-byte as history |
| A9 | The candidate log is a new committed artefact | as stated (R29) | If the owner forbids a new corpus file, the log can live under `.autoforge/execution/` — but then it is ephemeral, and the PR's precision numbers become unverifiable; not recommended |
| A10 | New intake fields are additive and versioned; the manifest schema_version is bumped | as stated (R27) | If the manifest must stay byte-compatible, the new fields live in the candidate log only and the manifest keeps `stage_hint`-equality provenance inference (weaker) |
| A11 | The live fetch round runs where network exists (operator machine or box runner), not in this container | as stated (header) | If the operator's machine is the runner, the artefacts land through the same committed paths; the report's "runner" line names the host class, never a machine path |
| A12 | Licence default for a new municipal/ministry source = RESTRICTED (Crown copyright), CLEAR only with a documented open licence | as stated (R28, R10) | If the owner ratifies a source dir CLEAR, one register row changes and the "usable" column moves — no re-count of the corpus is needed |

---

## 13. NEEDS OPERATOR

The ticket is **mostly** resolvable without the operator: R1-R47 have determinate defaults and the report can be produced at zero yield. The items below are the genuine operator-only decisions. Each carries a recommended default so the pipeline never stalls.

| # | Item | Why operator-only | Recommended default (pipeline continues) |
|---|---|---|---|
| O1 | **Exa / OpenCode key provisioning** (free tier) — `EXA_API_KEY`, `OPENCODE_API_KEY`, `AGENT_REACH_ENABLED` (`src/discovery/providers/agent-reach-search.ts:17-21,36`) | Only the operator can create accounts/keys; both are ABSENT here | **Proceed keyless.** Discovery uses only keyless channels (harvester listing/sitemap/atom strategies + any operator-supplied candidate list + `gh search`). The report states that Exa/Mcporter-backed discovery was unavailable and why. If the operator later provisions keys, the existing provider (`:149-241`) can be enabled without new code |
| O2 | **Outbound network for the live fetch round** | This container has no route out (verified: `curl https://example.com` → exit 7) and the free-model pool is unreachable (exit 6) | The live round runs on the operator's machine or a network-capable box runner, using the committed scripts and paths. Round 2 ships (a) the committed candidate list, (b) the harvester changes, (c) the report generator, (d) the report. If no runner is available, the PR ships the zero-yield report and the candidate log with the blocking reason per candidate — a complete, honest round-2 artefact set |
| O3 | **Licence sign-off for new source directories** (`docs/RSA-Documents/LICENSE-REGISTER.md:1-5` — "Owner counsel decides") | Verdict is a legal posture, not a code fact | Default every new municipal/ministry/university source dir to **RESTRICTED** (Crown copyright) with the basis and licence_ref filled in; CLEAR only where a published open licence is cited in the source entry. Consequence: documents are counted as candidates but **usable = 0** until ratification. The report states this explicitly; the round does not wait for sign-off |
| O4 | **Which held-out province is test** (the ticket says "the held-out prairie province"; the code says QC+AB) | Owner intent vs code; the discovery report asserts MB (`.autoforge/discovery/report.md:35,81`) which the code contradicts (`scripts/harvest-track-a.ts:37`) | Follow the code: **QC + AB → test**. Harvest no MB documents in round 2; MB stays in the gaps table with the split-rule conflict flagged for the owner. Changing `TEST_PROVINCES` is its own ticket with a split-map migration |
| O5 | **ATIP / Track B authority** — which institutions may be asked, and by whom | Only the operator can send a government information request | Round 2 produces the gaps table and the per-family ATIP ask (province + stage + document type + body) and stops there. No request is drafted or sent; the report marks the Track B handoff as "ready, awaiting operator action" |
| O6 | **Whether the operator can supply a curated candidate URL list** (from a machine that has `agent-reach doctor` green) | Only a network-capable machine can search | Default: no. The round uses only the harvester's own discovery strategies plus committed sources. If the operator does supply a list, it lands as `docs/RSA-Documents/track-a-round2-candidates.json` with `discovery_channel` per row, and the round's yield table attributes to it normally |

---

## 14. Risks and rejection criteria

The PR is **unacceptable** if any of the following is true.

**R-1 Count inflation**
- Any coverage count that includes a row already present in `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` (304 rows) or already in the round-1 manifest (3 rows).
- The same sha256 counted in two cells, or in two source types, or in both the fetched and on-disk columns of the same table.
- A T1 or T0 document counted as an RSA sample or as coverage.
- A document with an unmapped stage (`pre-opening`, `existing`, `unknown`, `UNSTAGED`, `MULTI_STAGE`) counted as coverage.
- A hash-skipped download counted as a new document.
- `|A'|`/`|B'|` stated without the delta from 305/147, or a table whose rows do not sum to its stated denominator.

**R-2 Binary or secret in git**
- Any PDF or other binary under `docs/RSA-Documents/**` in the diff (`git ls-files docs/RSA-Documents | grep -ci '\.pdf$'` must stay 0).
- Any `.env*`, key, cookie or token in the diff or in the candidate log's URLs (query strings with credentials).
- Extracted PDF text committed in bulk (repo rule: "no bulk text to git", `docs/RSA-Documents/CLAUDE.md`).

**R-3 Rule breach**
- A fetch to a path our UA is disallowed by robots.txt (`src/discovery/robots.ts:100`), or two requests to one host inside 1 s (`src/discovery/ratelimit.ts:4`).
- A document fetched behind a login, a paywall, a CAPTCHA, or via an ATIP request.
- A fetch performed outside the harvester path (a proxy or a raw `curl` of a PDF), which bypasses robots, the hash gate and the licence gate.

**R-4 Fabricated records**
- A licence register row for a source directory that was never actually attempted (R28 requires a row per *attempted* source, with a reason if unreachable).
- A licence verdict of CLEAR without a cited open licence, or a licence row asserting a verdict the source entry does not carry.
- A manifest row whose sha256 does not appear in the candidate log, or whose `bytes`/`local_path` do not exist in the runner.
- A coverage candidate whose stage/tier was set by a model rather than by the deterministic rules (R40).
- A report number that no committed input can produce — the report must regenerate byte-identically offline (R17).

**R-5 Dishonest framing**
- A report that presents a zero-yield round as a success (no "0 new in-scope" statement, or a gap table dropped).
- A source-yield table with rows omitted for types that produced nothing (R20).
- "Downloaded then discarded" described as "never downloaded" for hash-skipped documents (R29).
- A coverage number presented without its licence-usability caveat (R10).

**R-6 Artefact churn**
- The round-1 report regenerated *and* the round-1 test left failing (`:251-252`).
- A new field in the intake manifest that breaks the manifest's existing consumers (the TSV column list `scripts/harvest-track-a.ts:41-56`, the split map, the dedupe index shape `:739-753`).
- Any change under `src/app/**` or to the runtime discovery pipeline.

**R-7 Operational**
- The 5 GB cap exceeded, or the byte accounting file missing or inconsistent with the corpus on disk.
- The round blocked waiting for an operator decision (all O1-O6 have defaults that let the round finish at zero yield).

---

## 15. Open items deliberately left to the architect (not to the operator)

1. Option A vs Option B for the round-1 report (R44) — architect picks, default A.
2. Whether the new candidate-list input is a JSON file consumed by a new `candidate-list` strategy in the harvester (smallest: a new `strategy` value reading a committed JSON, `scripts/harvest-track-a.ts:63-88` + `:264-330`) or a `known-document-url` entry per source (no code change, but the URL list then lives inside the source list and grows the file). Default: the new strategy — it keeps discovery and fetching separable and keeps the candidate log authoritative.
3. Whether French stage patterns (R32) land in `STAGE_RULES` (`scripts/harvest-track-a.ts:387-397`) or in a separate French table — architect's call; both are acceptable if the report states which.
4. Whether the byte accounting file is JSON or TSV — architect's call; the fields in R36 are mandatory either way.

---

*End of grilling. No source file was modified; nothing was committed; no live search or download was performed.*

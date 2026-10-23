# Architecture — Ticket #62: versioned stage rule set v2, corpus re-run, v2-vs-v1 coverage table, ambiguity list

- Ticket: `Akamel01/AuditorAI#62` — "Stage classifier: map real-world RSA titles to ODD stages, so T3 documents reach their cells"
- Branch/worktree: `oc/62` at `5dcaddb` ("Harvest round 2: free, wide search for public Canadian RSAs (#61)")
- Inputs: `.autoforge/discovery/report-t62.md` (read in full), `.autoforge/discovery/tracker-index-t62.md`
- Read-only design. No repo file was modified. Every structural claim below carries a `file:line`.

---

## 0. The shape of the change, in one paragraph

The stage classifier is a **harvest-time artifact only** — `scripts/harvest-track-a.ts:516-548` — and its **only production call site** is `scripts/harvest-track-a.ts:964`. The app resolves stages from an operator-selected `native_stage_id` (`src/domain/pipeline/nodes/stage-select.ts:40-56` → `src/domain/odd.ts:74-90`); **there is no text classifier in `src/`**. So #62 adds a *parallel, versioned* classifier next to v1 and never touches v1. v1 stays frozen inline in the harvester (so `tests/discovery/harvest-track-a-report.test.ts:251` and `tests/discovery/harvest-track-a-round2-report.test.ts:99` keep passing untouched); v2 lives in a new rule-set file plus a new module plus a new CLI; the v2 view of the corpus lands in a new **sidecar** under `docs/research/stage-rules/`, leaving `docs/RSA-Documents/**` byte-identical.

**Non-negotiable constraint that shapes everything:** the corpus of record holds **metadata, not bodies** — `docs/RSA-Documents/canada-intake-manifest.jsonl` has 33 rows with fields `project_id, sha256, tier, stage, cell_key, ca_province, lang, split, doc_type, source_url, licence_verdict, licence_basis, licence_ref, track, missing_side_note, title, fetched_at, bytes, local_path, source_id` and **no body text** (verified: `Object.keys(rows[0])`). The bodies are re-fetchable (discovery Q3.b: 30/33 URLs HTTP 200 with content-length == committed `bytes`; the 9 T3 rows re-download to byte-identical sha256) but they are **not in git** and must not be (`.gitignore:75` "no bulk text to git"; `.gitignore:76,79`).

---

## A1 — Rule set as code

### Decision

**Two JSON rule-set files under `docs/research/stage-rules/`, loaded by a new TS module.**

```
docs/research/stage-rules/
  stage-rules.v1.json     # frozen snapshot of scripts/harvest-track-a.ts:516-527 (4 rules + the cell map)
  stage-rules.v2.json     # the new rule set (discovery Q2.5), with per-rule evidence
  stage-rules.evidence.md # human-readable evidence table (rule id → phrase → source → page)
```

`docs/research/` is tracked today (`git ls-files docs/research` → non-empty) and **not** git-ignored — `git check-ignore -v docs/research/stage-rules/x.md` returns no match (discovery §Q4.2). Contrast `docs/RSA-Documents/**/*.pdf` (`.gitignore:79`) and `docs/RSA-Documents/canada/track-a/` (`.gitignore:76`), which stay ignored.

### Why JSON and not a TS module

| Option | Verdict |
|---|---|
| (a) JSON files under `docs/research/stage-rules/` | **Chosen.** The rule set is *data with evidence*, not behaviour. JSON is diffable, byte-stable, non-executable, and reviewable by a human who does not read TS. |
| (b) two TS modules under `scripts/` | Rejected. A "frozen v1 module" is still code: a later edit silently changes v1, which is exactly the failure mode `tests/discovery/harvest-track-a-report.test.ts:251` guards against. |
| (c) edit `scripts/harvest-track-a.ts:516-520` in place | **Rejected outright.** It changes v1's behaviour and breaks both byte-identity tests (discovery §Q4.1). |

### The file schema (one schema for v1 and v2)

```jsonc
{
  "rule_set_version": "v2",
  "frozen": false,                       // v1.json: true
  "provenance": {                        // v1.json: the exact source lines
    "source": "scripts/harvest-track-a.ts:516-527",
    "note": "Frozen snapshot of the inline STAGE_RULES array + CANONICAL_STAGE map. Do not edit."
  },
  "scan": { "body_char_cap": 200000, "scope_region_chars": 600, "title_scope": true },
  "cells": {                             // v1.json: literal copy of scripts/harvest-track-a.ts:523-527
    "FEASIBILITY_CONCEPT": "canada:FEASIBILITY_CONCEPT",
    "PRELIMINARY_DESIGN": "canada:PRELIMINARY_DESIGN",
    "DETAILED_DESIGN":   "canada:DETAILED_DESIGN",
    "PRE_OPENING": "", "EXISTING": "", "CONSTRUCTION": ""
  },
  "rules": [
    {
      "id": "CA-PRELIM",                 // stable id: the acceptance criterion "a test per new rule" is keyed on this
      "pattern": "\\bpreliminary\\s+(design|stage)\\b|...",   // regex source, no delimiters
      "flags": "i",
      "candidates": ["PRELIMINARY_DESIGN"],   // 1 = single stage; 2 = a contested pair
      "cell_key": "canada:PRELIMINARY_DESIGN",// "" for stages with no canonical cell
      "scope": "body",                   // "body" | "title"
      "contested": false,                // true when no committed source settles the mapping
      "evidence": [
        { "phrase": "draft (preliminary/layout) design",
          "source": "docs/references/CA/unb-transportation-group-rsa-guidelines.pdf",
          "page": 21 }
      ]
    }
  ]
}
```

**Evidence requirement.** Every rule carries ≥1 `evidence` entry: the **verbatim phrase**, the **source document path** (all under `docs/references/CA/`, which are committed — `docs/references/CA/MANIFEST.md:11-17` carries their sha256), and the **page**. The evidence is the discovery report's Q2.1/Q2.5 table, reused verbatim rather than re-derived.

**v1's rules, as frozen.** The four rules of `scripts/harvest-track-a.ts:516-521` transcribe 1:1, including the two known defects that v2 fixes — they are **kept** in v1 because v1 must stay behaviourally identical:

| v1 id | source line | pattern | stage |
|---|---|---|---|
| `V1-PREOPEN` | `scripts/harvest-track-a.ts:517` | `pre-?opening\|avant\s+ouverture\|en\s+service` | `PRE_OPENING` (note: `en\s+service` also matches "mise en service" — discovery Q2.2(c)) |
| `V1-DETAIL` | `scripts/harvest-track-a.ts:518` | `stage\s*3\|detailed design\|d[ée]taill[ée]e?\b` | `DETAILED_DESIGN` (note: never matches "detail design" — discovery Q2.2(a)) |
| `V1-PRELIM` | `scripts/harvest-track-a.ts:519` | `stage\s*2\|preliminary design\|pr[ée]liminaire` | `PRELIMINARY_DESIGN` |
| `V1-FEAS` | `scripts/harvest-track-a.ts:520` | `stage\s*1\|planning stage\|functional plan\|planification\|[ée]tude de faisabilit[ée]` | `FEASIBILITY_CONCEPT` |

### Where the "frozen v1 reproduces today's outputs" test lives

**`tests/discovery/harvest-stage-rules-v2.test.ts`** (a new file — see A6), `describe("frozen v1 rule set (regression lock)")`, with two offline assertions:

1. **Code-vs-data equivalence (offline, no corpus).** For a fixed string corpus — the 33 committed manifest `title` values, plus the six literals already asserted in `tests/discovery/harvest-track-a.test.ts:69-76` and `tests/discovery/harvest-track-a-round2-report.test.ts:109-120` — assert `classify(frozenV1, text, title, hint).stage === detectStage(text, hint)` where `detectStage` is imported from `../../scripts/harvest-track-a`. Also assert `frozenV1.cells` deep-equals `MANIFEST_STAGE_TO_CELL` (`scripts/harvest-track-a-report.ts:24-29`, exported) restricted to its three mapped keys.
2. **Corpus reproduction (the real lock).** For every manifest row whose body was fetched, the frozen v1 must return **exactly the committed `stage` column**. This cannot live in an offline unit test, because the corpus text is not in git (`.gitignore:75` "no bulk text to git"). It is therefore a **reported output of the re-run**: `coverage-v2-vs-v1.json` carries `v1_reproduced: {rows: 31, mismatches: []}`, and the unit test asserts that field against the committed JSON. That is the honest placement: the corpus lock is *evidence in the committed artefact*, not a test that needs the network.

---

## A2 — The decision type

```ts
// scripts/stage-rules.ts

export type CanonicalStage =
  | "FEASIBILITY_CONCEPT"
  | "PRELIMINARY_DESIGN"
  | "DETAILED_DESIGN"
  | "PRE_OPENING"
  | "EXISTING"
  | "CONSTRUCTION";

export type EvidenceScope = "scope_region" | "body" | "title" | "hint";

export type DecisionKind = "single" | "ambiguous" | "taxonomy" | "unstaged";

export interface StageRule {
  id: string;
  pattern: string;                 // regex source, no delimiters
  flags: string;                   // e.g. "i"
  candidates: CanonicalStage[];    // 1 = single stage, 2 = a contested pair
  cell_key: string;                // "" when the stage has no canonical cell
  scope: "body" | "title";         // which region the rule may fire in
  contested?: boolean;             // no committed source settles the mapping
  evidence: Array<{ phrase: string; source: string; page: number }>;
}

export interface StageCandidate {
  stage: CanonicalStage;
  cell_key: string;                // the cell this candidate maps to ("" if none)
  confidence: number;              // 0..1, deterministic, no model
  rule_ids: string[];              // auditable back to stage-rules.vN.json
  hits: number;                    // number of matching rule firings
  matched_text: string;            // first verbatim match, trimmed to <= 200 chars
  evidence_scope: EvidenceScope;   // where the evidence was found
}

export interface StageDecision {
  rule_set_version: string;        // "v1" | "v2"
  kind: DecisionKind;
  candidates: StageCandidate[];    // ordered best-first, NEVER truncated, NEVER collapsed
  primary: StageCandidate | null;  // null only when kind === "taxonomy"
  confidence: number;              // see below
  ambiguous: boolean;              // kind === "ambiguous"
  cell_key: string;                // "" unless kind === "single" and the stage has a cell
  source: EvidenceScope;           // the scope the primary came from
  title: string;
  text_chars_scanned: number;      // how much body was actually read
}
```

### The three scan regions (this is the "read the BODY not only the title" mechanism)

| region | definition | why |
|---|---|---|
| `scope_region` | the document's **own subject region** — the `SUBJECT`/`RE`/`TITLE:` line if present, else the first 600 chars (`scripts/harvest-track-a.ts:581,586-590` `subjectRegion`) | the document's own scope, vs. a taxonomy it merely lists |
| `body` | the **whole** extracted text, capped at 200 000 chars (mirrors `src/lib/extract.ts:39`) | v1's `text.slice(0, 8000)` (`scripts/harvest-track-a.ts:539`) is what hid the stage names: discovery Q2.2(e) measured 5 of 7 committed CA reference PDFs changing answer between head-8000 and full text |
| `title` | the manifest `title` column | the only signal for rows whose body cannot be fetched (e.g. `www.southampton.gov.uk`, which discovery Q3.b measured as unreachable) |
| `hint` | the source's `stage_hint` (recovered by joining the manifest `source_id` to `docs/RSA-Documents/track-a-sources.json` / `track-a-round2-sources.json`, both committed) | v1's fallback, mirrored so the comparison is apples-to-apples |

### CONFIDENCE — deterministic, ordinal, no model

```
scope_base(scope_region) = 0.90
scope_base(body)         = 0.70
scope_base(title)        = 0.50
scope_base(hint)         = 0.30

dominance_bonus(c) = 0.10  if c.hits >= 2 * runner_up.hits AND runner_up.hits > 0
                   = 0.00  otherwise

candidate.confidence = clamp(scope_base(scope) + dominance_bonus, 0.01, 0.99)

decision.confidence  = kind === "single"    ? primary.confidence
                     : kind === "ambiguous" ? min(primary.confidence, 0.49)
                     : kind === "taxonomy"  ? 0
                     : (unstaged)           ? 0.30      // the hint
```

Rationale: an ordinal tier by evidence source (scope > body > title > hint) as the ticket asks, plus a **dominance** bonus for a stage that out-hits the runner-up by 2× (the same ratio the discovery prototype used, Q2.6), plus an explicit **ambiguity cap** so "one confident stage" (≥0.50) is distinguishable from "best of an unresolved pair" (<0.50). No float arithmetic beyond two decimal places; no randomness; no model.

### The decision kinds

| kind | condition | cell | ticket compliance |
|---|---|---|---|
| `single` | exactly one distinct stage candidate, **or** one dominant candidate (top hits ≥ 2× runner-up) | the candidate's cell | — |
| `ambiguous` | ≥2 distinct stage candidates and no dominance | `""` — **no cell is forced** | "record BOTH candidates and a confidence, never force a single stage" |
| `taxonomy` | ≥3 distinct stage candidates **and** zero `scope_region` hits | `""` | the document *enumerates* the stage taxonomy, it is not staged at one stage (discovery §Q5.3(b)); all candidates still recorded |
| `unstaged` | zero candidates | the hint's cell (usually `""`) | v1-compatible fallback |

**Tie rule (deterministic ordering of `candidates`).** Sort by `(a) -confidence`, `(b) -hits`, `(c) the rule-set's declared rule order` (the JSON lists the most specific rule first, per discovery Q2.5), `(d) stage name, ASCII`. Two candidates with equal hits and equal scope therefore never tie.

---

## A3 — Ambiguity without breaking v1

### The sidecar

`docs/research/stage-rules/ambiguous-v2.jsonl` — **one JSON object per manifest row (33 rows)**, so the coverage table is derivable from the sidecar alone (discovery §Q5.2). Rows with `ambiguous: true` are the ticket's AC3 list; the same rows are rendered as a markdown table inside the coverage document.

```jsonc
{
  "sha256": "2ea94190b6df90060009794589689884d0db779299cc99ee5dcd1e8887c2602e",
  "title": "Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference…",
  "tier": "T3",
  "ca_province": "NB",
  "rule_set_version": "v2",
  "stage_v1": "PRE_OPENING",
  "cell_key_v1": "",
  "kind": "ambiguous",
  "candidates": [
    { "stage": "EXISTING",        "cell_key": "", "confidence": 0.70, "rule_ids": ["CA-EXISTING"], "hits": 9, "evidence_scope": "body", "matched_text": "post-opening (including existing or in-service facilities)" },
    { "stage": "PRE_OPENING",     "cell_key": "", "confidence": 0.70, "rule_ids": ["CA-PREOPEN"],  "hits": 1, "evidence_scope": "body", "matched_text": "pre-opening" },
    { "stage": "DETAILED_DESIGN", "cell_key": "canada:DETAILED_DESIGN", "confidence": 0.70, "rule_ids": ["CA-DETAIL"], "hits": 1, "evidence_scope": "body", "matched_text": "detail design" }
  ],
  "primary": { "stage": "EXISTING", "...": "..." },
  "confidence": 0.49,
  "ambiguous": true,
  "cell_key_v2": "",
  "body_available": true,
  "text_chars_scanned": 30021,
  "evidence_scope_used": "body"
}
```

### Files that are NOT modified, and why

| File | Why untouched |
|---|---|
| `docs/RSA-Documents/canada-intake-manifest.jsonl` | the committed v1 record of 33 rows; `stage`/`cell_key` are the **v1 view**. Changing them invalidates every row against `docs/RSA-Documents/corpus-schema.json:14-17` (whose `stage` enum is `["PRELIMINARY_DESIGN","DETAILED_DESIGN","FEASIBILITY_CONCEPT"]`) and both committed reports. |
| `docs/RSA-Documents/corpus-schema.json`, `corpus-schema.md` | the schema for the v1 manifest (`:14-17`). |
| `docs/RSA-Documents/track-a-harvest-report.md`, `track-a-round2-harvest-report.md`, `track-a-coverage.md`, `track-a-split.json`, `canadian-download-log.tsv` | byte-frozen v1 artefacts; `scripts/harvest-track-a-report.ts:25-29` and `scripts/harvest-track-a-round2-report.ts:251` index the manifest stage vocabulary. |
| `scripts/harvest-track-a.ts` | **not edited at all.** v1's `STAGE_RULES` (`:516-521`), `CANONICAL_STAGE` (`:523-527`), `detectStageWithSource` (`:534-546`), `detectStage` (`:547`), `detectLang` (`:551`), `detectProvince` (`:557`) stay exactly as they are. This is what keeps `tests/discovery/harvest-track-a-report.test.ts:251` and `tests/discovery/harvest-track-a-round2-report.test.ts:99` green without touching a single test file. |
| `policies/canada/pack.json` | cell doctrine is policy; `src/domain/odd.ts:74-90` reads it. Out of scope (ticket + discovery §Q7.1.3). |
| `src/domain/**` | the app has **no** text classifier: `src/domain/pipeline/nodes/stage-select.ts:40-56` resolves an operator-selected `native_stage_id` and `src/domain/odd.ts:74-90` matches a canonical-stage multiset. Changing the harvester cannot change app behaviour. |
| `state/odd-coverage.json` | derived from `state/discovery-ledger.json` by `scripts/discovery-coverage.ts:21,50`, **not** from the manifest (`grep -rn "canada-intake-manifest" src/ scripts/` matches only the harvest scripts). |
| `docs/references/CA/**` | read-only evidence sources for the rule file. |
| `package.json` | no new dependency: `unpdf` is already there (`package.json:31`, used at `scripts/harvest-track-a.ts:19,924`). |

**Consequence:** `stage` and `cell_key` remain plain strings everywhere. The 12+ consumers listed in discovery §Q1.3 (e.g. `scripts/harvest-track-a.ts:1011`, `scripts/harvest-track-a-report.ts:25-29,320-323,541-545`) keep working unchanged.

---

## A4 — The re-run pipeline

### New script

`scripts/harvest-stage-rules-v2.ts` — two subcommands, `fetch` and `compare`.

```
npx tsx scripts/harvest-stage-rules-v2.ts fetch \
  --manifest docs/RSA-Documents/canada-intake-manifest.jsonl \
  --cache    docs/RSA-Documents/canada/track-a/t62/ \
  [--tier T3] [--limit N] [--timeout-ms 30000]

npx tsx scripts/harvest-stage-rules-v2.ts compare \
  --rules   docs/research/stage-rules/stage-rules.v2.json \
  --compare docs/research/stage-rules/stage-rules.v1.json \
  --manifest docs/RSA-Documents/canada-intake-manifest.jsonl \
  --cache    docs/RSA-Documents/canada/track-a/t62/ \
  --out       docs/research/stage-rules/coverage-v2-vs-v1.md \
  --json-out  docs/research/stage-rules/coverage-v2-vs-v1.json \
  --ambiguous-out docs/research/stage-rules/ambiguous-v2.jsonl
```

- `--rules` **defaults to v2** (`docs/research/stage-rules/stage-rules.v2.json`).
- `--compare` names the **other** rule set; the same run classifies every row under **both** and emits the v2-vs-v1 comparison. `--compare` defaults to the frozen v1.
- `compare` **never touches the network**. If a body is missing from `--cache`, the row is classified from its **title** only and is marked `body_available: false` in the outputs. That is the offline mode (A8 risk 6).

### Corpus cache — under the gitignored path

`docs/RSA-Documents/canada/track-a/t62/<sha256>.pdf` — inside `docs/RSA-Documents/canada/track-a/`, which is git-ignored at `.gitignore:76`. Nothing lands in the commit. `git status --porcelain` must show no new tracked file after a fetch (module M4's done-criterion).

### The committed harvest constraints are reused verbatim, not re-implemented

| constraint | where it lives | how v2 reuses it |
|---|---|---|
| "public/free/no-login only, robots.txt honoured, at most 1 request/second per host" | `scripts/harvest-track-a.ts:9-11` (header comment) | same imports at `scripts/harvest-track-a.ts:20-21` |
| robots gate | `src/discovery/robots.ts` — `robotsFor`, `isAllowed`, `crawlDelayMs`, `HARVEST_USER_AGENT` | same call order as `scripts/harvest-track-a.ts:762-788`: robots check → crawl delay → fetch |
| 1 req/s per host, max 2 concurrent | `src/discovery/ratelimit.ts:1-6,29-47` (`MIN_INTERVAL_MS = 1000`, `MAX_CONCURRENT_PER_HOST = 2`) | `withHostBudget(url, () => fetch(url, {headers:{"user-agent":HARVEST_USER_AGENT}}))` |
| PDF text extraction | `scripts/harvest-track-a.ts:19` (`import { extractText, getDocumentProxy } from "unpdf"`), `:920-925` | `getDocumentProxy(bytes.slice())` then `extractText(pdf, {mergePages:true})` |

### Function boundaries (so a reviewer can unit-test the classifier without the network)

`scripts/stage-rules.ts` — **pure** (no `fs`, no `fetch`):

| function | purity | role |
|---|---|---|
| `loadRuleSet(json: unknown): RuleSet` | pure | parse + validate a rule-set object; reject duplicate ids, rules without evidence, rules with an empty `candidates` array |
| `compileRules(rs: RuleSet): CompiledRule[]` | pure | `new RegExp(pattern, flags)`; preserve declared rule order (the tie-break key) |
| `classifyDocument(input, compiled): StageDecision` | **pure** | the whole classifier: scope region → body → title → hint; candidates, hits, matched_text, confidence, kind, cell |
| `classifyV1(text, hint): {stage, source}` | pure | the frozen-v1 semantics, expressed against the **frozen v1 JSON** (not by importing the harvester) so the lock test is code-vs-data |

`scripts/harvest-stage-rules-v2.ts` — **I/O**:

| function | role |
|---|---|
| `readManifest(path): ManifestRow[]` | read the committed manifest, sorted by `sha256` |
| `resolveHint(sourceId): string` | join `source_id` → the committed sources files' `stage_hint`; `"UNSTAGED"` when the id is unknown (e.g. `r2-direct`, which is **not** in `docs/RSA-Documents/track-a-round2-sources.json` — verified) |
| `fetchCorpus(rows, cacheDir): FetchReport` | the **only** network function; robots + host budget + sha256 verify; per-row failure tolerated |
| `extractPdfText(bytes): Promise<string>` | `unpdf` |
| `classifyCorpus(rows, cacheDir, ruleSets): CorpusResult[]` | fs only; reads cached bodies, classifies under each rule set, records `body_available` |
| `renderCoverageTable(result): string` | pure; renders the markdown from the JSON-shaped result |
| `renderAmbiguousJsonl(result): string` | pure; renders the sidecar |
| `renderCoverageJson(result): string` | pure; renders the machine-readable companion |

### Determinism

- Manifest rows are sorted by `sha256` before anything else.
- `candidates` sorted by the tie rule in A2.
- Rule-set sha256 and manifest sha256 are recorded in the JSON companion.
- **No timestamp, no absolute path, no hostname** in any output (precedent: `scripts/harvest-track-a-report.ts:357` "This report carries no timestamp"; `tests/discovery/harvest-track-a-round2-report.test.ts:103`).
- The committed markdown is exactly `renderCoverageTable(committedJson)` — so byte-stability is testable **offline** (A6, test iii).

---

## A5 — The coverage table

### Where it is written

```
docs/research/stage-rules/coverage-v2-vs-v1.md      # the human table
docs/research/stage-rules/coverage-v2-vs-v1.json    # the machine-readable companion
docs/research/stage-rules/ambiguous-v2.jsonl        # the ambiguity sidecar (A3)
```

**Not** under `docs/RSA-Documents/**` — that tree is the committed v1 record of the corpus and the ticket forbids changing it. `docs/research/` is not git-ignored (discovery §Q4.2).

### Structure (8 sections, fixed order)

**§1 — Scope and denominators.** States: corpus of record = `docs/RSA-Documents/canada-intake-manifest.jsonl`, **33 rows**; **9 T3 / 24 T1**; **12 rows carry a `ca_province`** (21 do not — the `r2-ea-study` UK Environment Agency rows, `r2-ministry`, and the 5 `r2-direct` UK planning-register rows); rule-set versions + their sha256; bodies fetched *n*/33; rows classified from title only.

**§2 — ODD cell coverage (T3 only — the coverage denominator).**

| ODD cell | v1 | v2 (primary) | v2 (incl. ambiguous) | moved in | moved out |
|---|---|---|---|---|---|
| `canada:FEASIBILITY_CONCEPT` | 3 | … | … | … | … |
| `canada:PRELIMINARY_DESIGN` | 1 | … | … | … | … |
| `canada:DETAILED_DESIGN` | 0 | … | … | … | … |
| *(no cell)* | 5 | … | … | … | … |

Denominator = the **9 T3 rows**, because "T0 and T1 never count as coverage" (`scripts/harvest-track-a-report.ts:363`). v1 numbers are the committed manifest's own values (measured: T3 cells = FEASIBILITY ×3, PRELIMINARY ×1, none ×5; all rows = FEASIBILITY ×10, PRELIMINARY ×3, none ×20, DETAILED ×0).

**§3 — All rows by cell (33).** The same table over every tier, for completeness.

**§4 — Movement detail (33 rows).**

| sha256 (12) | tier | province | title | v1 stage | v1 cell | v2 kind | v2 primary | v2 candidates | v2 cell | moved |
|---|---|---|---|---|---|---|---|---|---|---|

**§5 — Ambiguity (AC3).** Only rows with `ambiguous: true`:

| sha256 (12) | title | candidate 1 (stage · confidence · rule ids) | candidate 2 (…) | n | cell if adjudicated at candidate 1 |
|---|---|---|---|---|---|

**§6 — No-cell buckets.** `PRE_OPENING` / `EXISTING` / `CONSTRUCTION` / `TAXONOMY` / `AMBIGUOUS` / `UNSTAGED` — counts + a one-line note each ("`EXISTING` has no canonical cell: `policies/canada/pack.json:75-89`").

**§7 — Caveats.** The three lines in A9.

**§8 — Reproduction.** The exact `fetch` + `compare` commands and the sha256 of the two rule files.

### How "moved" is defined

**Primary metric: cell-level.** `moved ⇔ v1_cell_key ≠ v2_cell_key`.

Justification: the ticket asks "how many documents move into which cells"; the cell is the unit the app consumes (`src/domain/odd.ts:74-90`, `src/app/dev/mission-control/_components/odd-matrix.tsx:34-47,138`); and the stage token is only a *means* to a cell (`CANONICAL_STAGE`, `scripts/harvest-track-a.ts:523-527`) — the three mapped stages map 1:1 onto three distinct cells, so stage-movement and cell-movement coincide **except** for the no-cell bucket (`PRE_OPENING` → `EXISTING` is a stage change with no cell change). Reporting only the stage diff would hide that; reporting only the cell diff would hide it too. **Both are reported:** §4 carries `v1 stage → v2 primary stage` alongside the cell move, and §6 carries the no-cell buckets.

**Ambiguous documents are counted two ways, on purpose.** An ambiguous document is assigned **no cell** (`cell_key = ""`) — the ticket forbids forcing a stage, and a cell is a stage. But dropping it silently would understate coverage, so §2/§3 show three counts per cell: `v1`, `v2 (primary)` (ambiguous excluded) and `v2 (incl. ambiguous)` (each ambiguous document counted at its **primary candidate's** cell). The difference between the last two columns is **exactly** the set of documents a human must adjudicate — which is the ticket's own point.

### Machine-readable companion

`docs/research/stage-rules/coverage-v2-vs-v1.json`:

```jsonc
{
  "rule_sets": { "v1": { "path": "...", "sha256": "..." }, "v2": { "path": "...", "sha256": "..." } },
  "manifest": { "path": "docs/RSA-Documents/canada-intake-manifest.jsonl", "sha256": "...", "rows": 33 },
  "bodies": { "fetched": 31, "unavailable": 2, "unavailable_rows": [ { "sha256": "...", "reason": "connect-failed" } ] },
  "denominators": { "all_rows": 33, "t3_rows": 9, "canadian_rows": 12 },
  "cells": [ { "cell_key": "canada:FEASIBILITY_CONCEPT", "v1": 10, "v2_primary": 0, "v2_incl_ambiguous": 0, "moved_in": 0, "moved_out": 0 } ],
  "no_cell": [ { "label": "EXISTING", "count": 0 } ],
  "v1_reproduced": { "rows": 31, "mismatches": [] },
  "rows": [ { "sha256": "...", "tier": "T3", "ca_province": "AB", "title": "PLANNING STAGE",
              "v1_stage": "FEASIBILITY_CONCEPT", "v1_cell": "canada:FEASIBILITY_CONCEPT",
              "v2_kind": "single", "v2_primary_stage": "FEASIBILITY_CONCEPT", "v2_cell": "canada:FEASIBILITY_CONCEPT",
              "v2_confidence": 0.9, "v2_candidates": [ ... ], "body_available": true, "text_chars_scanned": 12345,
              "moved": false } ]
}
```

The JSON is the **input** to `renderCoverageTable` (A4), so the markdown and the JSON can never disagree: they are two renderings of one value.

---

## A6 — Test plan

**One new file: `tests/discovery/harvest-stage-rules-v2.test.ts`.** A new file is cleaner than editing the existing ones because:

1. The v1 tests keep proving v1 is frozen **untouched** — `tests/discovery/harvest-track-a-report.test.ts:251` and `tests/discovery/harvest-track-a-round2-report.test.ts:99` are the guards, and editing the file that holds them risks weakening them.
2. The v2 module is a different module with a different vocabulary; importing both into one suite muddies which contract is under test (discovery §Q6.2).
3. **Ownership:** `git log --format='%h %ad %an %s' -- tests/discovery/harvest-track-a*.test.ts scripts/harvest-track-a*.ts` returns only `5dcaddb` (Ahmed Kamel, #61) and `3bd03d5` (Ahmed Kamel, #58); `git branch -a` shows no other branch touching them. ⇒ no lane collision, and no reason to edit files another lane's PR just touched.

| # | test | file / describe | asserts | offline? |
|---|---|---|---|---|
| i | **one test per v2 rule, keyed by rule id** | `describe("v2 rules")` + `it.each` over the rule ids read from `stage-rules.v2.json` | for each rule id: (a) the rule matches the **verbatim phrase its own `evidence[0].phrase` cites**; (b) the `evidence[0].source` file exists under `docs/references/CA/` and `evidence[0].page` ≤ that PDF's page count (`getDocumentProxy` from `unpdf`, `scripts/harvest-track-a.ts:19` — page count only, no text extraction, so it is fast); (c) the decision produced from (real corpus title + that phrase) carries the rule id in `candidates[].rule_ids`; (d) the title used is a **real committed corpus title** — the test reads `docs/RSA-Documents/canada-intake-manifest.jsonl` and asserts the title it used is present there | ✅ |
| i′ | title-scoped rules | same file | the rules whose `scope: "title"` fire on a corpus title **alone**: `CA-PREOPEN` ← row 9 "WAITEMATA GREENWAYS PRE-OPENING"; `CA-DETAIL` ← row 13 "CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project"; `CA-FEAS` ← row 1 "PLANNING STAGE" and row 19 "Stage 1 Road Safety Audit"; the pair rule ← row 33 "COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS' RESPONSE" (two candidates) | ✅ |
| ii | **frozen v1 regression lock** | `describe("frozen v1 rule set")` | (a) code-vs-data: `classify(frozenV1, t, t, hint).stage === detectStage(t, hint)` for all 33 manifest titles + the 6 literals already asserted in `tests/discovery/harvest-track-a.test.ts:69-76` and `tests/discovery/harvest-track-a-round2-report.test.ts:109-120`; (b) `frozenV1.cells` ≡ `MANIFEST_STAGE_TO_CELL` (`scripts/harvest-track-a-report.ts:24-29`); (c) the committed `coverage-v2-vs-v1.json.v1_reproduced.mismatches` is empty and `v1_reproduced.rows` == `bodies.fetched` | ✅ (a,b,c — the corpus part is asserted through the committed artefact) |
| iii | **the v2 coverage table is byte-stable and matches the companion** | `describe("coverage table")` | `renderCoverageTable(JSON.parse(readFileSync("docs/research/stage-rules/coverage-v2-vs-v1.json")))` **byte-equals** the committed `coverage-v2-vs-v1.md`; the table carries no timestamp (`/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/`); the JSON's `cells[].v1` equals the counts measured from the committed manifest (3/1/0/5 for T3; 10/3/0/20 for all rows) | ✅ |
| iv | **ambiguity carries two candidates and a confidence** | `describe("ambiguity")` | (a) a synthetic two-stage input yields `kind === "ambiguous"`, `candidates.length >= 2`, `confidence <= 0.49`, `cell_key === ""`; (b) every row of the committed `ambiguous-v2.jsonl` with `ambiguous: true` has `candidates.length >= 2`, each candidate has `confidence ∈ (0,1]`, a non-empty `rule_ids`, and a `matched_text`; (c) every row with `ambiguous: false` has `kind !== "ambiguous"` | ✅ |
| v | **the existing byte-identity tests still hold** | `tests/discovery/harvest-track-a-report.test.ts:251`, `tests/discovery/harvest-track-a-round2-report.test.ts:99` (plus `:103` no-timestamp, `tests/discovery/harvest-track-a.test.ts:68-89`, `tests/discovery/harvest-track-a-round2-report.test.ts:108-121`) | **not edited by #62** — they keep passing because `scripts/harvest-track-a.ts` is not touched at all | ✅ |

**Commands that prove it:**

```bash
npm run lint && npm run typecheck
npx vitest run tests/discovery/harvest-stage-rules-v2.test.ts
npx vitest run tests/discovery/harvest-track-a.test.ts \
                tests/discovery/harvest-track-a-report.test.ts \
                tests/discovery/harvest-track-a-round2-report.test.ts
npm run test     # the whole suite
```

**Corpus text is not committed.** The repo's doctrine is explicit: `.gitignore:75` "Track A corpus binaries (ticket #40): no bulk text to git". So the v1 corpus reproduction is asserted **through the committed JSON artefact** (test ii(c)), not through a committed text fixture. The **rule evidence** tests read the *committed* CA reference PDFs (`docs/references/CA/*.pdf`, sha256 in `docs/references/CA/MANIFEST.md:11-17`), which are committed by design and are not covered by `.gitignore:79` (that rule is `docs/RSA-Documents/**/*.pdf`).

---

## A7 — Module boundaries and parallelism

| M | purpose | files created / edited | `touches` | `blocked_by` | done when |
|---|---|---|---|---|---|
| **M1** | frozen v1 + new v2 rule sets + the human evidence table | `docs/research/stage-rules/stage-rules.v1.json`, `docs/research/stage-rules/stage-rules.v2.json`, `docs/research/stage-rules/stage-rules.evidence.md` | `docs/research/stage-rules/stage-rules.*` | — | every rule has `id`, `pattern`, `flags`, `candidates`, `evidence[{phrase,source,page}]`; ids unique; `node -e "JSON.parse(require('fs').readFileSync(p))"` passes for both; every `evidence.source` exists on disk |
| **M2** | the classifier module + its unit tests | `scripts/stage-rules.ts`, `tests/discovery/harvest-stage-rules-v2.test.ts` | `scripts/stage-rules.ts`, `tests/discovery/harvest-stage-rules-v2.test.ts` | M1 | `npx vitest run tests/discovery/harvest-stage-rules-v2.test.ts` green (tests i, ii-a, ii-b, iv-a); `npm run lint && npm run typecheck` clean (both `scripts/` and `tests/` are covered: `tsconfig.json` includes `**/*.ts`; `eslint.config.mjs:4` ignores only build output) |
| **M3** | the re-run CLI (fetch + compare) | `scripts/harvest-stage-rules-v2.ts` | `scripts/harvest-stage-rules-v2.ts` | M2 | `npx tsx scripts/harvest-stage-rules-v2.ts compare --cache <empty-dir>` exits 0 and writes the outputs with `bodies.fetched: 0` and `unavailable: 33` — i.e. it degrades honestly offline; `npm run lint && npm run typecheck` clean |
| **M4** | fetch the corpus into the gitignored cache, verify sha256 | *(writes only)* `docs/RSA-Documents/canada/track-a/t62/**` — **nothing committed** | `docs/RSA-Documents/canada/track-a/t62/**` | M3 | ≥31/33 rows cached with `sha256` == the manifest `sha256` column; the 2 known-bad hosts are reported, not fatal; `git status --porcelain` shows **no** new tracked file (`git check-ignore -v docs/RSA-Documents/canada/track-a/t62/x.pdf` → `.gitignore:76`) |
| **M5** | the coverage table, its JSON companion and the ambiguity sidecar | `docs/research/stage-rules/coverage-v2-vs-v1.md`, `docs/research/stage-rules/coverage-v2-vs-v1.json`, `docs/research/stage-rules/ambiguous-v2.jsonl` | `docs/research/stage-rules/coverage-v2-vs-v1.*`, `docs/research/stage-rules/ambiguous-v2.jsonl` | M1, M3, M4 | the committed `.md` byte-equals `renderCoverageTable(committed .json)`; the `.json`'s `rows.length === 33`; `v1_reproduced.mismatches` is empty; the three caveats are present verbatim |
| **M6** | the human write-up (the ticket's answer) | `docs/research/stage-rules/README.md` | `docs/research/stage-rules/README.md` | M5 | the README states the denominators (33/9/12), the three caveats, the exact reproduction commands, and the honest coverage-impact statement of A9 |

### Parallel-safety

- **M1, M2, M3 form a chain** (data → module → CLI). Everything else hangs off it.
- **M4 and M5 cannot run concurrently**: M4 writes the cache dir that M5 reads. Sequenced by `blocked_by`.
- **M1 and M5 write the same *directory* but disjoint *files*** (`stage-rules.*` vs `coverage-v2-vs-v1.*` vs `ambiguous-v2.jsonl`). `mkdirSync(dir, {recursive:true})` makes the directory creation itself safe; M5 is also `blocked_by: M1` because it loads the rule files.
- **M6 writes `docs/research/stage-rules/README.md`** — disjoint from every other module's globs.
- **Shared state that forces sequencing:** (1) the corpus cache dir `docs/RSA-Documents/canada/track-a/t62/` (M4 writes, M5 reads); (2) the rule files (M1 writes, M2/M3/M5 read); (3) **nothing else** — `state/odd-coverage.json` is *not* touched (it comes from `state/discovery-ledger.json` via `scripts/discovery-coverage.ts:21,50`), and `docs/RSA-Documents/canada-intake-manifest.jsonl` is **read-only** for every module.
- **No module touches `scripts/harvest-track-a.ts`** or any of the three existing harvest test files ⇒ the v1 lane (`#58`, `#61`) is untouched.

---

## A8 — Risks and non-goals

### Must NOT change (non-goals)

| Path | Reason |
|---|---|
| `docs/RSA-Documents/**` | the committed corpus of record, its schema (`corpus-schema.json:14-17`), and the two byte-frozen reports. The ticket forbids it and the v1 comparison needs it intact. |
| `policies/canada/pack.json` | cell doctrine. `ca-tac:pre-opening` has `canonical_stages: []` and `mvp_scope: false` (`:80-82`); there is no `existing`/`construction` cell. Changing it is a **policy** decision (separate ticket, see A9). |
| `src/domain/**` | the app has no text classifier (`src/domain/odd.ts:74-90`, `src/domain/pipeline/nodes/stage-select.ts:40-56`). |
| `state/odd-coverage.json` | derived from the discovery ledger, not from the manifest. |
| `scripts/harvest-track-a.ts` | v1 stays exactly as it is. |
| `docs/references/CA/**` | read-only evidence. |
| `package.json` | no new dependency (`unpdf` already at `:31`). |
| The app / the ODD matrix | out of scope; the ODD-matrix gap is a separate ticket (A9). |

### The five highest technical risks

| # | risk | evidence | mitigation |
|---|---|---|---|
| R1 | **Network is an allowlist proxy and two hosts are dead.** `curl https://example.com` fails (exit 7) while the corpus hosts succeed; `consult.kerrycoco.ie` → 403, `www.southampton.gov.uk` → connect failed (discovery §Q7.2, Q3.b). The dead host carries manifest row 33 — the flagship "COMBINED STAGE 1 AND 2" ambiguity case. | discovery Q3.b | `fetch` tolerates a per-row failure and records it; `compare` classifies that row from its **title** only (`evidence_scope: "title"`, confidence 0.50); the outputs state `bodies.fetched: 31/33` so a partial run cannot masquerade as a full one; the whole pipeline is re-runnable offline from the cache. |
| R2 | **Corpus drift** — a URL may serve different bytes than the committed `sha256`. | the manifest carries `sha256` and `bytes` per row | `fetch` verifies the sha256 against the committed manifest; a mismatch is recorded as `sha-mismatch`, the row is **excluded** from the v2 classification (not silently re-classified), and the mismatch is listed in §1 of the table. |
| R3 | **False positives from prose.** "final design", "existing", "functional plan", "planning" are common words; the discovery prototype put the Transitway document in `canada:DETAILED_DESIGN` on the single prose hit "the responsibility for the **final design** … rests with the Owner" (discovery §Q7.2). | discovery §Q7.2 | no rule matches a bare adjective: every v2 rule requires stage context (`existing (road|highway|corridor) audit`, `preliminary design stage`, `plans et devis définitifs`, …); the `scope_region` vs `body` split means a prose hit in the middle of a guideline is a **body** hit (0.70) and the `taxonomy` kind refuses it a cell; per-rule tests pin each rule to its cited phrase. |
| R4 | **Coverage regression, not gain.** 13 of 33 committed rows are `MULTI_STAGE` today; reading the whole body (§2.2(e)) *increases* multi-stage hits, and an ambiguous document gets **no** cell. v2 can therefore show **fewer** documents in cells than v1 (discovery §Q7.1.4). | discovery §Q7.1.4 | the table reports `v1`, `v2 (primary)` **and** `v2 (incl. ambiguous)` per cell; §4 shows every individual move in both directions; the caveats state it plainly. The output cannot claim a net gain it did not produce. |
| R5 | **Corpus text leaking into the commit.** 48.88 MB of PDFs (33 rows, measured) + extracted text. | `.gitignore:75-79`; discovery Q3.c | the cache lives at `docs/RSA-Documents/canada/track-a/t62/` (`.gitignore:76`); no corpus text is committed (doctrine: `.gitignore:75`); the only committed artefacts are the rule files, the table, the JSON companion and the sidecar; M4's done-criterion is `git status --porcelain` clean. |

*(a sixth, lower, risk: the `.autoforge/` tree is git-excluded in this checkout — `.git/info/exclude:7:.autoforge/` — so `git add -f` is needed for the curated architecture/discovery files; the v2 *deliverables* deliberately live under `docs/research/` instead, which is not ignored.)*

---

## A9 — The coverage-impact truth

### What the corpus actually contains (measured from the committed files)

| fact | value | source |
|---|---|---|
| manifest rows | 33 | `docs/RSA-Documents/canada-intake-manifest.jsonl` |
| tier split | 9 T3 / 24 T1 | same |
| rows with a `ca_province` | **12 of 33** | same (21 have none: 13 `r2-ea-study` UK Environment Agency, 3 `r2-ministry`, 5 `r2-direct` UK planning registers) |
| Canadian **and** T3 | **3 rows**: AB "PLANNING STAGE", ON "Transitway Station Design", NB "Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference…" | same |
| v1 cell occupancy (all 33) | `canada:FEASIBILITY_CONCEPT` **10**, `canada:PRELIMINARY_DESIGN` **3**, `canada:DETAILED_DESIGN` **0**, no cell **20** | same |
| v1 cell occupancy (T3 only) | `canada:FEASIBILITY_CONCEPT` **3**, `canada:PRELIMINARY_DESIGN` **1**, no cell **5** | same |
| licence verdicts | 32 `RESTRICTED`, 1 `CLEAR` | same (the repo still counts RESTRICTED candidates — `scripts/harvest-track-a-report.ts:374`) |
| Canadian T3/T4 pool on the operator's disk | **30 rows: `existing` 22, `unknown` 5, `detailed` 2, `pre-opening` 1** | `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` |
| cells for `existing` / `construction` | **none** — `ca-tac:pre-opening` has `canonical_stages: []`, `mvp_scope: false` | `policies/canada/pack.json:75-89` |

### The honest expected effect of v2 on the coverage table

1. **The coverage numbers barely move, and may shrink.** Only **3 of 33** rows are both Canadian and T3 — the only rows that can occupy a coverage cell. v1 already puts 2 of them in cells (AB "PLANNING STAGE" → `canada:FEASIBILITY_CONCEPT`; ON "Transitway Station Design" → none) and the third (NB conference proceedings) in none (`PRE_OPENING`). So the *maximum* possible cell movement inside the coverage denominator is **3 documents**, and one of the three (the Transitway document) **names no stage at all** — 91 794 characters with zero occurrences of "stage", "preliminary", "detailed", "feasibility" or "pre-opening" (discovery Q2.4). Its honest v2 verdict is "names no stage" — an empty candidate list, not a cell.
2. **The real gain is correctness and auditability, not coverage.** The 13 `MULTI_STAGE` rows stop being a single opaque token and become candidate lists with rule ids and confidences; the UNB paper's wrong `PRE_OPENING` label (caused by `en\s+service` matching "mise en service", `scripts/harvest-track-a.ts:517`) becomes a four-candidate record; the `canada:DETAILED_DESIGN` cell, which holds **0** documents today, can at least be *measured* rather than silently empty.
3. **22 of the 30 Canadian T3/T4 documents on the operator's disk are `existing` audits with no cell to move into.** A perfect classifier produces **zero** new coverage for them. That is a **policy gap, not a classifier gap** (discovery §Q7.1.3) and the ticket says not to touch `policies/`.

### Proposed caveat lines (verbatim, to appear in §7 of the coverage document)

> **Caveat 1 — this is a re-labelling, not new coverage.** The corpus of record is the 33 committed manifest rows (`docs/RSA-Documents/canada-intake-manifest.jsonl`): 9 tier-T3, 24 tier-T1, and only **12 rows carry a `ca_province`**. Only tier T3/T4 counts as coverage (`scripts/harvest-track-a-report.ts:363`), and only **3 of the 33 rows are Canadian and T3**. Every number below is a change to how an *existing* document is labelled, not a document that entered the corpus. The largest Canadian pool — 22 of the 30 Canadian T3/T4 documents on the operator's inventory — is in-service/`existing` audits, and `policies/canada/pack.json:75-89` defines no canonical cell for `existing` or `construction`, so a correct classifier still yields **zero** new coverage for them.

> **Caveat 2 — an ambiguous document has no cell, and is counted both ways.** A document that names two stages is recorded with **both** candidates and a confidence and is assigned no cell. The "v2 (primary)" column excludes such documents; the "v2 (incl. ambiguous)" column counts each at its primary candidate's cell. The gap between the two columns is exactly the set of documents a human must adjudicate.

> **Caveat 3 — a row can lose a cell.** v1 collapsed every multi-stage document to `MULTI_STAGE` (no cell). Under v2 some of those resolve to a single stage and gain a cell; others resolve to a genuinely ambiguous pair, or to a document that enumerates the stage taxonomy, and keep no cell. Both directions are itemised in §4. Rows also carry a licence state of 32 `RESTRICTED` / 1 `CLEAR`; a RESTRICTED document is counted but is **not usable for train or test** until the owner signs off (`scripts/harvest-track-a-report.ts:374`).

### Does the ODD-matrix gap need a separate ticket?

**Yes — and it should be filed, but not designed here.** Three follow-ups are needed, all *policy*, all outside #62:

1. **"Add `EXISTING` / `CONSTRUCTION` canonical stages and Canadian cells to `policies/canada/pack.json`."** This is the actual coverage bottleneck: 22 of 30 Canadian T3/T4 documents sit in `existing` with no cell. #62 measures it; it does not fix it.
2. **"Rule on the contested stage vocabulary."** Three mappings are unsettled by any committed source and must be human-ruled before the v2 rules are final: "Functional Plan" (v1 says `FEASIBILITY_CONCEPT` at `scripts/harvest-track-a.ts:520`, `policies/canada/pack.json:43` says `PRELIMINARY_DESIGN`; pinned by `tests/discovery/harvest-track-a.test.ts:70`), "Concept design" (Good Roads p12/p43), and "avant-projet préliminaire" (QC p10/p12). Until they are ruled, v2 must ship them as **`contested: true` rules that emit a two-candidate pair** — which is exactly the ticket's "never force a single stage" requirement, and is why the ambiguity machinery is the safe interim.
3. **"Decide whether asset-type cues may classify a document that names no stage."** The ticket's example cues ("station / corridor / functional design") are **asset types, not stages**; "corridor" and "functional design" appear in no committed Canadian reference document as a stage term, and the Transitway document names no stage (discovery §Q2.4, §Q7.1.1). Under this design the answer is **no** — the Transitway row lands in the `unstaged` bucket with an empty candidate list, which is the honest outcome.

---

## Appendix — the file inventory of the change

```
NEW  docs/research/stage-rules/stage-rules.v1.json          M1   frozen snapshot of scripts/harvest-track-a.ts:516-527
NEW  docs/research/stage-rules/stage-rules.v2.json          M1   the new rule set + per-rule evidence
NEW  docs/research/stage-rules/stage-rules.evidence.md      M1   human-readable rule → phrase → source → page
NEW  scripts/stage-rules.ts                                 M2   types, loader, pure classifier
NEW  tests/discovery/harvest-stage-rules-v2.test.ts         M2   per-rule tests, v1 lock, ambiguity tests
NEW  scripts/harvest-stage-rules-v2.ts                      M3   the fetch + compare CLI
NEW  docs/research/stage-rules/coverage-v2-vs-v1.md          M5   the human coverage table
NEW  docs/research/stage-rules/coverage-v2-vs-v1.json        M5   the machine-readable companion
NEW  docs/research/stage-rules/ambiguous-v2.jsonl            M5   the ambiguity sidecar (33 rows)
NEW  docs/research/stage-rules/README.md                     M6   the write-up
WR  docs/RSA-Documents/canada/track-a/t62/**                M4   the corpus cache — GITIGNORED (.gitignore:76), never committed

UNTOUCHED  scripts/harvest-track-a.ts, docs/RSA-Documents/**, policies/canada/pack.json,
            src/domain/**, state/odd-coverage.json, package.json,
            tests/discovery/harvest-track-a.test.ts,
            tests/discovery/harvest-track-a-report.test.ts,
            tests/discovery/harvest-track-a-round2-report.test.ts
```

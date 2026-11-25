---
title: Extraction and verbatim-span verification for harvested RSA reports
date: 2026-11-02
status: complete
ticket: Akamel01/AuditorAI#95
map: Akamel01/AuditorAI#93
scope: research only — no application code changed
---

# Extraction and verbatim-span verification

Answers ticket [#95](https://github.com/Akamel01/AuditorAI/issues/95) for the calibration
map [#93](https://github.com/Akamel01/AuditorAI/issues/93). The design follows the grilling
decisions in [#92](https://github.com/Akamel01/AuditorAI/issues/92) §2/§5/§7/§8/§13/§17 and
the evidence inventory [#94](https://github.com/Akamel01/AuditorAI/issues/94).

**Five-line summary**

1. Extracted 37 findings from three Canadian LFS reports; 33 passed the deterministic span check and all 33 passed a family-disjoint second model.
2. 33 findings (89.19 %) are established; 4 (10.81 %) were discarded, never repaired: three quotes not found, one page mismatch.
3. Two of three scheme descriptions were established; the CA-002 scheme was rejected for adding a detail not present in its quote.
4. The extractor was Nemotron 3.5 Super VL Free (family `nemotron`); the verifier was Beam Free (family `beam`); both returned HTTP 200 on preflight.
5. The evidence gate is still not met: 7/12/14 established across FEASIBILITY / PRELIMINARY / DETAILED, each from one document, below 20 findings from 3 documents.

## 0. Scope, method, and evidence

**Documents.** The three LFS documents are the readable Canadian reports named in
`docs/research/calibration/evidence-inventory.md` §4. CA-010 is deliberately excluded: it
is a PRELIM boundary sample (29 estimate, strict 27) and is not part of the primary cell
mean (`evidence-inventory.md` §4, §6).

| ID | Cell | Source (short) | Fixture pages | Inventory estimate |
|---|---|---|---|---|
| CA-001 | `canada:FEASIBILITY_CONCEPT` | Alberta Transportation, NEAHD planning-stage RSA, 2009 | 1–10 | 8 |
| CA-002 | `canada:PRELIMINARY_DESIGN` | City of Calgary, Glenmore Trail functional-plan RSA, 2017 | 1–33 | 14 |
| CA-007 | `canada:DETAILED_DESIGN` | UNB exemplary audits, Appendix C, 1999 | 40–51 (of 61) | 12 |

CA-007 is a four-audit compendium. The prototype scopes extraction to pages 40–51, the
75 % design-stage audit that matches the inventory's detailed-design count; the existing-road,
municipal and pre-opening audits in the same fixture are out of scope. The fixture is an
extract of the 168-page UNB guidelines: fixture page *n* is printed page *n*+101
(`tests/fixtures/samples/CA/index.md`, CA-007 block), so scoped pages 40–51 are printed
141–152. The record's `source_note` carries that
mapping; `source_url` is the original UNB document.

**Models and availability.** The pair was chosen from live probes on 2026-11-02, not from the
catalogue alone:

| Role | Model | Family | Gateway | Price | Preflight |
|---|---|---|---|---|---|
| Extractor | `nvidia/nemotron-3.5-super-vl:free` | `nemotron` | OpenRouter | free | HTTP 200, `gen-1793616933-guzUkXbK0ESnutHyGsm2` |
| Verifier | `opencode-go/beam-free` | `beam` | OpenCode Go | free | HTTP 200, `chatcmpl-a7f8f68e-1290-4f96-b4f9-9ac0b38492b7` |

The Zen free pool returned `429 FreeUsageLimitError` for all eight free models; Flint,
DeepSeek V4.1 Flash Free and GLM-5.3 Flash Free therefore could not serve as the second
model. The recommended Beam + Flint pair in `model-candidates.md` §6 could not run. Go Beam
answered 200, and OpenRouter free Nemotron and Gemma 4 31B answered 200. The run uses
Nemotron + Beam; Gemma was the unused fallback. The rule that matters is unchanged: **the
verifier must be from a different family than the extractor** (`model-candidates.md` §6.1).
Both used models are free; the run's `calls[]` record `cost: 0`. This is a deliberate,
evidence-backed revision of grilling §6, recorded in
`.autoforge/decisions/t95-amendments.md`.

**Run.** `2026-11-02T10-55-33-219Z`, three documents, all `complete`, 41 provider calls
(2 preflight, 3 extraction, 3 scheme verification, 33 finding verification). The full
records are in `state/calibration/extractions/canada/<STAGE>/<doc>.json`; the summary is
`state/calibration/extraction-summary-2026-11-02.json`.

**What the numbers mean.** They are extraction yields, not precision or recall. The
inventory's 8/14/12 are sample-read estimates, not ground truth. The operator's 10 % spot
check (#92 §5/§8) is still required before any count is presented as calibrated. Transport
failures are not extraction failures and never enter these denominators.

## 1. PDF text extraction with unpdf

`unpdf` 1.8.1 is already a dependency (`package.json:31`). The prototype does **not** reuse
`src/lib/extract.ts`: that path uses `mergePages: true` (`src/lib/extract.ts:30`), which
collapses exactly the page boundaries this ticket must keep, and caps at 200,000 characters
(`src/lib/extract.ts:39`). The prototype's deeper interface is local to
`scripts/calibration/prototype/document.ts`; no `src/` file changes.

**Steps.**

1. Read the PDF bytes and compute SHA-256 over the exact bytes; reject a document whose hash
   does not match the fixture registry before any model call.
2. `getDocumentProxy(new Uint8Array(bytes))`, then
   `extractText(pdf, { mergePages: false })`; require `text.length === totalPages`.
3. Strip NUL (`\u0000`) per page; do not trim pages (trimming would move offsets).
4. Join pages with `"\n"`; this is the raw document. Page *i*'s raw range is recorded.
5. Normalise once with `normalizeWithMap` (§3) to get `normalized_text` and `normToRaw`, a
   non-decreasing map from each normalised character to its raw-document index.
6. Page `p` has `norm_start` = the first normalised index whose raw index is at or after the
   page's raw start, and `norm_end` = the next page's `norm_start` (last page: text length).
   An empty page has `norm_start == norm_end`.
7. `locate(doc, start, endExclusive)` returns the start page, end page, `cross_page`, raw
   start/end, and the nearest preceding section. The end page is the page of the **last**
   normalised character (`endExclusive - 1`), so a span ending exactly on a page boundary is
   not falsely marked cross-page.

**Section offsets.** Headings are detected deterministically from raw lines, before
normalisation. A trimmed line of 1–80 characters is a heading when it is either:

- numbered: matches `^\d+(?:\.\d+)*\.?\s+\S`, has at most 10 word tokens, and does not end
  with a period; or
- all-caps: contains at least one Unicode letter, no lowercase letter, and at most 10 word
  tokens.

`SectionOffset` stores `title`, `page`, `norm_start`, and `raw_start`. The section is the
last heading whose `norm_start` is at or before the span start; no heading means `null`.
The heading rule is deliberately narrowed from the grilling proposal: the optional
`[A-Z]` branch matched every sentence-initial capital. The rule is still a heuristic — a
numbered body paragraph or a table header can be selected. Section is **audit-only**: it
never gates an item, and items with no heading are counted as `section_unknown`. The final
run has `section_unknown` 0/2/2 for CA-001/CA-002/CA-007.

**Verifier window.** For each item the verifier sees the normalised text of the span's page
±1 page, capped at 20,000 characters. The window is recorded as offsets, not text, in the
record.

## 2. Extraction prompt shape for a free model

One call per document. The model is `nvidia/nemotron-3.5-super-vl:free`; the request is
`temperature: 0`, `top_p: 1`, `seed: 42`, `max_tokens: 32768`, 600 s timeout. The input is
the page-marked normalised text of the scoped pages (`[PAGE n]`), plus the document scope
and the vocabularies. The 300,000-character cap is checked before the call; all three
documents are below it (CA-001 9.3 k, CA-002 31.1 k, CA-007 97.6 k characters, with CA-007
scoped to 12 pages in the prompt). `finish_reason: "length"` is an `extraction_invalid`
failure, not a partial publication.

The response must be one JSON object:

```json
{
  "scheme_description": {
    "text": "concise scheme summary",
    "span": { "quote": "3–14 word exact quote", "page": 1 }
  },
  "findings": [
    {
      "category": "junctions_interchanges",
      "location": "interchange or segment, or null",
      "road_users": ["drivers"],
      "description": "one discrete safety issue",
      "span": { "quote": "3–14 word exact quote", "page": 8 },
      "taxonomy_gap": false
    }
  ]
}
```

Rules in the prompt:

- extract one item per discrete safety issue; do not merge or split;
- quote 3–14 words copied exactly from the text, no ellipsis, no paraphrase;
- `page` is the 1-based `[PAGE n]` marker;
- `category` is one of the ten Canada pack issue categories, or `null` iff
  `taxonomy_gap` is `true`; the ten categories are `alignment_visibility`,
  `cross_sections_roadside`, `junctions_interchanges`, `vulnerable_users`,
  `signage_markings_lighting`, `access_management`, `human_factors_expectancy`,
  `network_continuity`, `drainage_structures`, `public_transport`
  (`policies/canada/pack.json:430-441`);
- `road_users` is a unique subset of the six pack road-user categories: `drivers`,
  `passengers`, `motorcyclists`, `cyclists`, `pedestrians`, `horse_riders`
  (`policies/canada/pack.json:422-429`); an empty list means not stated;
- `location` is `null` when the report does not state one;
- the scheme quote must identify the scheme (road, stage, limits or design concept), not
  merely the audit's scope;
- do not use a bare location label, table header or table row as a finding quote; the quote
  must state the safety issue or its evidence;
- if several rows repeat one issue, return one finding with one representative quote.

The prompt template is `extraction-v1`; the run's `prompt_hash` is
`f98b919f9d35c9b9ff8bab26ab07077819fc5fe7ff593add3de465467a666333`. The verifier prompt is
separate (`verifier-v1`, hash `f6c970fd2b1692d2dffbffb13f05d4ebd5e3dcdcbf4b0e24ba2633251d6a4d2e`).

Two prompt iterations are worth recording. The first allowed table-row labels; the
extractor returned 16 items for CA-001, including exchange labels that are not findings. The
second added the bare-label rule and the scheme-identity rule; CA-001 returned 7 items and
the established set matches the report's discrete issues. The final run's prompt is the
second. This is why the prompt shape includes an explicit negative rule, not just a schema.

## 3. Deterministic verbatim check

The check is one implementation in `scripts/calibration/prototype/normalize.ts` and
`verbatim.ts`; the same normalisation is applied to the source text and the quote. The
rules, in this exact order:

1. Remove soft hyphen `U+00AD` and zero-width `U+200B`, `U+200C`, `U+200D`, `U+FEFF`.
2. Expand ligatures: `U+FB00` → `ff`, `U+FB01` → `fi`, `U+FB02` → `fl`, `U+FB03` → `ffi`,
   `U+FB04` → `ffl`, `U+FB05` → `st`, `U+FB06` → `st`.
3. Fold typographic quotes and dashes: `“ ”` → `"`, `‘ ’` → `'`, and `– — U+2010 U+2011` →
   `-`.
4. De-hyphenate line breaks: remove `-` and the following line break (`\r\n`, `\r`, or
   `\n`) only when the character immediately before the hyphen is a Unicode letter
   (`\p{L}`) and the character immediately after the break is a Unicode letter. Any other
   hyphen is kept.
5. Collapse every whitespace run — space, tab, newline, CR, NBSP `U+00A0`, other `\s` — to
   one ASCII space, and trim.

**Not normalised:** case, diacritics or accents, other punctuation, word order. Matching is
case-sensitive and accent-sensitive; there is no fuzzy matching, stemming, or edit
distance. The word gate counts whitespace tokens that contain at least one Unicode letter or
digit; a quote must have 3–14 such words. A raw quote containing `...` or `…` is rejected
before matching. An empty or whitespace-only quote is rejected.

**Search and attribution.** The check scans every exact occurrence of the normalised quote
in the normalised document (it does not stop at the first 20; it records at most 20 for
audit). It prefers the first occurrence whose **starting page** equals the model's claimed
page. A cross-page occurrence is accepted and attributed to its start page with
`cross_page: true`. If the quote exists only on another page, the result is
`page_mismatch` with the found page; if it does not exist, `not_found`. Offsets are mapped
back through `normToRaw`, so the record has both normalised offsets and raw offsets.

**Known deterministic limits.** These are properties of the stated rules, not bugs to hide:

- *Compound dehyphenation.* `rear-\nend` normalises to `rearend`; a quote written as
  `rear-end` can fail. The corpus has line-broken compounds (`rear-\nend`, `left-\nturn`),
  so this is a real false-discard path. It is deterministic and is reported in the
  limitations, not repaired.
- *Source ellipses.* CA-002 contains many dot leaders. A quote that crosses one is not found
  as a contiguous span; the item is `not_found`. The three not-found discards in this run are
  examples of quote/normalisation mismatch, not silent repairs.
- *Heading heuristic.* Section can be a numbered paragraph or table header; it is
  audit-only and never discards.
- *No OCR.* A PDF with no text layer fails as `no_text_layer`; CA-008 is not in this run.

## 4. Second-model verification

The verifier is `opencode-go/beam-free` (family `beam`), a different family from the
extractor (`nemotron`). The family guard runs before any provider call; the record carries the pair and its
`family_disjoint` result. A same-family pair or an unknown id is a configuration error, not a warning. Zen
Beam and Go Beam are the same family and are not independent.

**What the verifier sees.** The extracted item (category, location, road users, description,
quote, page) and the normalised window of the span's page ±1 page, capped at 20,000
characters. It does **not** see the extractor model id, the deterministic result, or the full
report. The window contains no page markers; the verifier is told not to judge the page
number because the deterministic check already did.

**What it returns.** Exactly:

```json
{ "verified": true, "reason": "short reason" }
```

`verified` must be a boolean. The prompt says:

- the quote must be an exact substring of the window after the documented normalisation;
- the quote plus the window must support the description and safety concern;
- the quote need not contain every field; a `null` location or an empty `road_users` list
  means “not stated” and is not a rejection reason;
- reject a bare location label or table header without a safety claim;
- for a `scheme_description` item, a project/stage/location label is acceptable; verify
  only that the text is a faithful summary of the quote/window;
- do not repair, rewrite, or add quotes.

**Results.** 33 of 33 deterministic-passed findings were verified; 2 of 3 scheme
descriptions were verified. The one scheme rejection is CA-002: its summary mentioned the
diverging-diamond concept, which the chosen quote and window did not contain. That is the
intended behaviour — discard, not repair. The verifier is a support check, not a precision
measure; the 10 % operator spot check is still the calibration control.

**Availability honesty.** Zen free models were rate-limited at 429; the recommended Beam +
Flint pair could not be run. Go Beam and OpenRouter Nemotron were available and returned
200. If a model is unavailable at run time, the runner records `model_unavailable`, writes
no rates for that document, and names the stage, HTTP status and request id. It never
substitutes a same-family model and never invents numbers.

## 5. Discard rule: never repair

An item is discarded on any of these failures: `invalid_json`, `envelope_invalid`,
`item_invalid`, `taxonomy_gap_conflict`, `empty_quote`, `ellipsis`, `word_count`,
`not_found`, `page_mismatch`, `verifier_rejected`, `verifier_unparseable`,
`scheme_description_missing`, `scheme_description_invalid`, `truncated`. There is no retry,
no re-ask, no fuzzy match, no quote trimming, and no manual quote edit. A discarded item
never enters the established set and never enters an exemplar or scorecard.

Discarded items are retained for audit as `failures[]` with the raw model item excerpt
(≤500 characters), the SHA-256 of the raw item, the normalised quote, claimed and found
pages, a source excerpt (≤240 characters), the stage, the reason, and the timestamp. No full
page or report body is stored. Transport failures are not item failures: a 429/5xx/timeout
marks the document `model_unavailable`, aborts the run, and publishes no rates for that
document.

**This run.** 4 of 37 findings were discarded (10.81 %): three `not_found`, one
`page_mismatch`; no finding was rejected by the verifier. One of three scheme descriptions
was rejected by the verifier. The not-found cases are quotes that do not occur as contiguous
normalised spans; the page-mismatch case is a quote the model attributed to page 48 but the
deterministic check found on page 49. These are discarded, not fixed.

**ADR-0010 scope.** This discard rule is calibration-only. The product candidate path keeps
ADR-0010's flag-and-show behaviour; it does not discard candidates. #95 measures extraction
integrity for calibration, so a failed span cannot be presented as evidence.

## 6. Record format and storage

Records are committed JSON under:

```
state/calibration/extractions/canada/<STAGE>/<doc_id>.json
state/calibration/extraction-summary-<YYYY-MM-DD>.json
```

The run's records are
`state/calibration/extractions/canada/FEASIBILITY_CONCEPT/CA-001.json`,
`.../PRELIMINARY_DESIGN/CA-002.json`, and `.../DETAILED_DESIGN/CA-007.json`; the summary is
`state/calibration/extraction-summary-2026-11-02.json`. These paths are additive; the repo's
state validators do not read them, and no `.gitignore` change is needed. Debug logs go to
`.autoforge/tmp/` and are not committed. Nothing here is a customer export.

A complete record has:

| Group | Keys |
|---|---|
| identity | `record_version`, `schema_version`, `run_id`, `doc_id`, `sha256`, `source_url`, `source_path`, `source_note`, `scope_pages`, `scope_note`, `cell_key`, `stage`, `licence` |
| document | `page_count`, `document_chars`, `section_count`, `heading_rule`, `extracted_at`, `status` |
| provenance | `models` (extractor, verifier, `family_disjoint`), `prompt_version`, `verifier_prompt_version`, `prompt_hash`, `verifier_prompt_hash`, `check_version`, `config`, `preflight`, `calls` |
| payload | `scheme_description` (established only), `findings` (established only), `counts`, `rates`, `failures`, `error`, `envelope_extra_keys` |

`calls[]` stores each provider call's `stage`, `model`, `http_status`, `request_id`, `usage`,
`finish_reason`, `duration_ms`, and `at`. `preflight[]` stores the two model checks. This is
the provenance needed to distinguish a real run from a replay.

`counts` for findings: `raw`, `deterministic_passed`, `verified`, `established`,
`discarded`, `taxonomy_gap`, `section_unknown`, `cross_page`; `counts.scheme` repeats the
first five for the scheme description. `rates`: `pass = verified/raw`,
`discard = discarded/raw`, `verify = verified/deterministic_passed`,
`established = established/raw`; six decimals, `null` on a zero denominator. The summary's
`totals.rates` and `cells.*.rates` are `null` when any requested document is incomplete.

Each established finding stores `item_id`, `category`, `location`, `road_users`,
`description`, `taxonomy_gap`, `span`, and `verification`. The span has the original quote,
the normalised quote, word count, page, end page, `cross_page`, section, model section, and
normalised/raw offsets. Decision 17 is enforced: quotes are 3–14 words, each record carries
the source URL and SHA-256, and no full report text is stored. The summary repeats the model
pair, preflight, per-document counts/rates, per-cell pooled counts/rates, totals, the
`excluded_docs` list (`CA-010`), and `unavailable`.

The full schema is implemented in `scripts/calibration/prototype/pipeline.ts`; the
deterministic check is in `normalize.ts`, `document.ts`, and `verbatim.ts`; the CLI is
`run.ts`. The run command is:

```bash
OPENROUTER_API_KEY=... OPENCODE_GO_API_KEY=... \
  npx tsx scripts/calibration/prototype/run.ts --doc all --out state/calibration --date 2026-11-02
```

Keys were resolved from the operator auth store and never printed or written.

## 7. Prototype results

All three documents completed. The final run is `2026-11-02T10-55-33-219Z`.

| Doc | Cell | Raw | Deterministic pass | Verified | Established | Discarded | Pass | Discard | Verify | Scheme |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| CA-001 | FEASIBILITY_CONCEPT | 7 | 7 | 7 | 7 | 0 | 1.000000 | 0.000000 | 1.000000 | 1/1 |
| CA-002 | PRELIMINARY_DESIGN | 14 | 12 | 12 | 12 | 2 | 0.857143 | 0.142857 | 1.000000 | 0/1 |
| CA-007 | DETAILED_DESIGN | 16 | 14 | 14 | 14 | 2 | 0.875000 | 0.125000 | 1.000000 | 1/1 |
| **Pooled** | **all three** | **37** | **33** | **33** | **33** | **4** | **0.891892** | **0.108108** | **1.000000** | **2/3** |

**Discards.** The four finding discards are three `not_found` and one `page_mismatch`:
CA-002 has two `not_found`; CA-007 has one `not_found` and one `page_mismatch`. The CA-002
scheme is a separate `verifier_rejected`, not part of the finding denominator.

**Gate.** The evidence minimum is at least 20 established test findings from at least 3
test-set documents per cell (#92 §10). This run has 7/12/14 established in the three cells,
one document each. The gate is **not met**; the summary reports `gate.met: false`. The 33
pooled findings are a yield measurement, not a cell claim.

**Comparison with the inventory.** The inventory's estimates were 8/14/12 from a manual
sample read. The prototype's final established counts are 7/12/14. These are not accuracy
scores: the extractor may split or merge issues, the inventory's counts use a different
counting rule, and CA-007's 12 was a group count in the detailed-design example while the
prototype extracted 16 raw items from pages 40–51. The 10 % spot check and #98 matching are
needed before any precision claim.

**Provider calls.** 41 unique calls: 2 preflight, 3 extraction, 3 scheme verification, 33
finding verification. Per-record `calls[]` lengths are 11 (CA-001), 16 (CA-002), 18 (CA-007);
each includes the two preflight calls, so the unique total is 41. All calls returned HTTP 200.
Model spend was zero on the free tiers.

**Quoted examples** (each under 15 words, with page and source URL):

| Doc | Page | Quote | Source |
|---|---:|---|---|
| CA-001 | 8 | “The interchange spacing appears to be rather close” | <https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/2f0b905f-2c5c-4257-a91b-8272cb605242/download/neahdappendixc.pdf> |
| CA-002 | 19 | “The drawings provided do not indicate any pedestrian or bicycle facilities” | <https://www.calgary.ca/content/dam/www/transportation/tp/documents/projects/current-planning-projects/glenmore-trail-100st/glenmore-tr-e-functional-study-appendix-h-1-road-safety-audit-report.pdf> |
| CA-007 | 50 (printed 151) | “decision to use the flared, buried end treatment on guide rails” | <https://www.unb.ca/research/transportation-group/_assets/documents/rsa-guidelines.pdf> |

## 8. Limitations and not established

- **Yield, not accuracy.** No ground-truth labels were produced. The verifier confirms
  support; it does not measure recall or precision. The 10 % operator spot check is the
  calibration control.
- **Scheme verification is narrow.** A single quote plus a ±1 page window cannot support a
  scheme summary that draws on several pages; CA-002's rejection is the worked example. The
  build should use 2–4 scheme spans or a full-document scheme verification; the prototype
  demonstrates the failure mode.
- **Dehyphenation and dot leaders.** The normalisation joins line-broken compounds and
  rejects ellipses; a printed `rear-end` can fail, and a quote crossing a dot leader is
  `not_found`. The four finding discards are reported, not repaired.
- **Section is heuristic.** Numbered paragraphs and table headers can be selected as
  headings; section never gates. `section_unknown` is 0/2/2.
- **Licence and label caveats.** CA-002 and CA-007 have `licence: not recorded` in the
  inventory; their inclusion here is a prototype measurement, not a gate clearance. CA-002
  and CA-007 are label-conflict fixtures; #94's D14.4 admission still applies.
- **Model availability is a point-in-time fact.** The Zen free pool was 429; the pair used
  was available on 2026-11-02. Free models are limited-time offers; a model swap on the
  product path is a Tier-1 trigger (`docs/validation/eval-gates.md` §2). Temperature 0 and
  seed 42 are recorded, but model output is not bitwise reproducible; the deterministic
  stage is.
- **Data terms.** The three documents are public. Nemotron's trial terms allow only public
  data; OpenRouter free endpoints may log. Do not point this prototype at client or
  confidential reports.
- **Not covered.** OCR (CA-008), drawings/vision, recommendations, taxonomy mapping (#97),
  finding matching (#98), scorecards (#99), and the weekly spot-check layout. `taxonomy_gap`
  is logged but is zero in this run.
- **No gate claim.** 7/12/14 established from one document per cell is insufficient
  evidence under #92 §10. The gate verdict is “insufficient evidence”, not a pass.

## 9. Handoff

The design is implementable as a production extraction service after these build decisions:
(a) a page-preserving document seam (the prototype's `DocumentText`) instead of the
merge-pages intake; (b) a record contract and storage under `state/calibration/`;
(c) a family-disjoint model-pair guard with the Nemotron/Beam pair and the Gemma fallback;
(d) a scheme verifier with multiple spans or full-document context; (e) a build-time
spot-check sample. The calibration scorecard (#99), matching (#98), taxonomy mapping (#97),
and the weekly spot-check issue consume the record fields; they are out of scope here.

**Sources and decisions.** `docs/research/calibration/model-candidates.md` (free models and
families), `docs/research/calibration/evidence-inventory.md` (documents, estimates, gate),
#92 decisions 2/5/7/8/13/17, #94 D13/D14, #96 model evidence, `policies/canada/pack.json:422-441`.
The implementation contracts are in `.autoforge/architecture/decisions-t95.md` and
`.autoforge/decisions/t95-amendments.md`.

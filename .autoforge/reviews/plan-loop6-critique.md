# Plan-loop6 critique — ticket #40 (Harvest Track A), operator-addition close-out

**Reviewer:** autoforge-reviewer (independent, read-only, plan critic)
**Date:** 2026-10-21
**Scope:** `.autoforge/execution/loop6-brief.md:1-136` (authority) → `.autoforge/plans/plan-loop6.md:1-427` → `.autoforge/execution/work-order-loop6.json:1-194` → `.autoforge/state.json:1-52`, verified against `scripts/harvest-track-a.ts:1-959`, `tests/discovery/harvest-track-a.test.ts:1-293`, `src/discovery/ratelimit.ts:1-66`, `.gitignore:75-79`, `docs/RSA-Documents/track-a-sources.json:1-367`, `docs/RSA-Documents/track-a-ondisk-summary.json:1-135`, `docs/RSA-Documents/track-a-ondisk-inventory.jsonl:1-304`, `docs/RSA-Documents/canada-intake-manifest.jsonl:1-3`, `docs/RSA-Documents/canadian-download-log.tsv:1-4`, `docs/RSA-Documents/track-a-split.json:1-24`, `docs/RSA-Documents/track-a-duplicates.json:1-19`, `docs/RSA-Documents/track-a-coverage.md:1-71`, `docs/RSA-Documents/track-a-reconciliation.md:77-99,300-320`, `docs/RSA-Documents/LICENSE-REGISTER.md:24-25`, `docs/RSA-Documents/corpus-schema.json:10-12`, `docs/RSA-Documents/scripts/build-ondisk-inventory.py:1-20,110-131`, `state/odd-coverage.json:96-117,212-248`, `policies/canada/pack.json:20-90`, `package.json:6-14`, `tsconfig.json`, `eslint.config.mjs`
**Constraints honoured:** read-only — no edits, no git, no network, no test runs. Counts were recomputed from the committed JSONL with a read-only one-liner.
**Skills:** `code-review` (Standards vs Spec), `ponytail-review` ladder, `verify-and-stop`.

---

## VERDICT: CHANGES_REQUIRED

Five blocking defects, all resolvable at plan-amendment level with no operator authority. The plan is
otherwise complete, correctly hazard-aligned, and traceable: H1 is fixed from the full intake
manifest with a regression test, the empty-batch write guards are identified at the right lines,
robots/politeness/no-redownload are honoured, only registers/logs/manifests/inventory/reports ship,
M6→M7 ordering is enforced, the ODD stage mapping matches `policies/canada/pack.json` and
`state/odd-coverage.json`, and T1/T0 are kept out of coverage. What is missing is precision in the
counting rules of M7 — the module that carries both remaining operator deliverables — plus one
acceptance criterion in M6 that passes on the unfixed code.

| # | Blocking | What breaks if not fixed |
|---|---|---|
| **RC-1** | Define how a manifest row qualifies as a coverage candidate (manifest rows have no `class`) and which label wins for a sha256 present in **both** the inventory and the manifest | `canada:FEASIBILITY_CONCEPT` have-count is 0 **or** 1 depending on an unstated choice — the report's headline number is invented by the worker |
| **RC-2** | Define the precision table's row set and denominator ("over the same row set" vs "a share of the in-scope rows") | The `out-of-scope` class only exists outside the 146-row Canadian subset, so the two readings produce incompatible tables and shares |
| **RC-3** | M6's empty-batch AC must name the scenario that exercises the bug (staging present, `fresh` empty) | `intake` returns early with no staging file, so the AC passes on the **unfixed** code — H8 silently unfixed |
| **RC-4** | Replace "the 3 manifest rows" with "all manifest rows" in M7 (plan + work order) | If M6 ingests a document, M7's AC ("lists the 3 manifest rows") fails or the worker truncates the table |
| **RC-5** | Say whether the Alberta listing is a **new** source entry or a mutation of `ab-publications`, and require every field the `Source` interface needs | Mutating `ab-publications` silently drops its two `known_document_urls`; a new entry missing `licence_default` crashes `runFetch` at `scripts/harvest-track-a.ts:541` |

---

## 1. Blocking findings

### RC-1 — M7's coverage-candidate rule is undefined for manifest rows and for shas present in both sources

**Evidence**

- `docs/RSA-Documents/canada-intake-manifest.jsonl:1` — sha `0af7ea584ae0…`, `"tier":"T3"`,
  `"stage":"FEASIBILITY_CONCEPT"`, `"cell_key":"canada:FEASIBILITY_CONCEPT"`, `"ca_province":"AB"`,
  `"split":"test"`. The `IntakeRecord` interface has **no `class` field**
  (`scripts/harvest-track-a.ts:105-126`), so a manifest row can never satisfy
  `plan-loop6.md:106-107` rule 3 ("Only `class == \"rsa-sample\"` rows are coverage candidates").
- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl:231` — the **same sha256**
  `0af7ea584ae0…`, path `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf`,
  `"jurisdiction":"AB"`, `"stage":"planning"`, **`"tier":"T0"`**, `"class":"rsa-sample"`.
- Recomputed from the committed inventory (read-only): under the **inventory's** labels the only
  Canadian `rsa-sample` + T3/T4 + stage-mapped row is
  `docs/RSA-Documents/track-a-ondisk-inventory.jsonl:31`
  (`OC_Transpo_Transitway_RSA.pdf`, `detailed`, T3, ON) → `canada:DETAILED_DESIGN` = 1 from disk.
  `canada:FEASIBILITY_CONCEPT` = **0** from disk (the one `planning` + `rsa-sample` row is T0).
- Under the **manifest's** labels the same document is T3 `FEASIBILITY_CONCEPT` → the cell = **1**.

`plan-loop6.md:249-254` asks for "the number of **distinct**, in-scope, `rsa-sample`, T3/T4
documents … across the inventory **and** the intake manifest" and for the table to "say which of the
two sources each count came from (on-disk vs fetched)". Two rules are missing and both change the
headline number:

1. **Class equivalence for manifest rows.** A manifest row has no `class`; it does have `tier`,
   `stage`/`cell_key`, `licence_verdict` and was already gated by `isRsaDocument` at
   `scripts/harvest-track-a.ts:533-537`. The plan must say that a manifest row counts when
   `tier ∈ {T3,T4}` and `cell_key` is one of the three Canadian cells (i.e. `class`-equivalent to
   `rsa-sample`), otherwise rule 3 silently zeroes the fetched side.
2. **Precedence for a sha256 in both sources.** `0af7ea58…` is in both, with *conflicting* tier
   labels (T0 on disk vs T3 fetched). "Distinct" is not enough: the worker must be told which
   label wins, or it will publish a number derived from an undocumented choice.

**Fix (one paragraph, add to `plan-loop6.md` §3 and to `work-order-loop6.json` M7 `context`):**

> *Coverage candidate rule.* A document is identified by its sha256. A row qualifies when it is
> Canadian (13 `ca_province` codes + `CAN-GOV`), `tier ∈ {T3,T4}`, and its stage maps to the cell.
> For **inventory** rows the class must additionally be `rsa-sample` (rule 3). For **manifest**
> rows there is no `class` field; a manifest row qualifies on `tier` + `cell_key` alone (it already
> passed the RSA classifier). When a sha256 appears in **both** sources, the **manifest label
> wins** (the fetched record is the authoritative tier/stage for that document) and the document is
> attributed to the *fetched* column, not double-counted. Result for the committed data:
> `canada:FEASIBILITY_CONCEPT` = 1 (fetched, sha `0af7ea58…`), `canada:DETAILED_DESIGN` = 1
> (on-disk, `OC_Transpo_Transitway_RSA.pdf`), `canada:PRELIMINARY_DESIGN` = 0.

Add to M7's acceptance (`plan-loop6.md:283-284`): "the two sources' labels are reconciled by the
stated precedence rule; a sha256 present in both is counted once and attributed to the fetched
column".

---

### RC-2 — The precision table's row set and denominator are contradictory

**Evidence**

- `plan-loop6.md:258-261` (M7 §3): "Counts per class, **over the same row set**: true in-scope
  Canadian RSAs at T3/T4 (the coverage count), `methodology`, **`out-of-scope`**, `duplicates`, and
  the T0/T1 cut of the in-scope rows. Every class value present in the inventory must appear in the
  table … Give the precision as a **share of the in-scope rows** as well as raw counts."
- `docs/RSA-Documents/track-a-ondisk-summary.json:11-17` — the class vocabulary is
  `duplicate 36, methodology 27, out-of-scope 125, rsa-sample 59, unusable 57` over **all 304** rows.
- Recomputed: `out-of-scope` (125) and `INT`/`USA` (rows outside the Canadian scope) exist **only**
  outside the 146-row Canadian subset. Inside the Canadian scope the class vocabulary is
  `duplicate 11, methodology 24, rsa-sample 54, unusable 57` (= 146) — **no `out-of-scope` rows**.
- So "the same row set" (which must contain `out-of-scope`) and "share of the in-scope rows" (the
  146-row subset) cannot both be the denominator. The two readings give different shares for every
  class, and `plan-loop6.md:271-275` (the cross-check) only pins the 146-row block.

**Fix:** state the denominator explicitly, e.g.:

> *Precision table.* Section 3 counts **every** class over the full row set = the 304 inventory rows
> plus the manifest rows not already present by sha256 (today 305: only
> `docs/RSA-Documents/canada-intake-manifest.jsonl:2`'s sha is absent from the inventory — `:1` and
> `:3` are already inventoried at `docs/RSA-Documents/track-a-ondisk-inventory.jsonl:231` and the
> `docs/references/CA/bct-moti-rsa-policy-tc-t02-04-2004.pdf` row). The denominator for each share
> is that row set. A second sub-block gives the **Canadian-only** breakdown (the 146-row subset)
> that must reproduce `docs/RSA-Documents/track-a-ondisk-summary.json:64-92`; the "in-scope share"
> is the `rsa-sample`+T3/T4 count over that 146-row denominator, stated separately from the
> all-rows share.

---

### RC-3 — M6's empty-batch acceptance criterion passes on the unfixed code

**Evidence**

- `plan-loop6.md:187-188` (and `work-order-loop6.json:47`): "`canadian-download-log.tsv` and
  `canada-intake-manifest.jsonl` are byte-identical after an intake run that ingests nothing
  (no trailing blank line)."
- `scripts/harvest-track-a.ts:596-600` — `runIntake()` returns immediately when the staging file is
  absent or empty (`readStaging` returns `[]` at `:587-593`). In this container the staging file is
  gitignored (`.gitignore:78`) and absent, so the "ingests nothing" run **never reaches the
  writes** at `:646-647` (log) and `:656-662` (manifest) — the bug the AC is meant to gate.
- The bug itself is real: with `fresh = []`, `logLines.join("\n")` is `""` and the log write at
  `:647` appends a bare `"\n"`; the manifest write at `:660` does the same. It is only reachable
  when staging exists and every record is a duplicate (`knownSha.has` at `:612` → `fresh` stays
  empty) — exactly the H1 scenario.

**Fix:** rewrite the AC (both files) to name the scenario, e.g.:

> "With a staging file present whose records are all already in `dedupe-index.json` (so `fresh` is
> empty), an `intake` run leaves `canadian-download-log.tsv` and `canada-intake-manifest.jsonl`
> **byte-identical** to their committed content (no trailing blank line). The worker must run this
> case explicitly and paste the byte comparison; running `intake` with no staging file does not
> satisfy this criterion."

---

### RC-4 — M7 hard-codes "the 3 manifest rows" while M6 may ingest a fourth

**Evidence**

- `plan-loop6.md:262-264` (M7 §4): "The **3** manifest rows with their tier/stage/split
  (`docs/RSA-Documents/canada-intake-manifest.jsonl:1-3`)"; `work-order-loop6.json:96`: "the
> fetched-only section lists the **3** manifest rows …"; `work-order-loop6.json:89` context: "3
  fetched records: 1 CLEAR T3 …, 2 RESTRICTED T1 …".
- But M6's own AC (`plan-loop6.md:193-194`) anticipates new documents: "Every new document (if
> any) has a row in the download log, the licence register, the dedupe index and the intake
> manifest". If M6 ingests one, the manifest has 4 rows and M7's AC fails or the worker silently
  drops the new row from the precision section.

**Fix:** replace "the 3 manifest rows" with "**all** rows of `canada-intake-manifest.jsonl` (3
today; more if M6 ingested any)" in `plan-loop6.md:262` and in `work-order-loop6.json:89,96`. The
counts stay derived, never typed.

---

### RC-5 — The manifest-extension instruction contradicts its own acceptance criterion

**Evidence**

- `plan-loop6.md:159-166` (M6 step 5): "Extend `track-a-sources.json` only if a server-rendered
  listing … The one candidate in the committed file is **the Alberta publications listing** … give
  **it** `strategy: \"html-listing-pdf\"` …, a `listing_url` …, and a `max_downloads`."
  The "Alberta publications listing" is the **existing** source `ab-publications`
  (`docs/RSA-Documents/track-a-sources.json:64-93`), whose `strategy` is `known-document-url`
  (`:70`) and which carries two `known_document_urls` (`:82-85`).
- `plan-loop6.md:191-192` (M6 AC): "`track-a-sources.json` **gained at most one entry**". A gain is a
  new entry; step 5 reads as a mutation of an existing one.
- The two are not equivalent: `candidatesFor` ignores `known_document_urls` for any strategy other
  than `known-document-url` (`scripts/harvest-track-a.ts:246`), so mutating `ab-publications`
  silently drops the two Alberta RSA-guideline URLs and invalidates its committed outcome block
  (`docs/RSA-Documents/track-a-sources.json:87-92`).
- A new entry is only safe if it carries every field the `Source` interface requires
  (`scripts/harvest-track-a.ts:63-89`): `id`, `host`, `family`, `strategy`, `listing_url`,
  `robots_hint`, `licence_default{verdict,basis,licence_ref}`, `stage_hint`, `ca_province_hint`,
  `doc_type_hint`, `expected_yield_estimate`. `runFetch` dereferences `source.licence_default.verdict`
  at `:541`, `source.stage_hint` at `:539`, `source.ca_province_hint` at `:540` and
  `source.doc_type_hint` at `:561` — a partial entry throws.

**Fix:** state it once, unambiguously, e.g.:

> "If — and only if — the listing yields candidate PDFs, **add a new source entry** (new `id`, e.g.
> `ab-publications-listing`; `strategy: \"html-listing-pdf\"`; `listing_url` not under `/api/`;
> `robots_hint`; `licence_default{verdict,basis,licence_ref}`; `stage_hint`; `ca_province_hint`;
> `doc_type_hint`; `expected_yield_estimate`; `max_downloads`). Do **not** modify the existing
> `ab-publications` entry — its `strategy` and `known_document_urls` stay as committed, because
> `candidatesFor` ignores `known_document_urls` for any other strategy
> (`scripts/harvest-track-a.ts:246`)."

---

## 2. Non-blocking findings

| # | Finding | Evidence | Fix |
|---|---|---|---|
| **N-1** | The CLI export list cites the wrong line range: `LEGACY_SHA256` is at `:842-846`, not inside `:38-446`. | `plan-loop6.md:79-83`, `scripts/harvest-track-a.ts:842-846` | cite `scripts/harvest-track-a.ts:38-446,842-846` |
| **N-2** | The ODD **target** citations are off by a few lines: `target` is at `:108`, `:220`, `:239`; `:111` is `have_total` and `:219`/`:238` are `fixture_ids`. The numbers (13/41/41) are right. | `plan-loop6.md:251`, `work-order-loop6.json:89`, `state/odd-coverage.json:108,111,220,239` | cite `state/odd-coverage.json:108,220,239` (the plan's §2 block at `:59-61` is already correct) |
| **N-3** | The plan lists **7** per-source `outcome` blocks; there are **8** (the `qc-montreal-open` block at `docs/RSA-Documents/track-a-sources.json:156-161` is missing). The work order lists all 8 — the plan and the work order disagree. | `plan-loop6.md:54-55,179` vs `work-order-loop6.json:43`; `docs/RSA-Documents/track-a-sources.json:156-161` | add `:157-161` to the plan's list |
| **N-4** | `scripts/build-catalog.py` does not exist; the generator is `docs/RSA-Documents/scripts/build-catalog.py`. The plan repeats the brief's wrong path twice. | `plan-loop6.md:201-202,406-409`; `docs/RSA-Documents/scripts/build-catalog.py` | fix the path (the *decision* — do not hand-edit `corpus-catalog.json` — stands) |
| **N-5** | "Never pad with T1 documents to hit a number" is quoted as **ticket #40 body → Rules**, but the phrase appears nowhere in the repo. The verifiable local source is `.autoforge/requirements/grilling.md:10` ("T1 never counts as §3 coverage") and `:41` ("Stop rule no numeric floor … T1 reported separately, never as §3 coverage"). The brief itself only requires the rule, not the quote. | `plan-loop6.md:104-105`; `.autoforge/requirements/grilling.md:10,41` | cite `grilling.md:10,41` and drop the unverifiable quotation |
| **N-6** | `track-a-coverage.md` is **stale**: it lists **12** unfillable families (`:35-46`) while `track-a-sources.json:287-366` has **13** (the `UNB Transportation Group / MRDC` family at `:360-365` is missing). M6 step 6's `report` re-run will add it — the plan should say so, and note that `runReport` stamps `Generated: <now>` (`scripts/harvest-track-a.ts:765`), so that file is **not** byte-reproducible (unlike M7's report, which the plan correctly requires to be timestamp-free). | `docs/RSA-Documents/track-a-coverage.md:35-46`; `docs/RSA-Documents/track-a-sources.json:360-365`; `scripts/harvest-track-a.ts:765` | state in M6: "the `report` re-run is expected to change `track-a-coverage.md` (13 families + a new timestamp); commit the regenerated file" |
| **N-7** | M7's new script must not execute on import, or the vitest import will run the CLI. The existing CLI guards with the `__filename` check; the plan never requires it of the new file. | `scripts/harvest-track-a.ts:957-958`; `plan-loop6.md:229,246-248` | add to M7 work: "export `buildReport` and guard `main()` with the same `process.argv[1]` check as `scripts/harvest-track-a.ts:957-958`" |
| **N-8** | `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md` is **vacuous on an untracked file** (git does not diff untracked paths). It is only meaningful after the file is staged/committed, so §8's sequence must run *after* §7's commits. | `plan-loop6.md:305-310,385-398` | state "run the verification sequence after the three commits" or use `git add` + `git diff --cached --exit-code` |
| **N-9** | The selftest's split check pushes every non-`train` province into the `test` set (`entry.split === "train" ? train : test`), so `restricted` documents land in `test`. Harmless for the overlap check, but M7's disjointness check (AC3) should be done **per document** over the manifest records, not via the province-level map, which cannot represent a province holding both train and test documents. | `scripts/harvest-track-a.ts:900-906`; `plan-loop6.md:262-264` | specify the document-level check (sha256 → single split) |
| **N-10** | The fetch round has no time bound. Worst case: `bc-moti` 15 sitemap pages × 10 s crawl-delay (`track-a-sources.json:117`, crawl-delay map `:10-13`), `qc-montreal-open` up to 60 dataset pages × 10 s (`scripts/harvest-track-a.ts:327`), `qc-mtl-transports`/`qc-montreal-city`/`toronto-legdocs` 10 s each → tens of minutes. | `docs/RSA-Documents/track-a-sources.json:10-13,117`; `scripts/harvest-track-a.ts:264,327` | add "if the round has not finished in N minutes, stop it and record the partial outcome" |
| **N-11** | §3 rule 6 lists the manifest stage vocabulary as `FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN, DETAILED_DESIGN, UNSTAGED, MULTI_STAGE`, but `detectStage` can also return `PRE_OPENING` (`scripts/harvest-track-a.ts:344`). | `plan-loop6.md:111-113`; `scripts/harvest-track-a.ts:344` | add `PRE_OPENING` to the unmapped list |
| **N-12** | M6 step 7 says "Add one line to the **generated** `track-a-coverage.md`". The file is regenerated wholesale by `runReport` (`scripts/harvest-track-a.ts:762-830`), so a hand edit is lost on the next `report` run. The plan's outputs list does say the change lands in the script (`:126` "one report line"), but the step text contradicts it. | `plan-loop6.md:126,174-175` | reword step 7: "add the H3 line to `runReport`'s markdown template so every regeneration carries it" |

---

## 3. What the plan gets right (verified, no change needed)

| Brief check | Result |
|---|---|
| **H1 fixed from the FULL manifest + regression test required** | ✅ `plan-loop6.md:136-149` — split map derived from the manifest, one exported pure helper, no second algorithm; regression test + committed-file invariant test required, with the correct "compare parsed structure, not bytes" caveat. The committed split file **does** satisfy the invariant today (`docs/RSA-Documents/track-a-split.json:9-23` vs `docs/RSA-Documents/canada-intake-manifest.jsonl:1-3`: AB→test×1, BC→restricted×2, same order), so the invariant test is satisfiable without regenerating anything. |
| **Empty-batch write guards** | ✅ the two offending writes are named correctly (`scripts/harvest-track-a.ts:646-647`, `:656-662`); only the AC's scenario is wrong → RC-3. |
| **robots / politeness / no re-download / registers-only** | ✅ robots gate per path before every request (`scripts/harvest-track-a.ts:480-484`), crawl-delay honoured (`:486-487`), ≤1 req/s per host (`src/discovery/ratelimit.ts:4,43-45`), known-hash skip **before** any write (`:511-518` vs `:549-550`), known-hash set = inventory ∪ dedupe-index ∪ corpus-catalog (`:161-193`), and the commit list stages only registers/logs/manifests/inventory/reports (`plan-loop6.md:366-379`) with binaries gitignored (`.gitignore:76-79`). |
| **M7 derives coverage from the committed inventory; every number traceable to a file** | ✅ inputs are all committed (`plan-loop6.md:238-243`); the Canadian-scope rule (13 `ca_province` codes `corpus-schema.json:10-12` + `CAN-GOV` `track-a-ondisk-summary.json:35`) reproduces the committed subset **exactly** when recomputed: 146 rows; class `methodology 24 / rsa-sample 54 / unusable 57 / duplicate 11`; stage `existing 59 / unknown 57 / detailed 15 / preliminary 8 / pre-opening 4 / planning 3` — matching `track-a-ondisk-summary.json:64-92`. The cross-check is achievable. (The *counting rule* is still undefined → RC-1/RC-2.) |
| **ODD stage mapping consistent; T1 kept out of coverage** | ✅ `policies/canada/pack.json:26-28` (`planning`→`FEASIBILITY_CONCEPT`), `:44-46` (`preliminary`→`PRELIMINARY_DESIGN`), `:62-64` (`detailed`→`DETAILED_DESIGN`), `:80` (`pre-opening` → `canonical_stages: []`); the three `canada:` cells' `native_stage_id`s in `state/odd-coverage.json:98,214,233` match the pack exactly; T0/T1 excluded by `plan-loop6.md:103-105`. |
| **M6 → M7 ordering** | ✅ `work-order-loop6.json:88` `blocked_by: ["M6"]`, `:121-123` `order`/`parallel_safe: false`. |
| **Work-order shape** | ✅ valid JSON; every module carries `id,title,goal,creates,modifies,touches,blocked_by,context,acceptance,verify,out_of_scope` (`work-order-loop6.json:8-11,74-77`); M6 `creates: []`, M7 `modifies: []`. |
| **PR body skeleton / commit list / verification sequence** | ✅ present (`plan-loop6.md:312-398`); one concern per commit with explicit paths; `vault-sync --check` included; foreign lane `state/production-harvest-proof.json` excluded. |
| **Plan-vs-brief divergence** | ✅ the plan correctly rejects the brief's stale export list (`plan-loop6.md:79-83`): the file really exports `TEST_PROVINCES, TSV_COLUMNS, serializeDedupeIndex, HASH_SKIP_REASON, knownHashes, hashSkipReason, splitFor, detectStage, detectLang, detectProvince, subjectRegion, isRsaDocument, detectTier, missingSideNote, projectKeyFor, LEGACY_SHA256` and **no** `projectId` / `verifyPdf` / `dedupeClaim` / `coverage`. Good catch; keep it. |

---

## 4. Residual risks (after RC-1..RC-5 are amended)

1. **The fetch round may still be a no-op.** All eight committed source `outcome` blocks record zero
   new documents — six `no-new-document`, two `unfillable`
   (`docs/RSA-Documents/track-a-sources.json:57-62,87-92,120-126,156-161,186-192,218-223,250-255,279-284`),
   and the known-hash set now covers the operator's 304-row corpus plus the corpus registers. The
   realistic M6 outcome is **0 new documents**; the plan must then leave `track-a-sources.json`
   byte-identical (`plan-loop6.md:176-179` says so — good) and the PR must say so plainly rather
   than implying new material.
2. **`track-a-coverage.md` will carry a new `Generated:` timestamp** (N-6) — expect a one-line diff
   in the PR that is not a data change.
3. **The M7 headline coverage is small by construction**: 1 document in
   `canada:FEASIBILITY_CONCEPT`, 1 in `canada:DETAILED_DESIGN`, 0 in `canada:PRELIMINARY_DESIGN`
   against targets 13/41/41. The report must present that as the honest state, not as a gap to be
   closed by re-labelling — the plan's "do not write coverage into `state/odd-coverage.json`"
   out-of-scope (`plan-loop6.md:301`) is the right guard and must survive into the worker's hands.
4. **`.autoforge/state.json` still says `"loop": 5` and `"phase": "plan-loop6"`** — cosmetic, but the
   orchestrator should reconcile it after the modules land.

**Verdict unchanged after RC-1..RC-5:** none of the fixes needs operator authority, a new module, a
new source of truth, or a change to the H1/H2/H3/H5 handling. They are one-paragraph amendments to
`plan-loop6.md` §3/§4/§5 and the matching `work-order-loop6.json` `context`/`acceptance` strings.

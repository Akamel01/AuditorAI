# Plan critique — Ticket #62 (`Akamel01/AuditorAI#62`)

**VERDICT: CHANGES_REQUIRED**

Reviewer: autoforge-reviewer (plan critic) · scope: `.autoforge/plans/plan-t62.md` + `.autoforge/execution/work-order-t62.json` vs the ticket, the locked decisions D1–D14 and the current repo.
Read-only review; no repo file was modified by this review.

Evidence convention: every blocker/major cites a current file with `path:line`, or the quoted output of a command actually run in this worktree (`node -e`, `npx tsx`, `grep`, `git check-ignore`). Citations to the plan's own prose are used only to locate the claim, never as proof of a defect.

---

## C1 — SPEC COVERAGE

**MAJOR — the ticket's named French vocabulary and its percentage ladder are silently dropped.**
The ticket names `conception préliminaire`, `conception détaillée`, `audit de sécurité routière en exploitation` and `30%/60%/90% design`. The plan's rule table (plan-t62.md:88-100) contains none of them.

- `grep -n "conception" .autoforge/plans/plan-t62.md` → no output.
- `grep -n "exploitation" .autoforge/plans/plan-t62.md` → no output.
- The percentage rule is `CA-AMBIG-PCT` (plan-t62.md:99): `NN% (design|plan|detail)` → the single pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}`. 30%, 60% and 90% all produce the same two candidates, so the ladder the ticket names is not implemented, and the string "30%" / "60%" / "90%" appears nowhere in the plan (only "50%" and "60 km/h" as negative traps, plan-t62.md:202,209).

Why this matters beyond wording: the committed Alberta reference doc *does* attest a percentage↔stage equivalence — extracted text of `docs/references/CA/alberta-transportation-rsa-implementation-plan-2004.pdf`: `75% completion of the project and is the equivalent of the 90% to 95% stage of the design` (also `90%-100% Design Audit`). The plan's generic `NN%` rule throws that equivalence away.

Required change: add rules for the ticket's terms (evidence = the ticket, or a reference doc) **or** state explicitly — in the plan and in the README's contested-vocabulary follow-up — that these terms are unattested in the committed reference set and are deliberately deferred, with the extracted-text evidence that they are unattested (see M2 below for how to get that evidence).

**MINOR — the architect's `stage-rules.evidence.md` is dropped (plan-t62.md:72) without saying where rule provenance lands.** D3 puts evidence inside the JSON, but the per-rule provenance table (which doc, which page, which corpus sha) then exists only as machine JSON. Acceptable; the README requirement list must say so.

Otherwise the ticket's three bullet groups and three ACs are represented: vocabulary widening (M1), body-not-title reading (D2 window + `text`/`hint` source), ambiguity with both candidates (D5/D7), versioned rule set + corpus re-run (D9), coverage report (D6). AC mapping is in plan-t62.md:387-392.

---

## C2 — INTERNAL CONSISTENCY

**BLOCKER — M2's test file cannot exist at M2: three of its 21 tests need modules and artefacts that are created after M2.**
- M2 owns `tests/discovery/harvest-stage-rules-v2.test.ts` and is `blocked_by: [M1]` (plan-t62.md:65; work-order-t62.json:48-51).
- Test 18 asserts `renderCoverageTable(...)` byte-equals the committed `.md` (plan-t62.md:206) — but `renderCoverageTable` lives in `scripts/harvest-stage-rules-v2.ts`, which is **M3's** file (plan-t62.md:218), and M3 is `blocked_by: [M2]` (work-order-t62.json:69-72).
- Tests 17, 19, 20 read the committed `coverage-v2-vs-v1.json` / `classifications-v2.jsonl` (plan-t62.md:205-208) — those are **M5's** files (plan-t62.md:248-288), and M5 is `blocked_by: [M1,M3,M4]`.
- The work order makes it a hard acceptance: `"21 tests green: 13 per-rule + frozen-v1 code-vs-data + committed-manifest reproduction + md==render(json) + ambiguity shape + sidecar coverage + 4 negative prose traps"` (work-order-t62.json:55) — impossible at M2.

Required change: split the test file by owner. M2 → `tests/discovery/stage-rules.test.ts` (classifier unit tests, 13 per-rule tests, v1 freeze; no artefact reads, no M3 import). M5 → `tests/discovery/stage-rules-artifacts.test.ts` (md==render(json), sidecar shape, v1_reproduced, ambiguity list) and add that file to M5's `touches`/`files_created`; M5's `blocked_by` already covers M3 and M4. Update the counts ("21 tests" → per-file counts) in both the plan and the work order.

**MAJOR — M1's own acceptance command depends on a file M1 does not own, and contradicts M2's purity rule.**
- M1's key command is `npx tsx scripts/stage-rules.ts --selftest` (plan-t62.md:64; work-order-t62.json:42) but `scripts/stage-rules.ts` is created by **M2** (plan-t62.md:65) and M1 has `blocked_by: []`.
- `--selftest` must read the two JSON files → file I/O, while M2's acceptance says `"scripts/stage-rules.ts has no fs/fetch import"` (work-order-t62.json:54).

Required change: put `--selftest` on the M3 CLI (which owns the CLI and may do I/O), and restate M2's purity rule as "no `fs`/`fetch` in `classify`/`loadRuleSet`".

**MINOR — `touches` globs are otherwise disjoint and correct.** M1 owns `stage-rules.v{1,2}.json`; M2 `scripts/stage-rules.ts` + its test; M3 `scripts/harvest-stage-rules-v2.ts`; M4 `.autoforge/tmp/stage-rules-v2-cache/**`; M5 the four artefacts; M6 `README.md`. No file is claimed by two modules. The cache and the two rule JSONs are the only shared mutable artefacts and both are expressed as `blocked_by` edges (plan-t62.md:333) — except the test file (blocker above) and the cache default path (M3 CLI default `--cache .autoforge/tmp/stage-rules-v2-cache/` is inside M4's glob ✓).

**MINOR — work-order parallelisation contradicts its own DAG.** `"M7 lint/typecheck can start once M1-M4 land"` (work-order-t62.json:194) vs `M7.blocked_by = [M1..M6]` (work-order-t62.json:157). Either drop the clause or split M7 into M7a (lint/typecheck) and M7b (final verification).

---

## C3 — TESTABILITY / AC1

**Plain verdict: AC1 is PARTIALLY MET.** "A test per new rule" is met (13 rule ids, 15 per-rule `it()`s). "Using real titles from the corpus" is met for **4 of 13 rules**; the other 10 are tested by feeding the rule's own `evidence.phrase` back into the classifier and asserting the rule id appears (plan-t62.md:211) — a tautology that proves the regex compiles, not that the rule fires on real language.

Rules with a real corpus-title test: `CA-FEAS` (rows 1 "PLANNING STAGE", 19 "Stage 1 Road Safety Audit"), `CA-DETAIL` bare "stage 3" (row 13), `CA-PREOPEN` (row 9 "WAITEMATA GREENWAYS PRE-OPENING"), `CA-ASSET` (row 7 "Transitway Station Design"), plus row 33 for the two-candidate case.
Rules with only an echoed-phrase test: `CA-PRELIM`, `CA-DETAIL` ("detail design"), `CA-EXISTING`, `CA-CONSTR`, `CA-PRELIM-FR`, `CA-DETAIL-FR`, `CA-AMBIG-FUNCPLAN`, `CA-AMBIG-CONCEPT`, `CA-AMBIG-AVP`, `CA-AMBIG-PCT`.

Two rules have **no corpus row at all** — `CA-CONSTR` (plan-t62.md:196) and `CA-AMBIG-CONCEPT` (plan-t62.md:200) — yet the AC1 mapping claims "each bound to a named manifest row (sha256 + real title)" (plan-t62.md:389). That mapping row overclaims.

**All 12-char sha prefixes the plan names do exist in the manifest** — no wrong sha. Verified against `docs/RSA-Documents/canada-intake-manifest.jsonl` (33 rows): `0af7ea584ae0`(1) `0d9a76ff4e71`(7) `babe092a5473`(9) `2b3115c3438b`(13) `e8810b8a08ac`(16) `ed2c0d694461`(19) `2ea94190b6df`(23) `1530d327c4c3`(26) `2d4322f39383`(33). The quoted titles also match the manifest exactly.

Cheapest honest fix (keeps tests offline and deterministic, commits no body text): **test each rule against the committed open-licence reference PDFs**, which are already in the repo (`docs/references/CA/*.pdf`, 7 files, listed with licence + provenance in `docs/references/CA/MANIFEST.md`), extracting at test time with the already-present `unpdf` (`package.json:31`; used at `scripts/harvest-track-a.ts:924`) and committing nothing. Every rule except the corpus-only ones has an attested anchor there:

- `qc-mtq-guide-audits-securite-routiere-2012.pdf`: `avant-projet préliminaire`, `avant-projet définitif`, `plans et devis préliminaires`, `plans et devis définitifs`, `après ouverture`, `travaux`, `mise en service` (x4 — and in context "de l'évaluation (mise en service)", i.e. commissioning, which is exactly the v1 false positive).
- `unb-transportation-group-rsa-guidelines.pdf`: `post-opening` (x40), `in-service`, `preliminary design`, `detailed design`, `pre-opening`, `stage 1/2/3`, `during construction`, `construction stage`, `already in service`.
- `ontario-good-roads-rsa-guideline-2023.pdf`: `concept design` (x16), `feasibility stage` (x14), `planning stage`, `detailed design`, `pre-opening`, `post-opening` (x16).
- `alberta-transportation-rsa-implementation-plan-2004.pdf`: `90%-100% Design Audit`, `in-service road safety audit` (x6), `functional plan`, `planning stage`.

That single change turns 10 tautological tests into real-phrase tests **and** fixes the evidence-attestation defect below.

---

## C4 — DETERMINISM + REPRODUCIBILITY

**MAJOR — the committed json and sidecar are not offline-reproducible, and the plan does not say so.**
`compare` classifies from the cached bodies (plan-t62.md:231) and the cache is gitignored (`git check-ignore -v .autoforge/tmp/stage-rules-v2-cache/x.pdf` → `/home/oc/repos/AuditorAI/.git/info/exclude:7:.autoforge/`). So:
- `coverage-v2-vs-v1.md` is byte-derivable from the committed json ✓ (this is what D6 requires and what test 18 asserts — fine);
- `coverage-v2-vs-v1.json` and `classifications-v2.jsonl` (which carry `candidates`, `rule_ids`, `matched_phrase`, `offset`) are **not** derivable from any committed input — they need the 33 bodies.

The plan says "the whole pipeline is re-runnable offline from the cache" (plan-t62.md:344) — true only with the cache present, and the cache is not in git. Required change: state the reproducibility boundary explicitly in §8 of the coverage md and in the README: *json + sidecar are network-derived, produced once, sha-pinned to the rule files; the md is byte-derivable from the json; `render` reproduces the md with no corpus and no network.* Also add an ambiguity re-render path: `renderAmbiguousTable` exists (plan-t62.md:218) but `render` only accepts `--from …coverage-v2-vs-v1.json` (plan-t62.md:232) — `ambiguous-v2.md` has no derivation check.

**MAJOR — test 17 cannot fail.** Test 17 asserts `coverage-v2-vs-v1.json.v1_reproduced.mismatches` is empty, i.e. it reads a field of the committed artefact produced by the same run (plan-t62.md:205). A wrong v1 reproduction is written into the artefact and then "verified" by reading it back. Required change: compute the v1 reproduction inside the test from the live `detectStage` (the same comparison as test 16) over the rows whose body was fetched, and assert `mismatches == []` on that computation; keep the committed-artefact read only as a shape check.

**MINOR — non-determinism inventory (all fixable, all currently unstated).**
- `bodies.fetched` / `bodies.unavailable_rows` (plan-t62.md:280) depend on the network run → the md's §1 changes between runs. Acceptable only if the md is committed once and the plan says the number is a record of that run, not a reproducible value.
- JSONL ordering: "sorted by sha256" (plan-t62.md:235,248) ✓ fixed. Manifest row order is not used ✓.
- No timestamps / absolute paths / hostnames in outputs (plan-t62.md:235) ✓ consistent with the repo precedent `scripts/harvest-track-a-report.ts:357`.
- `scope_basis` and the candidate tie-break are fully specified (tier → declaration order → stage ASCII, plan-t62.md:183) ✓ no floats, no model, no randomness.

**MAJOR — the v2 scan input is unspecified, and it decides the artefact.** M2.2 step 1 scans `text` only (plan-t62.md:174) and step 3 runs tier-1 rules "over the scanned text" (plan-t62.md:176), but the rule table marks `CA-ASSET` "title tier only" (plan-t62.md:100) and `StageRule` (plan-t62.md:126-139) has **no scope field**. Nothing states whether the title is scanned alongside the body when a body is present. That single choice changes row 33's verdict, `matched_phrase`, `evidence_scope` and therefore every "moved" count. Required change: add `scope: "text" | "title" | "any"` to `StageRule` and define the v2 scan input exactly (recommend: body + title, both scanned, with the scope field deciding which rules may match the title).

---

## C5 — THE COMMITTED-BASELINE CLAIM (D6 Table B) — the most important check

**The number 1/0/1 is real, but the plan's Table B derivation is wrong as written.**

Verified derivation (command run in this worktree, using the repo's own code):

```
$ npx tsx /tmp/t62-c5.ts      # imports mergeRows/parseLicenceRegister from scripts/harvest-track-a-report.ts
merged rows: 335
after-have: {"canada:FEASIBILITY_CONCEPT":1,"canada:PRELIMINARY_DESIGN":0,"canada:DETAILED_DESIGN":1}
candidates: [{"sha":"a24707c6081a","tier":"T3","stage":"detailed","cell":"canada:DETAILED_DESIGN","jur":"ON",...},
             {"sha":"0af7ea584ae0","tier":"T3","stage":"FEASIBILITY_CONCEPT","cell":"canada:FEASIBILITY_CONCEPT","jur":"AB",...}]
```

That reproduces `docs/RSA-Documents/track-a-round2-harvest-report.md:35` exactly (FEAS 1 / PRELIM 0 / DETAIL 1; targets 13/41/41 and priorities 0.9231/3/3 confirmed in `state/odd-coverage.json`).

**The denominator that reproduces 1/0/1 is the MERGED corpus (inventory 304 + manifest 33, deduped by sha256 → 335 rows), classified with the repo's `mergeRows()` (`scripts/harvest-track-a-report.ts:233-298`) and its `coverage_candidate` predicate.** The two candidates are `a24707c6081a…` (inventory-only, jurisdiction ON, inventory `stage: "detailed"` → `canada:DETAILED_DESIGN`) and `0af7ea584ae0…` (manifest row 1, AB).

**What the plan got wrong:**
1. The plan never states the merge. Table B's predicate is only "Canadian, tier T3/T4, and its stage maps to a canonical cell" (plan-t62.md:294) — the report's rule has four more load-bearing clauses: `klass === "rsa-sample"`, `!row.duplicate` (`dup_of`), licence not `BLOCKED`, and sha256 dedup where **the manifest wins tier/stage** and the inventory wins class (`scripts/harvest-track-a-report.ts:255-268`).
2. With the manifest's own 33 rows and the plan's stated predicate, the result is **1 / 0 / 0**, not 1/0/1: only row 1 (`0af7ea584ae0`, AB, T3, `canada:FEASIBILITY_CONCEPT`) qualifies; `e8810b8a08ac` (T3, PRELIMINARY_DESIGN) has no `ca_province`, and row 23 (`2ea94190b6df`, NB, T3) is `PRE_OPENING` (no cell). The manifest's committed `cell_key` counts are `canada:FEASIBILITY_CONCEPT` 10 / `canada:PRELIMINARY_DESIGN` 3 / `""` 20 — which is what the plan's own §1 facts table records (plan-t62.md:44) and which is **not** the coverage table.
   - The plan's own §1 (plan-t62.md:44) and §3 (plan-t62.md:294) therefore mix two different denominators: 10/3/20 are *cell occupancy*, 1/0/1 is *coverage candidates in the merged corpus*. A reader of the md will read "1/0/1" against "have (v1) 10/3" and see a contradiction.

Required change: Table B must be defined as *"the repo's `mergeRows(inventory, manifest)` (335 rows), counted with the repo's `coverage_candidate` predicate, imported unmodified from `scripts/harvest-track-a-report.ts`"*; record `merged_rows: 335` and the two candidate shas in `coverage-v2-vs-v1.json`; and state in §1 that Table A's 10/3/20 are cell *occupancy* over the 33 manifest rows while Table B's 1/0/1 are *coverage candidates* over the merged 335 — two different populations, never mixed.

---

## C6 — FIDELITY OF v1

**BLOCKER — the frozen v1 rule set cannot reproduce v1 behaviour as specified: the schema has no regex flags and all four v1 rules are case-insensitive.**
- `scripts/harvest-track-a.ts:516-520` — all four rules are `/…/i`.
- `StageRule` (plan-t62.md:126-139) has `pattern: string; // regex source, no delimiters` and **no flags field**; `RuleSet` (plan-t62.md:140-146) has no default-flags field; the loader (plan-t62.md:169) is unspecified.
- Consequence: with a naive `new RegExp(pattern)` the frozen v1 loses case-insensitivity — corpus row 1's title is `"PLANNING STAGE"` (uppercase) and would stop matching `planning stage`, so `classify(..., v1)` ≠ `detectStage(...)` and the "frozen" baseline silently drifts.

Required change: add `flags` (default `"i"`) to the rule schema, record the exact flags in `stage-rules.v1.json`, state the compile flags in the loader, and make the v1 test compare **compiled regexes** (source pattern + flags) against the live module, not only behaviour.

**BLOCKER — `MULTI_STAGE` is not representable in the plan's own types.** `StageOrUnstaged = CanonicalStage | "UNSTAGED"` (plan-t62.md:121) and `CanonicalStage` (plan-t62.md:115-117) has no `"MULTI_STAGE"` — yet M2.2 step 2 requires the v1 path to return `stage: "MULTI_STAGE"` (plan-t62.md:175). 13 of the 33 committed rows are `MULTI_STAGE` (manifest `stage` counts: FEASIBILITY_CONCEPT 10, UNSTAGED 6, MULTI_STAGE 13, PRELIMINARY_DESIGN 3, PRE_OPENING 1). Required change: add `"MULTI_STAGE"` to the stage union (v1-only token; D14 is about the *new* tokens EXISTING/CONSTRUCTION).

**MAJOR — the "character-identical" acceptance is not mechanically defined, and the plan contradicts itself about v1's `cells`.**
- plan-t62.md:82: "the 4 regex sources are character-identical to `:517-520`" — the source regexes are TS literals with delimiters and flags; the JSON stores a bare source string. Nothing says how the comparison is done, so the check can be satisfied by a human reading both sides.
- plan-t62.md:80 says `cells` = "literal copy of `CANONICAL_STAGE`" **and** "`PRE_OPENING` maps to `""`" — but `CANONICAL_STAGE` (`scripts/harvest-track-a.ts:523-527`) has exactly three keys and no `PRE_OPENING`; while plan-t62.md:82 says `cells` must "deep-equal `MANIFEST_STAGE_TO_CELL` restricted to its 3 mapped keys". Three mutually inconsistent statements.
- The window citation is off by one: plan-t62.md:80 cites `scripts/harvest-track-a.ts:539` for `text.slice(0, 8000)`; it is at **:538**.

Required change: define the v1 check mechanically — parse the four `/…/i` literals out of `scripts/harvest-track-a.ts:517-520` at test time and compare `{source, flags}` to the JSON entries, failing if the source file changes; keep v1 `cells` byte-equal to `CANONICAL_STAGE` (3 keys) and let `PRE_OPENING` be resolved by the "unknown stage → no cell" rule, not by an added key.

**MINOR — the behavioural-equality input set is good but must include the multi-stage and hint cases.** The plan's inputs (33 manifest titles + the literals at `tests/discovery/harvest-track-a.test.ts:69-79` and `tests/discovery/harvest-track-a-round2-report.test.ts:108-119` — both verified to exist) cover: single-stage (`Stage 1/2/3`, `Pre-opening`), multi-stage (`covers planning stage and detailed design` → `MULTI_STAGE`), French (`etude preliminaire` → PRELIMINARY, `rapport detaille` → DETAILED, `Audit avant ouverture` → PRE_OPENING, `Planification et etude de faisabilite` → FEASIBILITY) and the hint fallback (`Rapport` + hint `UNSTAGED` → `UNSTAGED`). Add one case where two rules of the *same* stage fire (the live code collapses distinct **stages**, not distinct rules — `const distinct = [...new Set(hits)]`, `scripts/harvest-track-a.ts:541`) so the frozen v1 must not collapse per rule.

---

## C7 — HARMS / BLAST RADIUS

Verified clean:

- **Cache location** — `git check-ignore -v .autoforge/tmp/stage-rules-v2-cache/x.pdf` → `/home/oc/repos/AuditorAI/.git/info/exclude:7:.autoforge/` ✓ ignored (and `.gitignore:57` `.autoforge/*` covers it too). `git check-ignore -v docs/research/stage-rules/README.md` → exit 1, **not ignored** ✓ so the new artefacts are committable.
- **No write under `docs/RSA-Documents/`** — the plan's CLI is a separate script that never calls the harvester's `intake` path (`scripts/harvest-track-a.ts:1245-1256`) or the known-hash gate (`:274-304`); `git diff --stat -- docs/RSA-Documents` is in M4.2 and M5.5's acceptance ✓.
- **D13 untouched set** — `scripts/harvest-track-a.ts`, `docs/RSA-Documents/**`, `policies/**`, `src/**`, `state/odd-coverage.json`, the 3 harvest test files: M7.6/M7.7 run `git diff --exit-code --` over exactly that set ✓, and the byte-identity assertions inside the untouched tests (`tests/discovery/harvest-track-a-report.test.ts:251`, `tests/discovery/harvest-track-a-round2-report.test.ts:99` — both verified to exist) still run unmodified via M7.4 ✓.
- **No git mutation** — no plan step commits, branches or resets; `git status --porcelain` is read-only ✓.
- **Vault determinism** — `node scripts/vault-sync.mjs --check` (the CI-equivalent, per AGENTS.md) is read-only ✓; the plan correctly does not run `vault-import.mjs` bare.
- **No new dependency** — `unpdf` already present (`package.json:31`) ✓.

Real blast-radius gaps:

**MAJOR — unbounded download.** The fetch writes the whole body to `<sha256>.pdf.part` and hashes it afterwards (plan-t62.md:230). The repo's own precedent is a 5 GiB cap (`scripts/harvest-track-a.ts:58` `BYTE_CAP_BYTES = 5 * 1024 * 1024 * 1024`) and the operator constraint is "never download large files" — the plan sets no per-file and no total cap. The corpus is 48.9 MB total with a largest row of 11,126,108 bytes, so a 25 MB/file and 64 MB total cap is safe. Required change: enforce both caps **while streaming**; a row exceeding them is aborted and reported as unavailable (`oversize`), never written.

**MINOR — the plan's expected network failures are asserted without evidence and are contradicted by the repo.** plan-t62.md:244 requires "the 2 known-dead hosts (`www.southampton.gov.uk` connect-failed, `consult.kerrycoco.ie` 403)" to be "listed as unavailable, not fatal"; plan-t62.md:50 says "30/33 URLs HTTP 200". The committed candidate log says the opposite:

```
$ grep -i "southampton\|kerrycoco" docs/RSA-Documents/track-a-round2-candidate-log.tsv
r2-ea-study  …  https://consult.kerrycoco.ie/…  200  4028187  a7d0fc4ae596…  ingested
r2-direct    …  https://www.southampton.gov.uk/…  200  27414  2d4322f39383…  ingested
```

and 32 of the 33 manifest shas appear in that log, **all with HTTP 200 and decision `ingested`** (the 33rd is a round-1 row). Required change: drop the "2 dead hosts" claim (or label it as an unverified operator-side observation) and state the expectation as "33 rows fetched and sha-verified; any per-row failure is reported, not fatal". A plan that expects 31/33 will let a real 33/33 run look wrong and a real failure look expected.

**MINOR — stale/partial cache.** No step clears `*.part` leftovers or re-verifies a cached file before use. Cheap fix: `fetch` removes `*.part` at start and re-hashes any existing cache file before reusing it; `compare` treats a cache file whose sha does not match its filename as absent.

**MINOR — no quarantine / licence-register handling.** The plan never mentions `docs/RSA-Documents/LICENSE-REGISTER.md` or `docs/RSA-Documents/QUARANTINE.md`. Because nothing under `docs/RSA-Documents/` is written and every cached body is sha-verified against the manifest, no quarantine entry can be created — but the plan should say so explicitly, because "re-fetching a document" is exactly the case where a reviewer asks whether a new quarantine/licence row is owed. It is not (nothing is committed).

---

## C8 — PARALLELISM SAFETY

- **May run concurrently:** M1 (writes only the two rule JSONs) with anything that only *reads* committed files. M7's lint/typecheck after M1–M4 (per work-order-t62.json:194) — but see the contradiction in C2.
- **Must not:** M2→M3→M4→M5→M6→M7 in sequence, because (a) M2's types are M3's contract, (b) M5 reads the cache dir M4 writes, (c) M3's `render` must exist before M5's `render` invocation, (d) the README quotes M5's final numbers. The plan states this correctly (plan-t62.md:336-338) and the `touches` globs are disjoint — the only shared mutable artefacts are the two rule JSONs (M1→M2/M3/M5 ✓ edges) and the cache dir (M4→M5 ✓ edge).
- **Hole:** the **test file** is shared mutable state between M2 (writes it) and M5 (re-runs it, work-order-t62.json:128) without being in any `touches` list except M2's — that is the C2 blocker. After splitting the file (C2), the artefact test file must be listed in M5's `touches`.
- **Hole:** the plan's "Net: this ticket is a single sequential chain" (plan-t62.md:337) is honest and matches the edges — no false parallelism is claimed. Good.

---

## C9 — HONESTY OF THE CLAIM

The plan is strong here: the README must state the denominators, the v1→v2 delta, the honest coverage impact, the Transitway premise correction, three caveats, repro commands, named follow-ups and the licence note (plan-t62.md:310-318); the AC mapping explicitly labels the goal clause "a result, not a criterion" (plan-t62.md:392) and §7 carries the three caveat lines (plan-t62.md:298).

Residual risks a reader could still fall into:

1. **Table B's v2 column can look like a coverage gain.** §3's "after have" under v2 may exceed 1 (a re-labelled row entering a cell). The md must carry, **on the table face next to the v2 column**: "no new document was fetched for v2 — every v2 cell is a re-labelling of an already-ingested document (newly fetched rows: 0)", not only in §7.
2. **The "22 of 30" figure is wrong** (see C10) — a README that repeats a wrong denominator is a correctness defect, not a style nit.
3. **The README must state the AC1 evidence quality**: which rules are proven against a real corpus title and which only against a reference document / their own evidence phrase. Otherwise "a test per new rule" reads stronger than it is.
4. The README must not say or imply that any document "reached its cell" as a result of v2 unless the coverage table's Table A shows it; the §3 statement (numbers may shrink) is the right frame and must survive editing.

---

## C10 — GAPS the planner missed

| # | gap | evidence / required change |
|---|---|---|
| 1 | No per-file / total download cap | `scripts/harvest-track-a.ts:58` (5 GiB precedent) vs no cap in plan-t62.md:230 → add 25 MB/file + 64 MB total, enforced while streaming (M above). |
| 2 | No owner for PDF text extraction | nothing in the plan says who turns `<sha>.pdf` into text; `compare` is described as reading "cached bodies only" (plan-t62.md:231); `unpdf` is named only in the facts table (plan-t62.md:52) → `fetch` must also write `<sha256>.txt` (NFC, ≤1e6 chars) so `compare` is a pure cache read; state the "no text layer" failure path. |
| 3 | Reproducibility boundary not stated | json+sidecar need the gitignored cache (M above). |
| 4 | Rule evidence is not attested | `docs/references/CA/*.pdf` extracted text contains **0 hits** for `detail design` and **0 hits** for `avant l'ouverture`, yet plan-t62.md:90-91 cites those phrases to UNB p21/p26, ON p12/p43, QC p10, BCT p5 as evidence. The attested MTQ French term is `après ouverture` (post-opening) — which appears in **no** rule, while the unattested `avant l'ouverture` appears in `CA-PREOPEN`. → re-point every evidence entry at a doc/page where the phrase occurs (or at the corpus sha), and add an acceptance that the phrase occurs in the cited document (the C3 reference-PDF test does this for free). |
| 5 | The percentage ladder is discarded | `alberta-transportation-rsa-implementation-plan-2004.pdf` extracted text: `75% completion of the project and is the equivalent of the 90% to 95% stage of the design` → the plan's uniform `NN%` pair throws away a committed equivalence; the ticket's 30/60/90 is never mentioned. |
| 6 | French ticket terms unattested, not stated | `conception préliminaire` / `conception détaillée` / `en exploitation`: 0 hits in all 7 reference PDFs (`exploitation` appears 3× in the MTQ guide only as `Dossier de transfert à l'exploitation`) → the plan must either add the terms or say they are deferred and why. |
| 7 | Determinism of the JSONL | ✓ sorted by sha256 (plan-t62.md:235,248) — no change needed. |
| 8 | Committed reports stay byte-identical | ✓ M7.4 runs the untouched byte-identity tests and M7.6/M7.7 run `git diff --exit-code` — no change needed. |
| 9 | `git status` cleanliness check | ✓ M4.2 / M5.5 / M7.6 — no change needed. |
| 10 | Fetch must not hit the production API | ✓ non-goal 7 (plan-t62.md:362) + the CLI never calls the harvester — no change needed. |
| 11 | Timeout | ✓ `--timeout-ms 30000` (plan-t62.md:230) — but no per-host connect timeout vs total timeout distinction; nit. |
| 12 | Partial-failure labelling | ✓ exit 3 + `body_available:false` (plan-t62.md:234,344) — but `body_available` is not in the `ClassificationRow` type (plan-t62.md:251-270) although the CLI contract and `compare` depend on it → add the field (nit/major: it is the flag that stops a partial run masquerading as a full one). |
| 13 | Robots handling | ✓ robots gate + UA + rate limits cited (plan-t62.md:230) — but the plan does not say a robots refusal is a per-row "unavailable" outcome (must be, to keep exit 3 meaningful). Minor. |
| 14 | Cache invalidation / `.part` cleanup | see C7 minor. |

---

## Required changes before execution

1. **Re-order and split the tests** (blocker): M2 → `tests/discovery/stage-rules.test.ts` (classifier + 13 per-rule + v1 freeze only); M5 → `tests/discovery/stage-rules-artifacts.test.ts` (md==render(json), sidecar shape, v1_reproduced, ambiguity) listed in M5's `touches`/`files_created`. Update the "21 tests" counts in plan-t62.md:213 and work-order-t62.json:55.
2. **Extend the rule schema** (blocker): add `flags` (default `"i"`) and `scope: "text" | "title" | "any"`; record the flags in `stage-rules.v1.json`; state the compile flags and the exact v2 scan input (body + title?) in `classify`.
3. **Add `"MULTI_STAGE"`** to the stage union (the v1 path returns it; 13 committed rows carry it).
4. **Define Table B as the merged corpus**: "`mergeRows(inventory, manifest)` from `scripts/harvest-track-a-report.ts`, unmodified, 335 rows, counted with the repo's `coverage_candidate` predicate" — and record `merged_rows: 335` plus the two candidate shas (`a24707c6081a…`, `0af7ea584ae0…`) in the json. Add a line to §1 distinguishing Table A's 10/3/20 cell *occupancy* over the 33 manifest rows from Table B's 1/0/1 *coverage candidates* over the merged 335.
5. **Make the v1 freeze mechanically provable**: parse the four `/…/i` literals from `scripts/harvest-track-a.ts:517-520` at test time and compare `{source, flags}` to the JSON; keep v1 `cells` byte-equal to `CANONICAL_STAGE` (3 keys).
6. **Fix the test-17 vacuity**: compute the v1 reproduction in the test from the live `detectStage`, not from the committed artefact.
7. **Fix AC1 honestly**: replace the 10 echo-the-phrase tests with tests that extract the committed `docs/references/CA/*.pdf` at test time (unpdf) and assert the rule fires on the cited phrase/page; and correct the AC1 mapping row (plan-t62.md:389) — `CA-CONSTR` and `CA-AMBIG-CONCEPT` have no corpus row.
8. **Close the spec gap**: either add rules for `conception préliminaire`, `conception détaillée`, `audit de sécurité routière en exploitation` and the 30/60/90 ladder, or state (plan + README follow-up) that they are unattested in the committed reference set and deferred — with the extraction evidence.
9. **Re-point the evidence**: `detail design` and `avant l'ouverture` are not in the cited PDFs (0 hits in all 7); use attested phrases (`après ouverture`, `90%-100% Design Audit`, `concept design`, `in-service road safety audit`, `post-opening`, `plans et devis préliminaires/définitifs`) and add an acceptance that each evidence phrase occurs in its cited document.
10. **Bound the download**: 25 MB/file, 64 MB total, enforced while streaming; oversize rows reported, not written.
11. **Give PDF extraction an owner**: `fetch` also writes `<sha256>.txt` into the cache; `compare` reads text only.
12. **State the reproducibility boundary** in the coverage md §8 and the README; add an ambiguity re-render path (`render --from classifications-v2.jsonl`).
13. **Correct the numbers**: "22 of the **29**" Canadian T3/T4 inventory rows are `existing` (not 30) — plan-t62.md:313, plan-t62.md:392, work-order-t62.json:142; add `body_available` to `ClassificationRow`; drop the "2 dead hosts / 30 of 33 HTTP 200" claims (the committed candidate log shows both hosts at HTTP 200, ingested, and 32/32 logged rows at 200).
14. **Move `--selftest`** off the pure module onto the M3 CLI; restate M2's purity rule as "no `fs`/`fetch` in `classify`/`loadRuleSet`".

---

## What the plan got RIGHT (do not re-open)

- The **D1–D14 lock is honoured literally** — the confidence enum matches `docs/adr/0002-canonical-stage-model.md:24`; the v1 baseline is left untouched in `scripts/harvest-track-a.ts`; the new stage tokens appear only in the sidecar/table; the committed manifest is never written.
- **D10 is implemented exactly as locked**: the Transitway row (manifest row 7, `0d9a76ff4e71…`, "Transitway Station Design") stays `UNSTAGED` with `asset_type: "station"` and no cell — the motivating premise is corrected rather than accommodated.
- **D11's tiering is a genuinely good design**: Tier-1 named rules win, Tier-2 emits a *pair* with `inferred` confidence and **no cell**, so a contested vocabulary never forces a stage. That is exactly the ticket's "record BOTH candidates and a confidence, never force a single stage".
- **The licence constraint is handled correctly**: 32/33 rows are `RESTRICTED` (verified in the manifest: only row 1 `0af7ea584ae0` is `CLEAR`), the corpus cache is gitignored (`git check-ignore` confirms), and no body text is committed — only short TERM quotes and source references.
- **The two-denominator discipline is right in spirit** (D6/§1 of the md, README item 1) and the §4/§6 separation of cell-level "moved" from stage-token changes is correct.
- **The 1/0/1 baseline is real** and was reproduced here from the repo's own code (see C5) — the promise "earlier before/after comparisons stay valid" is achievable; only the plan's *description* of the denominator must be corrected.
- **The determinism discipline** (sha-sorted rows, no timestamps/paths/hostnames, md rendered from json) matches the repo's byte-reproducible-report precedent (`scripts/harvest-track-a-report.ts`).
- **The honesty framing** of the goal clause (a result, not a criterion), the three caveats, the follow-up naming and the licence note are the right shape; the gaps above are corrections of detail, not of intent.
- **The module split and the `touches` discipline** are sound (disjoint globs, explicit `blocked_by`), and the plan's own conclusion that this ticket is a single sequential chain is accurate rather than optimistic.

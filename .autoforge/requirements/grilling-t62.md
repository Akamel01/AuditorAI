# Requirements grilling — ticket #62 (stage-classifier rule set v2)

- Ticket: `Akamel01/AuditorAI#62` — "Stage classifier: map real-world RSA titles to ODD stages, so T3 documents reach their cells". Parent `#41`.
- Worktree: `oc/62` @ `5dcaddb`. **Read-only investigation** — no repo file, git ref or manifest was modified by this session. The only file written is this document.
- Inputs read in full: `.autoforge/discovery/report-t62.md` (561 lines), `.autoforge/discovery/tracker-index-t62.md` (41 lines), plus the repo itself.
- Labels used throughout: **[F]** = fact, with a `file:line` or a quoted command output; **[I]** = inference; **[R]** = recommendation.
- Every command quoted below was run in this worktree on 2026-10-22. Where the discovery report's line numbers are off by 1–2 lines, the **verified** line number is given and the discrepancy is flagged.

---

## 0. Verdict up front

1. **[F] The ticket's motivating document names no stage, and it is not the only problem.** The ticket's example vocabulary ("station, corridor or functional design") names *asset types*, not stages. The document that motivated the ticket (`0d9a76ff…`, "Transitway Station Design Safety Audit – Analysis of Findings") contains **zero** occurrences of `stage`, `preliminary`, `detailed`, `detail design`, `feasibility`, `pre-opening`, `corridor`, `functional plan`, `30%`, `60%`, `90%` in 111 402 extracted characters (see §3.2, command output). It also contains **no** `in-service road safety review` phrase — the three `in-service` hits are prose about barrier end-treatment and traffic signing.
2. **[F] The document that *is* the corpus's only `canada:DETAILED_DESIGN` candidate is a different file, and its own body contradicts its label.** `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` labels `OC_Transpo_Transitway_RSA.pdf` (`a24707c6…`) as stage `detailed`, `label_confidence: "anchor"`; the same inventory labels the byte-different twin (`b28c45bf…`, committed as `tests/fixtures/samples/CA/on-ottawa-octranspo-transitway-safety-study-2021.pdf`) as stage `existing` with evidence `stage:text:in- service`. Re-fetching `a24707c6…` and extracting its text gives: *"The primary objective for this **in-service road safety review** was to identify any elements which may have a negative impact…"* — and the two files' extracted text is **byte-identical** (69 366 chars, `identical text? true`).
3. **[F] Therefore the ticket's stated goal is partly unattainable as written, and the unattainable part is a *policy* gap, not a vocabulary gap.** `policies/canada/pack.json:80` gives `ca-tac:pre-opening` `"canonical_stages": []`, and **no** Canadian cell exists for in-service / existing-roads audits. 22 of the 29 Canadian T3/T4 on-disk rows are `existing` (§3.7).
4. **[R] No blocking human decision is required.** All ten questions below are resolvable from repo evidence. Three items must be *reported* (not decided) to the ticket author — the Transitway premise correction, the `a24707c6` anchor/body contradiction, and the in-service cell policy follow-up (§5).
5. **[R] The plan the planner should implement** is in §3 (recommended reading per question), §4 (AC mapping) and §6 (risks).

---

## 1. Requirements restated

Decomposed from the ticket's four bullets + three acceptance criteria into statements a planner can implement and a reviewer can check.

| # | Requirement (restated) | Source | Testable? |
|---|---|---|---|
| R1 | The stage rule set must cover Canadian practice vocabulary in **English and French**, including asset/project descriptors (station, corridor, functional design), design-percentage markers (the ticket says 30/60/90), and Quebec stage names ("conception préliminaire", "conception détaillée", "audit de sécurité routière en exploitation"). | ticket bullet 1 | partly — three of the ticket's five examples are **not** Canadian vocabulary (§3.2) |
| R2 | Classification must read the **document body**, not only the title — specifically the scope section, the drawings stage, and the RSA stage, in the TAC guide's terms. | ticket bullet 2 | yes, but "the scope section / drawings stage" are undefined; §3.4 gives a deterministic reading |
| R3 | A genuinely ambiguous document must record **both candidates and a confidence**; a single stage must never be forced. | ticket bullet 3 | yes |
| R4 | The round-1 and round-2 corpora must be re-run under the new rules **as a new, versioned rule set**, so the committed before/after comparisons stay valid. | ticket bullet 4 | yes — but "the corpora" needs a denominator (§3.1) |
| R5 | Report how many documents move into which cells. | ticket bullet 4 | yes |
| AC1 | A test per new rule, using **real titles from the corpus**. | ticket AC1 | partly — the corpus "title" field is the PDF's first meaningful text line, not a human title (§3.2, §3.10) |
| AC2 | A coverage table under rule set **v2 versus v1**. | ticket AC2 | yes |
| AC3 | Ambiguous documents listed with **both candidate stages**. | ticket AC3 | yes |

**Out of scope by the ticket and by the operator** (do not plan around these): changing `policies/canada/pack.json`; changing the committed manifest `stage` shape; touching `docs/RSA-Documents/**`; the Postgres tenant store (PR #59, `TENANT_STORE=postgres` off in production); a box (`oc-box`) re-run; production behaviour (the classifier is harvest-only, `scripts/harvest-track-a.ts:964` is its only production call site — **[F]** `grep -rn "detectStage\|detectStageWithSource"` finds only `scripts/harvest-track-a.ts:547-548` and the two test files).

---

## 2. Assumptions (each with how to falsify it)

| # | Assumption | Falsification |
|---|---|---|
| A1 | The ticket's "round 1 and round 2 corpora" = the 33 rows of `docs/RSA-Documents/canada-intake-manifest.jsonl` (3 round-1 rows without a `round` field, 30 with `round:"2"`). | **[F]** `node -e` over the manifest: `manifest rows 33`, `round field {"2":30,"undefined":3}`, `tier { T3: 9, T1: 24 }`. The committed round-2 report already uses exactly this split: *"`Before` is the corpus at the round-1 state - the manifest rows without `round: "2"`"* (`docs/RSA-Documents/track-a-round2-harvest-report.md` §1; `scripts/harvest-track-a-round2-report.ts:184`). |
| A2 | The committed coverage tables' population is **merged rows** (304 inventory rows + manifest rows), not the 33 manifest rows. | **[F]** `scripts/harvest-track-a-round2-report.ts:183-188` — `mergeRows(inventory, manifest, licence)` then `candidatesByCell`. **[F]** `scripts/harvest-track-a-report.ts:289-296` — the coverage predicate. |
| A3 | A coverage candidate is: Canadian (13 `ca_province` codes or `CAN-GOV`), tier T3/T4, `cell !== null`, class `rsa-sample`, not a duplicate, not licence `BLOCKED`. | **[F]** `scripts/harvest-track-a-report.ts:289-296`; the same rule in prose at `docs/RSA-Documents/track-a-harvest-report.md` §"Rules applied". |
| A4 | The v1 baseline for the coverage table is **1** document in `canada:FEASIBILITY_CONCEPT`, 0 in the other two cells. | **[F]** recomputed from the manifest with the A3 predicate: `{ 'canada:FEASIBILITY_CONCEPT': 1 }`; and the committed round-2 table says `before have 1 / after have 1`, `canada:PRELIMINARY_DESIGN 0`, `canada:DETAILED_DESIGN 1` (**note**: the DETAILED_DESIGN `1` comes from the *inventory* row `a24707c6…`, not from a manifest row — see A5). |
| A5 | The corpus's only `canada:DETAILED_DESIGN` candidate is an **inventory** row, `a24707c6…`, whose stage is a human *anchor* that its own body contradicts. | **[F]** `docs/RSA-Documents/track-a-harvest-report.md` §1 lists it: *"`a24707c6…` — on-disk — T3 — detailed — canada:DETAILED_DESIGN — class `rsa-sample` — label confidence `anchor`"*. **[F]** re-fetch of the committed candidate-log URL yields sha `a24707c6…` and the text *"The primary objective for this in-service road safety review…"*. |
| A6 | The corpus has **committed CA bodies** usable for offline tests: `tests/fixtures/samples/CA/*.pdf` (11 files) and `docs/references/CA/*.pdf` (7 files). | **[F]** `sha256sum tests/fixtures/samples/CA/*.pdf` → `0af7ea584ae04908…` (= the manifest's only CLEAR T3 row), `bb9850fe4780789f` (functional-plan RSA), `6c38a1a99caaa666` (UNB exemplary audits, T4 pre-opening), `b28c45bf100bb713` (Ottawa transitway), `6b67c5ed28662f6c` (MB in-service review), `21a60cfcb38b486f` (corridor thesis). |
| A7 | The manifest `title` field is the **first meaningful line of the extracted PDF text**, not a human title. | **[F]** `scripts/harvest-track-a.ts:1022` — `title: (text.split("\n").find((l) => l.trim().length > 8) ?? fileName).trim().slice(0, 160)`. Manifest titles include `"Date: March 17, 2004"`, `"APPENDIX H"`, `"OCTOBER 2024 FINAL"`, `"FULL DAYS"`, `"CONFIDENTIAL"`, `"23-160-006.01"`. |
| A8 | The repo already has a canonical, three-value vocabulary for expressing uncertainty. | **[F]** `docs/adr/0002-canonical-stage-model.md:21` — *"Mapping confidence uses exactly three labels: `authoritative | interpreted | inferred`"*; enforced by `contracts/schemas/odd-declaration.schema.json:47` and `contracts/schemas/discovery-match.schema.json:17`. |
| A9 | No Canadian ODD cell exists for a multi-stage or in-service document. | **[F]** `policies/odd.json` — exactly one cell has >1 canonical stage: `uae` / `ae-ad:S12-combined` → `["PRELIMINARY_DESIGN","DETAILED_DESIGN"]`. No `ca` cell is multi-stage. `src/domain/odd.ts:74-89` resolves a cell by the **sorted set** of canonical stages, so a Canadian multi-stage document resolves to `status: "unlisted"`. |
| A10 | The committed reference PDFs are quotable in a new research artefact. | **[F]** precedent: `docs/research/canada-rsa-research.md:300-315` quotes the MTQ passage verbatim and `state/evidence-registry.json:1579` records it as `EV-CA-032`. |
| A11 | The 8 RESTRICTED T3 rows may have their **stage verdicts** committed, but not their body text. | **[F]** `docs/RSA-Documents/LICENSE-REGISTER.md:10,26-32` — `canadian` and `canada/track-a/*` are `RESTRICTED` (Crown copyright; reuse needs owner sign-off). The committed manifest already carries titles, URLs and licence verdicts for these rows; the extracted text does not exist in the repo. |
| A12 | `docs/research/` is committable and not git-ignored. | **[F]** `git check-ignore -v docs/research/stage-rules/x.md` → **no match**; only `docs/RSA-Documents/canada/track-a/` and `.autoforge/` matched. |

---

## 3. Open questions G1–G10

### G1 — Which set is "the round 1 and round 2 corpora", and what is the coverage denominator?

**Question.** Three candidate sets exist: (a) the 33-row committed intake manifest; (b) `docs/RSA-Documents/track-a-sources.json` (round-1 *source* list); (c) the 108-row `track-a-round2-candidate-log.tsv`. Which is the corpus, and what denominator makes the v2-vs-v1 table comparable to the committed tables?

**Evidence.**
- **[F]** The manifest is the only set that carries a per-document title, tier, stage and cell: 33 rows, `tier {T3:9, T1:24}`, `stage {MULTI_STAGE:13, FEASIBILITY_CONCEPT:10, UNSTAGED:6, PRELIMINARY_DESIGN:3, PRE_OPENING:1}`, `cell {canada:FEASIBILITY_CONCEPT:10, canada:PRELIMINARY_DESIGN:3, "":20}`.
- **[F]** `track-a-sources.json` is a *source* list (7 round-1 sources with `stage_hint`/`doc_type_hint`), not documents. `track-a-round2-candidate-log.tsv` has 108 rows of which only 30 were ingested; the other 78 are `not RSA` / `hash-already-present` / `not a pdf` / robots / 403. Neither is a document corpus.
- **[F]** The committed coverage tables are computed over **merged rows**: `scripts/harvest-track-a-round2-report.ts:183-188` (`mergeRows(inventory, manifest, licence)`), where the inventory is 304 on-disk rows (`scripts/harvest-track-a-report.ts:280-303`). The committed report states the two denominators explicitly: **|A| = 305** before / **|B| = 147** Canadian (`docs/RSA-Documents/track-a-harvest-report.md` §"Row sets").

**Risk per reading.**
- *Manifest-only denominator* — the v1 and v2 columns are computed over the same 33 rows, so the **v1-vs-v2 comparison is exact**; but the resulting "have" numbers are **not** the committed tables' numbers (which include the inventory), so a reader comparing them directly will misread a delta as a coverage change.
- *Merged denominator* — directly comparable to the committed table, but the 304 inventory rows' **bodies are not re-fetchable** (the operator's disk), so their stages cannot be re-classified under v2; they would silently keep v1 labels and inflate the apparent agreement between v1 and v2.
- *Candidate-log denominator (108)* — includes 78 documents that were never ingested; it would count documents that are not in the corpus at all. Rejected.

**Recommendation.**
1. **Two explicitly labelled tables, never mixed** (the repo's own convention: *"Two denominators, never mixed"* — `docs/RSA-Documents/track-a-round2-harvest-report.md` §2).
   - **Table A — re-classified corpus (the ticket's comparison).** Denominator = the **33 manifest rows**, identical bodies under v1 and v2. Columns: `cell | target | priority | have(v1) | have(v2) | usable CLEAR(v1) | usable CLEAR(v2) | moved docs`. This is the table the ticket asks for and the only one whose delta is attributable to the rule set.
   - **Table B — corpus-of-record coverage (comparable to the committed tables).** Denominator = merged rows (304 inventory + 33 manifest) with the A3 predicate and targets from `state/odd-coverage.json`; the v1 column **must equal** the committed round-2 table's "after have" (1 / 0 / 1) or the artefact is wrong. Under v2 the inventory rows keep their committed labels (not re-fetchable) and only manifest rows can move — state that on the table face.
2. State the denominator in the table caption in the same words the committed reports use, so the before/after stays valid: *"a coverage candidate is Canadian, tier T3/T4, and its stage maps to a canonical cell; T0 and T1 never count as coverage."*
3. **Do not** claim the round-2 candidate set was "re-run": only the 33 ingested rows are in the corpus of record. The ticket's wording ("re-run the corpora") is satisfied by a **re-classification**, and the artefact should say so.

**Human needed?** No — repo evidence decides (A1, A2, A3).

---

### G2 — The Transitway problem: what is the ticket actually asking for?

**Question.** The ticket names "station, corridor or functional design" as vocabulary; the motivating document names none of them. Which reading is defensible?

**Evidence (all re-verified here, not taken from the discovery report).**

- **[F] The motivating document was re-fetched byte-identically.** `curl` of the committed manifest URL → 1 151 579 bytes, `sha256 = 0d9a76ff4e71e2b48ff2a5d96081dd7ee5419ec58275ed8587d246d0a0b2793c` — identical to `docs/RSA-Documents/canada-intake-manifest.jsonl`. `pdftotext -layout` → 111 402 chars, 38 pages. Word census: `stage 0`, `design stage 0`, `preliminary 0`, `detailed 0`, `detail design 0`, `feasibility 0`, `pre-opening 0`, `corridor 0`, `functional plan 0`, `functional design 0`, `station design 68`, `in-service 3`, `in service 1`, `existing 4`, `50% 1` (a bus-volume assumption), `60 km/h design speed` (a speed, not a percentage).
- **[F] The three `in-service` hits are prose, not an audit type**: *"recommended action is to leave the current end treatment **in-service**…"*, *"…since being placed **in service**…"*, *"…compared to the **existing condition**…"*. None is `in-service road safety review`.
- **[F] What the document actually is** (§1.1.1): *"In 2020, OC Transpo commissioned an independent **station design safety study** of five stations on the OC Transpo Transitway. The study was conducted by Parsons Inc. and generated a road safety audit report titled **OC Transpo Transitway Station Design Safety Study – Independent Road Safety Study**, dated September 2021. The audit was conducted in general compliance with the procedures described in the Canadian Road Safety Audit Guide produced by the Transportation Association of Canada in 2001"*; it is signed *"Intus Road Safety Engineering Incorporated"*, 28 Sep 2021, and is an **Analysis of Findings** (a contractor's disposition document), i.e. the tier-T3 companion of a study, not the study's stage report.
- **[F] The study's own report says it is an in-service review.** Re-fetch of `https://documents.ottawa.ca/sites/default/files/OC_Transpo_Transitway_Road_Safety_Audit.pdf` → 5 977 941 bytes, `sha = a24707c6…` (the inventory's *anchor* row). Extracted text: *"The primary objective for this **in-service road safety review** was to identify any elements which may have a negative impact… safety of all road users."*; census: `stage 0`, `preliminary 0`, `detailed design 0`, `pre-opening 0`, `in-service 2`, `existing 5`, `station design 51`, `corridor 0`.
- **[F] Two byte-different copies of that one study exist and the repo labels them differently.** `sha256sum` of the committed fixture `tests/fixtures/samples/CA/on-ottawa-octranspo-transitway-safety-study-2021.pdf` = `b28c45bf100bb713…` (6 566 655 bytes); the extracted text of the fixture and of the re-fetched `a24707c6…` are **identical** (`identical text? true`, 69 366 chars each). The inventory labels `a24707c6…` as `stage: "detailed", label_confidence: "anchor"` and `b28c45bf…` as `stage: "existing", label_confidence: "rule", evidence: "…| stage:text:in- service |…"`, with `dup_of` pointing at the other path.
- **[F] The anchor is a plan-derived label, not a body reading.** `label_confidence: "anchor"` with `evidence: "anchor:HARVESTING_PLAN.md#s1 | …"`; `HARVESTING_PLAN.md` is **not** in this repo (`docs/RSA-Documents/track-a-sources.json`: *"The plan lives in the operator checkout … and is read-only"*).
- **[F] "corridor" and "functional design" are not Canadian stage terms.** `on-ryerson-waterloo-corridor-rsa-thesis.pdf` (committed fixture) is a **thesis**, classified `unknown`, `T0`, `unusable`. `corridor` appears in the CA references only in prose.
- **[F] The ticket's three percentage examples are not the corpus's markers.** The corpus uses **50% / 75% / 95%** (UNB guide p141/p142/p146/p154; Alberta "95% stage of the Functional Plan", "before 75% completion"); `30%`/`60%`/`90%` appear in no committed CA source. In the motivating document, `50%` is a bus-volume assumption and `60` is a design speed — a naive percentage rule would mis-fire on both.

**Risk per reading.**
- **(i) Asset-type rule → candidate pair** — delivers the ticket's letter (the vocabulary is honoured) but risks false positives on ordinary prose ("the corridor in which the project is located", ON guide p42). Mitigated only if the rule is **title-tier only** and **never yields a cell**.
- **(ii) Leave UNSTAGED, correct the premise** — maximally honest, but discards the ticket's explicit instruction and loses the information that the document is a *station-design* study.
- **(iii) Both** — asset-type evidence recorded, no stage forced, premise corrected in the artefact. Costs one extra field and one extra rule.

**Recommendation — (iii), with three hard constraints.**
1. **The asset-type cue is evidence, never a stage.** Add a rule `CA-ASSET` matching **station / corridor / functional design** **in the manifest title only** (the title *is* the first meaningful line of the text — A7 — so this is a real, deterministic tier). It records `asset_type` on the record. It **never** produces a canonical stage and **never** produces a cell.
2. **The motivating document's v2 verdict is `UNSTAGED` (no stage named) with `asset_type: "station"`.** It does not reach a cell, and no rule can make it reach a cell, because its own study is an **in-service** review and in-service has no Canadian cell (G7).
3. **The sibling study `a24707c6…` is `EXISTING` (in-service), and that contradicts its committed `anchor: detailed`.** v2 must record this as an ambiguity with **two** candidates — `EXISTING` (body) and `DETAILED_DESIGN` (the committed anchor) — because the ticket's rule says *never force a single stage*, and the repo genuinely holds two answers. If the planner prefers to treat the anchor as out of scope for a body-text classifier, then the record is `EXISTING` single-candidate with a `contradicts_anchor: "DETAILED_DESIGN"` field; either way it must be **surfaced in the artefact**, not silently normalised.

**Can "Transitway Station Design" be a rule test at all?** Yes — it is a real corpus title (`docs/RSA-Documents/canada-intake-manifest.jsonl`, row 7, `tier T3`, `stage UNSTAGED`, `source_id r2-municipal`). Its assertion must be about the *record*, not a forced stage:

```
it("records an asset-type cue without forcing a stage", () => {
  const r = classify(manifestTitle("0d9a76ff4e71…"));   // "Transitway Station Design"
  expect(r.stage).toBe("UNSTAGED");        // no stage named in title or body
  expect(r.asset_type).toBe("station");
  expect(r.candidates).toHaveLength(0);   // never force one
  expect(r.cell_key).toBe("");             // and never a cell
});
```
This test is **offline**: the title is committed in the manifest. The body-level assertions for this document need the fetched PDF (or the committed twin fixture).

**Human needed?** No for implementation. **But the premise correction must be reported** to the ticket author — see §5, E2.

---

### G3 — The "Functional Plan" contradiction: resolvable, or a human ruling?

**Question.** `scripts/harvest-track-a.ts:519` maps `functional plan` → `FEASIBILITY_CONCEPT`; `policies/canada/pack.json:43` makes "At 95% of the Functional Plan before final submission" the **PRELIMINARY_DESIGN** trigger. Which wins?

**Evidence.**
- **[F] The pack holds *both* triggers, and they are distinguishable by qualifier.**
  `policies/canada/pack.json:25` — `ca-tac:planning` trigger: *"Once the desired **functional-planning option** is selected [EV-CA-008]"* → `canonical_stages: ["FEASIBILITY_CONCEPT"]`.
  `policies/canada/pack.json:43` — `ca-tac:preliminary-design` trigger: *"At **95% of the Functional Plan** before final submission [EV-CA-008]"* → `["PRELIMINARY_DESIGN"]`.
  `policies/canada/pack.json:61` — `ca-tac:detailed-design`: *"~90–95% design"*.
- **[F] Alberta's own guide puts the Functional Plan at Stage 2** (preliminary) and "Functional Planning" at Stage 1 — the two phrases are *different project phases*, which is exactly why the bare phrase is ambiguous.
- **[F] The corpus contains a document that proves the phrase is not decisive.** The committed fixture `ab-calgary-glenmore-functional-plan-rsa-2017.pdf` (`bb9850fe…`) contains `functional plan` ×10 **and** `detailed design` ×1; the inventory classifies it `stage: "detailed"` (`stage:text:detailed design`). The other CLEAR row `ab-neahd-planning-stage-rsa-2009.pdf` (`0af7ea58…` = the manifest's only T3 coverage row) contains `planning stage` ×14, `stage 1`, **and** `functional plan` ×2; it is classified `planning` / `FEASIBILITY_CONCEPT`. ⇒ The phrase occurs in documents of *both* stages.
- **[F] A v1 test pins the current behaviour** (`tests/discovery/harvest-track-a.test.ts:70`): `"Stage 1 Road Safety Audit of the functional plan"` → `FEASIBILITY_CONCEPT`. Note the pinned string contains **"Stage 1"** — the FEASIBILITY verdict comes from `stage 1`, not from `functional plan`. The bare phrase alone is *not* pinned by any test. **[I]** → the v1 rule's `functional plan` branch is effectively unpinned, so it can be re-ruled without breaking a documented behaviour.

**Risk per reading.**
- *Keep v1 (FEASIBILITY)* — contradicts the pack's own trigger at `:43`; leaves the contradiction in the code.
- *Switch to PRELIMINARY* — contradicts `:25` and misclassifies the 10 documents that say "functional plan" while naming a planning stage.
- *Candidate pair* — the ticket's own rule; but if the pair is emitted **alongside** a specific stage, the corpus's only coverage candidate (`0af7ea58…`) becomes ambiguous and **loses its cell** → coverage 1 → 0.

**Recommendation.** Resolve it with the ticket's own rule, but give the ambiguity rule a **lower tier** than specific stage rules, so it can never cost a document its cell:
1. Tier 1 — **specific stage rules** (named forms): `planning stage`, `preliminary design`, `detailed design`, `detail design`, `pre-opening`, `stage N`, `concept design stage`, `feasibility stage`, French named forms. If exactly one Tier-1 stage matches → that stage, confidence `authoritative` (named form) or `interpreted` (bare `stage N` — see G4).
2. Tier 2 — **ambiguity rules** (fire only when Tier 1 produced no stage): `functional plan|functional planning` → candidate pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`; `concept design|concept stage` → pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`; `avant-projet préliminaire` → pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`; `NN% design` → pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}`. Confidence `inferred`.
3. Tier 3 — `existing` / `construction` buckets (no cell).
4. Tier 0 — no rule → `UNSTAGED`.
   With this ordering `0af7ea58…` stays `FEASIBILITY_CONCEPT` (Tier 1 fires) → **coverage does not regress**; a document that says only "functional plan" gets the pair and **no cell** (correct: it is genuinely between two stages).
   The qualifier may sharpen Tier 2 without a human: `95% of the functional plan` → `PRELIMINARY_DESIGN` alone (pack.json:43), `functional-planning option` → `FEASIBILITY_CONCEPT` alone (pack.json:25).

**Human needed?** **No.** The pack's two triggers + Alberta's two phases + the two corpus fixtures resolve it, and the ticket's own "both candidates, never force" rule covers the residue. Record the ruling in `stage-rules.v2.md` with the pack line numbers; do **not** edit `policies/canada/pack.json`.

---

### G4 — The 8 000-character window, and a deterministic confidence

**Question.** The ticket says "read the document body, not only the title". The window is the actual defect. What window is defensible, and is "confidence" derivable deterministically?

**Evidence.**
- **[F]** `scripts/harvest-track-a.ts:538` — `const head = text.slice(0, 8000);` — the classifier reads only the first 8 000 characters of the extracted text.
- **[F]** The committed v1 test pins only the *rules*, not the window (`tests/discovery/harvest-track-a.test.ts:68-89`); the byte-identity tests pin the *outputs* of the committed reports (`tests/discovery/harvest-track-a-report.test.ts:251`, `tests/discovery/harvest-track-a-round2-report.test.ts:99`).
- **[F]** The ticket's own three targets are *scope sections*, not the first 8 000 chars: the motivating document's §1.1.1 (the "scope" paragraph) is at the very start, but the study's own stage description (in `a24707c6…`, *"in-service road safety review"*) is in its objectives section; the Alberta equivalency table is p7/p13 of a 20-page document; the UNB stage list is p21 of a 168-page document. **[I]** No fixed prefix captures all of them; a prefix rule is provably the wrong shape.
- **[F] The repo already has a cap convention**: `src/lib/extract.ts:39` — `return cleaned.slice(0, 200_000); // cap stored size`. The harvest path does **not** apply it (`scripts/harvest-track-a.ts:920-925` uses `unpdf` directly).
- **[F] French text is NFC with precomposed accents in the committed reference shelf.** `pdftotext -layout docs/references/CA/qc-mtq-guide-audits-securite-routiere-2012.pdf` → 148 496 chars, `isNFC true`, `isNFD false`; non-ASCII census `é`×1778, `’`×666, `à`×201, `è`×190; `préliminaire`, `définitif`, `sécurité`, `routière`, `évaluation` all present; `avant-projet`×8, `travaux`×15.
- **[F] No NFC normalisation exists anywhere in the repo** (`grep -rn "normalize(\"NFC\")" src/ scripts/` → no match). **[F]** `unpdf` is **not installed in this worktree** (`node_modules` has 0 entries) — the planner must `npm ci` (the npm registry answers `200` from here) before any extraction, and must re-verify accent preservation **through unpdf**, not through `pdftotext`, because the harvester's extractor is `unpdf` (`scripts/harvest-track-a.ts:919-925`).
- **[F] The repo has an established confidence vocabulary**: `authoritative | interpreted | inferred` (`docs/adr/0002-canonical-stage-model.md:21`; `contracts/schemas/odd-declaration.schema.json:47`).

**Risk per reading.**
- *Keep 8 000* — leaves the primary defect in place; the committed v1 numbers stay reproducible only by accident.
- *Whole text, no cap* — deterministic and simplest; a pathological 12 MB PDF (the corpus holds one: `appendix-h.pdf`, 11 126 108 bytes) yields a large string, but text extraction is already O(size) and the harvester does it today.
- *Scope-section extraction* — closest to the ticket's wording, but "the scope section" is not a deterministic, machine-identifiable region across 33 heterogeneous PDFs (the motivating document's scope is §1.1.1; the study's objective is §1; the Quebec checklist is a table). **[I]** A section-extractor would need per-document heuristics and would break determinism-by-rule.

**Recommendation.**
1. **Window = the whole extracted text, NFC-normalised, with a documented hard cap of 1 000 000 characters** and an explicit `truncated: true` + `text_chars_scanned` on every record. Rationale: the 8 000 window is provably the cause of wrong verdicts; a cap that is 125× larger removes the class of bug while bounding memory; the flag keeps the record honest if it ever bites.
2. **Rule matching is whole-text, but two *tiers* are distinguished for evidence**: `title` tier = the manifest title string (A7) and `body` tier = the rest of the text. Tier membership is a property of the rule, not of the hit. Both tiers are recorded per candidate.
3. **Confidence — deterministic, three-valued, repo-native.** Per candidate, in the ADR-0002 vocabulary:
   - `authoritative` — exactly one Tier-1 rule matched and that rule is a **named** Canadian stage expression (`planning stage`, `preliminary design`, `detailed design`, `detail design`, `pre-opening`, `avant-projet préliminaire` qualified, `plans et devis préliminaires`, …). Evidence: a named form in `docs/references/CA/` with a page citation.
   - `interpreted` — exactly one Tier-1 rule matched but the form is **derived or bare-numbered**: `stage 1/2/3` (bare numbers are forbidden across jurisdictions — `policies/canada/pack.json:96-97`, `R-CA-NAMESPACED-STAGES`), `concept design`, a French synonym that maps by position rather than by name.
   - `inferred` — ≥2 candidates (Tier-2 ambiguity rule, or two Tier-1 stages in one document), or a Tier-3 bucket, or an asset-type-only record.
   Document-level `confidence` = the **minimum** of its candidates' labels (a document is only as certain as its least certain candidate). A record with no candidates has `confidence: null`, `stage: "UNSTAGED"`.
   This is total, deterministic, assertable in one line per case, and reuses the repo's enum instead of inventing a float.
4. **Tie-break order** (deterministic): Tier 1 → Tier 2 → Tier 3 → UNSTAGED; within a tier, the rule order in `stage-rules.v2.json` (most specific first) decides; if two Tier-1 rules match **different** stages, the document is ambiguous (both candidates, `inferred`) — never a forced pick.

**Human needed?** No. But the *choice* of the 3-valued confidence over a float is a design decision the planner should record in `stage-rules.v2.md` with the ADR-0002 citation.

---

### G5 — Shape of the ambiguity record, and how `MULTI_STAGE` is represented

**Question.** Specify the minimal record: field names, types, per-candidate or per-document confidence, `MULTI_STAGE` representation, backward compatibility with the committed manifest and report scripts, path, consumers.

**Evidence.**
- **[F] `stage`/`cell_key` are read in at least 12 places** and are validated by a JSON schema: `docs/RSA-Documents/corpus-schema.json:14-17` — `"stage": {"type":"string","enum":["PRELIMINARY_DESIGN","DETAILED_DESIGN","FEASIBILITY_CONCEPT"]}`; the writer is `scripts/harvest-track-a.ts:1010-1011` (`stage: stage.stage, cell_key: CANONICAL_STAGE[stage.stage] ?? ""`); consumers include `scripts/harvest-track-a-report.ts:24-29` (`MANIFEST_STAGE_TO_CELL`), `:34` (`UNMAPPED_STAGES = ["existing","pre-opening","unknown","UNSTAGED","MULTI_STAGE","PRE_OPENING"]`), `:252-255`, `:320-323` (`stageFrom`), `:541-545`; `scripts/harvest-track-a-round2-report.ts:251,308-313,370,471`; `scripts/harvest-track-a.ts:1432-1434` (unstaged table groups by `r.stage`), `:1555` (selftest: every row has a truthy `stage`).
- **[F] `MULTI_STAGE` is 13 of 33 rows** today and is v1's collapse of ">1 distinct rule hit" (`scripts/harvest-track-a.ts:541-543`: *"A document naming several stages is not one cell's document."*).
- **[F] A Canadian multi-stage document has no cell** (A9): `policies/odd.json`'s only multi-canonical cell is UAE's; `src/domain/odd.ts:74-89` returns `status: "unlisted"` for a Canadian multi-stage set.
- **[F] `UNMAPPED_STAGES` already contains `MULTI_STAGE`** → v1's multi-stage documents are already "no canonical cell". **[I]** v2 therefore does not change the cell semantics of multi-stage documents; it only stops discarding the candidate detail.

**Risk per reading.**
- *Change `stage` to an object* — breaks the schema enum, the committed 33 rows, the byte-identity report tests and the committed reports (the ticket forbids touching `docs/RSA-Documents/`). Rejected.
- *New stage tokens (`AMBIGUOUS`, `PRELIMINARY_OR_DETAILED`)* — a new token would need adding to `UNMAPPED_STAGES` (`scripts/harvest-track-a-report.ts:34`) to stay visible in the unmapped-stage tally, i.e. a change to a shared file that also drives the committed report → byte-identity risk. Avoid.
- *Versioned sidecar* — no committed file changes; the v1 record stays byte-identical; the v2 view is new.

**Recommendation.**

**Do not change `stage` or `cell_key`.** Keep them strings; keep the committed manifest and both committed reports untouched.

The minimal record lives in a **versioned sidecar** at `docs/research/stage-rules/classifications-v2.jsonl`, **one line per classified document** (not only the ambiguous ones — see G6, this is what makes the coverage table offline-reproducible):

```jsonc
{
  "sha256": "2ea94190b6df90060009794589689884d0db779299cc99ee5dcd1e8887c2602e",
  "rule_set_version": "v2",
  "stage_v1": "PRE_OPENING",          // the committed manifest stage (never rewritten)
  "stage_v2_primary": "EXISTING",     // top candidate, or "UNSTAGED"
  "candidates": [
    { "stage": "EXISTING",          "confidence": "authoritative", "rule_ids": ["CA-EXISTING"], "tier": "body", "hits": 9,  "offsets": [10233] },
    { "stage": "PRE_OPENING",       "confidence": "interpreted",   "rule_ids": ["CA-PREOPEN"],  "tier": "body", "hits": 1,  "offsets": [17880] },
    { "stage": "DETAILED_DESIGN",   "confidence": "interpreted",   "rule_ids": ["CA-DETAIL"],   "tier": "body", "hits": 1,  "offsets": [9001] },
    { "stage": "PRELIMINARY_DESIGN","confidence": "interpreted",   "rule_ids": ["CA-PRELIM"],   "tier": "body", "hits": 1,  "offsets": [8100] }
  ],
  "ambiguous": true,                   // >=2 candidates
  "confidence": "interpreted",          // min over candidates
  "cell_key_v2": "",                    // ambiguous => no cell (A9)
  "asset_type": null,                   // "station" | "corridor" | "functional_design" | null
  "text_chars_scanned": 30021,
  "truncated": false,
  "rule_set_version_hash": "sha256:…"  // pins the exact rule file used
}
```

Field rules:
- `candidates[]` — **per-candidate** confidence (the ticket says "both candidates and a confidence"; the confidence belongs to each candidate, and the document-level value is the minimum).
- `confidence` ∈ `authoritative | interpreted | inferred` (ADR-0002) — **not** a float. A float (`hits/total`) is deterministic but its thresholds are invented and unassertable; the enum is repo-native and one-line assertable. `hits` carries the numeric transparency.
- `stage_v1` — kept so the v2-vs-v1 table is derivable from the sidecar alone; it must equal the committed manifest `stage` (a CI assertion).
- `cell_key_v2` — `""` when `ambiguous` is true (A9: no Canadian multi-stage cell; v1 already treats `MULTI_STAGE` as unmapped, `scripts/harvest-track-a-report.ts:34`); otherwise the canonical cell from `policies/canada/pack.json`.
- `MULTI_STAGE` representation: v1's `MULTI_STAGE` (13 rows) becomes `ambiguous: true` with the full candidate list; the v1 token is retained in `stage_v1`. **No new stage token is introduced.**
- `offsets[]` — character offsets of the first hit per rule, **not** verbatim text, for the 8 RESTRICTED rows (A11). Verbatim quotes are permitted only for `docs/references/CA/` sources and the CLEAR row — precedent `docs/research/canada-rsa-research.md:300-315`.
- Backward compatibility: `stage`/`cell_key` strings unchanged ⇒ `scripts/harvest-track-a-report.ts` and `scripts/harvest-track-a-round2-report.ts` need **no edit**, and the committed reports stay byte-identical. A **v2 counterpart** of the unmapped-stage tally is *not* required (the sidecar carries the detail); if the planner wants a human-readable v2 summary, it belongs in `docs/research/stage-rules/coverage-v2-vs-v1.md`, not in the shared report scripts.
- Path: `docs/research/stage-rules/classifications-v2.jsonl` (not ignored, A12). Consumers: (1) `coverage-v2-vs-v1.md` (derived, offline); (2) reviewers; (3) a future promotion step (out of scope).

**Human needed?** No.

---

### G6 — Re-fetch consent, minimal corpus, and reproducibility without a network

**Question.** What is the minimal defensible corpus to fetch, what makes the coverage table reproducible by one command, and what happens when the network is unavailable?

**Evidence.**
- **[F] Re-fetch works and is byte-verifiable.** Independently re-verified in this session: `documents.ottawa.ca` → `200`; the motivating document → sha `0d9a76ff4e71e2b48ff2a5d96081dd7ee5419ec58275ed8587d246d0a0b2793c` (**matches the manifest**); the study report → sha `a24707c6…` (**matches the inventory**). The npm registry answers `200` (so `npm ci` works). The discovery report measured 30/33 manifest URLs at `200` with `content-length == committed bytes`, and 9/9 T3 sha256-identical.
- **[F] The committed candidate log carries the URL of the inventory's DETAILED_DESIGN row**: `docs/RSA-Documents/track-a-round2-candidate-log.tsv` → `r2-municipal … OC_Transpo_Transitway_Road_Safety_Audit.pdf 200 5977941 a24707c6… skipped hash-already-present`. **[F]** So that document *is* re-fetchable even though it is not a manifest row.
- **[F] The committed bodies already in the repo** (A6) let the rule set be designed and unit-tested with **no network at all**: `docs/references/CA/` (7 PDFs, the vocabulary evidence) and `tests/fixtures/samples/CA/` (11 PDFs, incl. the manifest's only CLEAR T3 row `0af7ea58…`).
- **[F] CI has no network for the corpus and no harvest step**: `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `node scripts/harvest-verify.mjs --mock` — the harvest itself is **not** in CI; `.github/workflows/discovery-harvest.yml` runs the *discovery* harvest hourly, not the corpus harvest.
- **[F] `scripts/harvest-track-a.ts` has no classify-only mode** (`main()` at `:1589-1598`: `fetch | intake | accounting | report | selftest`), and `runIntake` **appends to the committed manifest** (`scripts/harvest-track-a.ts:1245-1256` writes to `INTAKE_JSONL = docs/RSA-Documents/canada-intake-manifest.jsonl`). `runFetch` reuses the **committed candidate log** (`candidatesFor`, `:367-376`), so no discovery re-run is needed — but its known-hash gate (`:274-304`, `HASH_SKIP_REASON = "hash-already-present"`) would **skip** any sha already in the inventory/dedupe index, i.e. it would refuse to download `a24707c6…` and every other inventory-held document.

**Risk per reading.**
- *Fetch all 33 (48.88 MB)* — complete movement table; 2–3 rows are unreachable (403 / no connect) and must be reported as "not re-fetchable", not silently dropped.
- *Fetch only the 9 T3 (12.04 MB)* — the minimum that can change a **cell**, but it misses the movement of the 24 T1 rows (which do move stage labels, e.g. `MULTI_STAGE` → candidates) and misses `a24707c6…` (the only inventory row that currently occupies a cell).
- *Commit corpus text* — impossible for 8 of the 9 T3 rows (RESTRICTED, A11).

**Recommendation.**
1. **Fetch set (minimal + sufficient): 10 documents, ~18 MB** — the 9 T3 manifest rows (`0af7ea58`, `0d9a76ff`, `2ea94190`, `37863ef8`, `7b9715f0`, `e8810b8a`, `ececad09`, `ed2c0d69`, `d4a57774`) plus `a24707c6…` (the inventory row that currently occupies `canada:DETAILED_DESIGN`, URL taken from the committed candidate log). Extend to **all 33** if the network is healthy — the extra 37 MB buys the complete "how many documents move" table for the T1 rows, which the ticket asks for ("report how many documents move into which cells"). **R: fetch all 33**, tolerate per-row failure, verify every fetched file against the manifest/inventory sha256, and report unreachable rows explicitly.
2. **Never mutate the corpus record.** The re-fetch must write to a scratch dir **outside** `docs/RSA-Documents/` (the operator constraint; also `.gitignore:76-79` would ignore anything written there) and must **not** run `harvest-track-a.ts intake` (it appends to the committed manifest — `scripts/harvest-track-a.ts:1245-1256`). The new script must also **bypass the known-hash gate** (`:274-304`) or it will refuse to download the very documents whose sha is already known.
3. **One command, two phases, network only in phase 1.**
   ```
   npx tsx scripts/harvest-stage-rules-v2.ts fetch   --manifest docs/RSA-Documents/canada-intake-manifest.jsonl --out .scratch/t62-corpus/
   npx tsx scripts/harvest-stage-rules-v2.ts compare --rules-v1 docs/research/stage-rules/stage-rules.v1.json \
                                                      --rules-v2 docs/research/stage-rules/stage-rules.v2.json \
                                                      --corpus .scratch/t62-corpus/ \
                                                      --out docs/research/stage-rules/coverage-v2-vs-v1.md
   ```
   `compare` must be **offline and deterministic** given the corpus dir: no timestamp in the output (precedent `scripts/harvest-track-a-round2-report.ts:207`), stable ordering, sha256-pinned inputs.
4. **Network-unavailable path (the important one).** Commit the **per-document verdicts** (`classifications-v2.jsonl`, G5) alongside the table. Then:
   - `coverage-v2-vs-v1.md` is regenerated **from the sidecar + the committed manifest** with **no network** — so the table is always regenerable and byte-reproducible in CI, exactly like the committed reports;
   - the *only* thing a network is needed for is **re-deriving the sidecar** from the bodies — the same trust model the committed manifest already has (its bodies are also absent from the repo);
   - CI asserts: (a) `coverage-v2-vs-v1.md` equals the table derived from the sidecar, byte-for-byte; (b) every sidecar row's `stage_v1` equals the committed manifest `stage`; (c) the v1 baseline in the table equals the committed round-2 table's "after have"; (d) the rule set is schema-valid; (e) the per-rule unit tests pass against committed bodies.
5. **The 76 non-ingested round-2 candidates are out of scope** — they are not corpus members (`not RSA` / `hash-already-present` / `not a pdf` / robots / 403 in the candidate log) and no part of the ticket requires them.

**Human needed?** No. **Consent note:** this is a ~49 MB fetch of public government PDFs from URLs already committed in the repo. It is not destructive, not irreversible and not a new authorisation surface — the operator constraints already bless a local re-fetch. Recommend a polite UA (the repo's own `user_agent`: *"AuditorAI-RSA-Harvest/1.0 (+public documents only)"*, `docs/RSA-Documents/track-a-sources.json`), 1 s minimum interval and ≤2 concurrent per host (the repo's `politeness` block).

---

### G7 — The real blocker: 22 of 29 Canadian T3/T4 documents have no cell

**Question.** Does the policy gap make the ticket's goal unmeetable? State plainly what v2 can and cannot move.

**Evidence.**
- **[F]** Recomputed from the committed inventory: Canadian rows (13 `ca_province` codes + `CAN-GOV`) = 146; of those, **T3/T4 = 29**, stage tally `{ existing: 22, unknown: 5, detailed: 1, pre-opening: 1 }`. Restricted to `class: "rsa-sample"` T3/T4 (24 rows): `{ existing: 17, unknown: 5, detailed: 1, pre-opening: 1 }`.
- **[F]** `policies/canada/pack.json:80` — `ca-tac:pre-opening` has `"canonical_stages": []`; there is **no** Canadian `EXISTING`/`CONSTRUCTION` stage at all (`stages[]` = planning, preliminary-design, detailed-design, pre-opening).
- **[F]** The committed harvest report already says so: *"`existing`, `pre-opening` and `unknown` … have no canonical cell (`policies/canada/pack.json:76-83`), so they are reported here and are never coverage."* (the cited line numbers are `:76-83` in the report; the verified line for the empty `canonical_stages` is `:80`).
- **[F]** The committed round-2 report's near-miss table lists exactly two Canadian T3 near misses, and both are **cell** problems, not vocabulary problems: `Transitway Station Design | T3 | UNSTAGED | ON` and `Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference | T3 | PRE_OPENING | NB`.
- **[F]** The UNB conference paper (`2ea94190…`) names four stages in its own body (feasibility/planning, draft preliminary-layout design, detail design, pre-opening) — it is a **multi-stage reference document**, not a single-stage audit; the round-2 report's own note says it "names no stage word the classifier recognises" — which is **false** (see G8 risk below).
- **[F]** The corpus's single `canada:DETAILED_DESIGN` candidate rests on an `anchor` label that its own body contradicts (A5, G2) — i.e. **v2 can legitimately move that document out of the cell**.

**Plain statement of what v2 can and cannot move.**
- **Can move:** documents that name a *design* stage (feasibility / preliminary / detailed) but were mis-assigned by v1's vocabulary or window — e.g. `ed2c0d69…` (`"Stage 1 Road Safety Audit"`, T3, today `FEASIBILITY_CONCEPT` because of the 8 000 window), `2ea94190…` (today a false `PRE_OPENING` from the French *"mise en service"* false positive), and any `detail design` document (v1's regex never matches it — G8).
- **Cannot move:** (i) documents naming no stage at all (the Transitway family) — no vocabulary can supply a stage that the document does not state; (ii) documents naming a stage with **no Canadian cell** (`existing`, `pre-opening`, `construction`) — the blocker is `policies/canada/pack.json`, not the classifier.
- **Can move *out*:** `a24707c6…` — under v2 it reads as an **in-service** review → `EXISTING` → no cell → `canada:DETAILED_DESIGN` coverage drops from 1 to 0. **[R]** The artefact must state this plainly rather than hide it: the corpus's only DETAILED_DESIGN "coverage" is an anchor artefact on an in-service review.

**Follow-up ticket to raise (NOT in this ticket).**
> **"Canadian policy pack: add an in-service / existing-roads audit stage and a pre-opening canonical stage."** `policies/canada/pack.json` has no `EXISTING`/`CONSTRUCTION` stage and gives `ca-tac:pre-opening` `canonical_stages: []`; 17–22 of the 29 Canadian T3/T4 documents are in-service audits and can never be coverage until the pack defines the stage. This is a doctrine change (ADR-0002 §1: *"enum extensible toward later stages"*) and needs `policies/odd.json` cells + `src/domain/odd.ts` coverage, plus the Quebec `évaluation à l'exploitation` and the TAC *in-service* guide (purchase-gated, `docs/references/CA/MANIFEST.md` gaps).
Secondary follow-up: **"corpus dedupe by content, not by sha256"** — `a24707c6…` and `b28c45bf…` are the same document with different bytes and different stage labels; the corpus counts them as two documents.

**Human needed?** The *policy* decision needs the owner (out of scope here, explicitly). The *implementation* of #62 does not.

---

### G8 — Hidden requirements the ticket implies but does not say

**Question.** Check: (a) `state/odd-coverage.json` regeneration; (b) the harvest report scripts' `UNMAPPED_STAGES`; (c) `corpus-schema.md/.json`; (d) language detection and French accent/NFC handling; (e) a re-fetch mode that does not re-run discovery.

**(a) `state/odd-coverage.json`.** **[F]** It is derived from the **discovery ledger**, not from the corpus manifest: `scripts/discovery-coverage.ts:21` reads `state/discovery-ledger.json`, `:50` writes `state/odd-coverage.json`; `grep -rn "canada-intake-manifest" src/ scripts/` matches only the harvest scripts. The ledger is written by `scripts/discovery-run.ts` (`.github/workflows/discovery-harvest.yml`). ⇒ **v2 does not change it and must not touch it.** It is only *read* by the coverage tables for `target` and `priority` (`scripts/harvest-track-a-round2-report.ts:251`). The app UI (`src/app/dev/mission-control/_components/odd-matrix.tsx`) consumes `state/odd-coverage.json` and is unaffected.

**(b) `UNMAPPED_STAGES`.** **[F]** `scripts/harvest-track-a-report.ts:34` lists `["existing","pre-opening","unknown","UNSTAGED","MULTI_STAGE","PRE_OPENING"]`. Because v2 introduces **no new stage token** (G5), this list needs **no edit** — and editing it would risk the byte-identity test at `tests/discovery/harvest-track-a-report.test.ts:251`. A v2 counterpart of the unmapped tally belongs in the new v2 artefact, not in the shared report.

**(c) `corpus-schema.md/.json`.** **[F]** `docs/RSA-Documents/corpus-schema.json:14-17` pins `stage` to a 3-value enum and `docs/RSA-Documents/corpus-schema.md:10` states the same in prose ("the human contract for the catalog schema"). A sidecar leaves both untouched. **[R]** The sidecar needs its **own** schema (a `stage-rules.v2.schema.json` or an explicit schema block in the v2 doc) so the shape is checkable; the repo's precedent for a machine-checked artefact is `contracts/schemas/` — but a v2 rule/record schema belongs with the v2 artefacts, not in `contracts/schemas/` (which is the app's contract surface).

**(d) Language and accents.** **[F]** `detectLang` (`scripts/harvest-track-a.ts:551-555`) is a **word-frequency heuristic** over `\b(le|la|les|des|sécurité|routière|audit|rapport)\b` vs `\b(the|and|safety|audit|report|road)\b` — note `audit` and `road` are in *both* lists, and the manifest records `lang` for every row (2 French rows: `1530d327` "MINISTÈRE DES TRANSPORTS ET DE LA MOBILITÉ DURABLE", `d16763da` "Note Méthodologique : audit de sécurité routière asr"). **[F]** Accents survive extraction in the committed reference shelf (`isNFC true` on the MTQ guide; `é`×1778). **[F]** No NFC normalisation exists in the repo. **[F]** `unpdf` is not installed here, so the planner must re-verify accent preservation **through unpdf** after `npm ci`. **[R]** v2 must `text.normalize("NFC")` before matching (one line, removes a whole class of accent misses), and the v2 rules must carry **explicit** accented alternatives (v1's `d[ée]taill[ée]e?\b` never matched "detailed design" — G8 risk below).

**(e) Re-fetch mode.** **[F]** `runFetch` reuses the committed candidate log (`candidatesFor`, `scripts/harvest-track-a.ts:367-376`) ⇒ **no discovery re-run is needed**; but there is **no classify-only mode**, and `runIntake` appends to the committed manifest (`:1245-1256`). ⇒ A **new** script is required; it must also bypass the known-hash gate (`:274-304`).

**Additional hidden requirements found (not in the ticket, revealed by investigation):**
- **H1 — the ticket's example vocabulary is partly wrong.** "conception préliminaire" / "conception détaillée" are not the Quebec terms (the MTQ guide uses **avant-projet préliminaire / définitif** and **plans et devis préliminaires / définitifs** — `docs/research/canada-rsa-research.md:300-315`, `EV-CA-032`), and "audit de sécurité routière en exploitation" is a near-miss for **"Évaluation à l'exploitation"**. **[R]** v2 should implement the *actual* MTQ vocabulary **and** keep the ticket's forms as accepted aliases, with the alias recorded in `stage-rules.v2.md` as "ticket vocabulary (non-Canadian)" so the difference is visible rather than silent.
- **H2 — the ticket's percentages are wrong for this corpus** (50/75/95, not 30/60/90) and a bare percentage rule mis-fires on the motivating document (`50%` = bus volume, `60` = design speed). **[R]** the percent rule must require a design noun after the `%` and must not fire on a `%` that is followed by a non-design word.
- **H3 — v1's `en\s+service` false positive is already contradicted by the repo's own evidence registry**: `EV-CA-032` translates *"de l'évaluation (mise en service)"* as *"evaluation / opening into service"* — i.e. **in-service**, the fourth Quebec audit, not pre-opening. The rule must move `mise en service` to the in-service bucket.
- **H4 — the committed round-2 report contains a statement that v2 will falsify**: *"Two Canadian T3 documents (the OC Transpo `Transitway Station Design Safety Audit` and the UNB conference paper) name no stage word the classifier recognises"* (`docs/RSA-Documents/track-a-round2-harvest-report.md` §"what it did not do"). The UNB paper **does** name four stages (its body: *"feasibility (planning) … draft (preliminary/layout) design … detail design … pre-opening"*), and the Transitway study says *"in-service road safety review"*. **[R]** The v2 artefact must not edit that committed report (the operator forbids it) but must explicitly state the correction, so the record shows the discrepancy was found and not ignored.
- **H5 — the corpus contains byte-different twins with different stage labels** (`a24707c6…` `detailed` vs `b28c45bf…` `existing`, identical extracted text). **[R]** the movement table must be sha-keyed (like every other count in the repo) **and** flag the twin pair in a footnote; a content-level dedupe is a separate ticket.
- **H6 — the manifest `title` is the PDF's first meaningful text line** (A7). **[R]** this is a gift, not a bug: it makes "title-tier" rules exactly defined and offline-testable against the committed manifest, and it makes the ticket's "real titles from the corpus" mechanically checkable — but it also means 8 of 33 titles are junk (`"Date: March 17, 2004"`, `"APPENDIX H"`, `"OCTOBER 2024 FINAL"`, `"CONFIDENTIAL"`, `"FULL DAYS"`, `"23-160-006.01"`), so a rule that needs a meaningful title must fall back to the body.
- **H7 — the v1 rule set is inline, not addressable** (`scripts/harvest-track-a.ts:516-520`), so "re-run under v1" currently means "re-run the harvester". **[R]** freeze v1 as data. The cheapest faithful freeze is to **export** the existing `const STAGE_RULES` (one keyword) and the window constant from `scripts/harvest-track-a.ts` and have the v2 script import them — a single source of truth with zero drift; the fallback is a hand-written `stage-rules.v1.json` plus a drift test. Editing the rules in place is forbidden by H-risk below.

---

### G9 — Acceptance-criteria mapping

| AC | Artifact that proves it | Command that produces it | Objective check | Verdict |
|---|---|---|---|---|
| **AC1** — a test per new rule, using real titles from the corpus | `tests/discovery/harvest-stage-rules-v2.test.ts` — one `it()` per rule id in `stage-rules.v2.json`, each asserting on a **committed manifest title** (and, where the rule needs a body, a **committed fixture** body) | `npx vitest run tests/discovery/harvest-stage-rules-v2.test.ts` | `expect(r.stage).toBe(...)` / `expect(r.candidates.map(c=>c.stage)).toEqual([...])` — one assertion per rule | **Partly checkable as written.** The ticket says "real titles from the corpus": the corpus `title` field is the PDF's first meaningful line (A7), so 8/33 titles are junk — the test must assert on *the title string the corpus holds*, not on a human title. Also, rules that need a **body** (percent, in-service, French stage forms) cannot be tested from a title alone; their tests must use a committed body (`tests/fixtures/samples/CA/` or `docs/references/CA/`) or a committed verbatim excerpt. **A title-only reading of AC1 is impossible for 5 of the ~10 rules.** |
| **AC2** — a coverage table under v2 versus v1 | `docs/research/stage-rules/coverage-v2-vs-v1.md` — Table A (33-row re-classified corpus: `cell \| target \| priority \| have(v1) \| have(v2) \| usable CLEAR v1/v2 \| moved docs`) + Table B (merged rows, comparable to the committed round-2 table) + a per-document movement table (33 rows: `sha \| tier \| stage_v1 \| stage_v2 \| cell_v1 \| cell_v2 \| moved \| reason`) | `npx tsx scripts/harvest-stage-rules-v2.ts compare --corpus <dir> --out docs/research/stage-rules/coverage-v2-vs-v1.md` (offline, given the corpus dir) — and, **without a network**, `npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/classifications-v2.jsonl` | CI: the committed table equals the table rendered from the committed sidecar, byte-for-byte; the v1 column equals the committed manifest stages; the Table-B v1 column equals the committed round-2 table's "after have" (1 / 0 / 1) | **Objectively checkable**, with one caveat: "how many documents move into which cells" has **no denominator in the ticket** — the planner must state it (G1) or the number is unfalsifiable. |
| **AC3** — ambiguous documents listed with both candidate stages | `docs/research/stage-rules/classifications-v2.jsonl` (the `ambiguous: true` rows) **and** a human-readable table in `coverage-v2-vs-v1.md` (§"Ambiguous documents"): `sha \| title \| tier \| candidates (stage + confidence) \| cell \| why` | same `compare` / `render` commands | CI: every `ambiguous: true` row has ≥2 candidates, each with a valid `confidence` label, and `cell_key_v2 == ""` | **Objectively checkable.** Two sub-cases must be separated (discovery's own point): (i) *the document's own scope* names two stages → ambiguous, no cell; (ii) a **reference/taxonomy** document that merely *lists* the stages → not ambiguous, no cell either, but for a different reason. **[R]** distinguish them with a `scope_basis` field (`own_scope` / `taxonomy_reference`) so the list is honest. |

**Not objectively checkable as the ticket words it:** the ticket's *goal* clause *"so T3 documents reach their cells"* is a **result**, not a criterion, and by G2/G7 it is unattainable for the motivating document and for the 22 `existing` documents. The planner should deliver the three criteria and a plain statement of what moved (and what cannot).

---

### G10 — Escalation check

**Rule:** escalate only on irreversible, ambiguous-product-requirement, missing-authorisation, conflicting-owner or destructive items.

| # | Item | Human? | Closing evidence |
|---|---|---|---|
| E1 | "Functional Plan" → FEASIBILITY or PRELIMINARY | **No** | `policies/canada/pack.json:25` vs `:43` (two distinguishable triggers); Alberta's two phases; two committed fixtures with the phrase in both stage families; v1's `functional plan` branch is not pinned by any test (the pinned string at `tests/discovery/harvest-track-a.test.ts:70` contains "Stage 1"). Resolution = Tier-2 candidate pair (G3). |
| E2 | The ticket's premise for the Transitway document | **Report, not decide** | The document names no stage (111 402 chars, zero hits) and its study is an **in-service** review. No rule can give it a cell. **Must be stated in the PR body and on the ticket**; it is a correction of a factual premise, not a blocking decision. |
| E3 | Do ambiguous documents keep a cell? | **No** | `policies/odd.json` has no Canadian multi-stage cell; `src/domain/odd.ts:74-89` → `unlisted`; v1 already treats `MULTI_STAGE` as unmapped (`scripts/harvest-track-a-report.ts:34`). ⇒ ambiguous ⇒ no cell. |
| E4 | Bare "Stage N" | **No** | `policies/canada/pack.json:96-97` + rule `R-CA-NAMESPACED-STAGES` ⇒ bare numbers are cross-jurisdiction unsafe. Keep matching them (backward compatible) but confidence `interpreted`, and record the jurisdiction token when present. |
| E5 | Percentage → stage table | **No** | No committed source fixes one (Alberta: "before 75% completion"; pack: "~90–95% design", "95% of the Functional Plan"). ⇒ Tier-2 candidate pair, confidence `inferred`. |
| E6 | "Concept design" / "avant-projet préliminaire" placement | **No** | Unsettled by the sources ⇒ Tier-2 candidate pair (the ticket's own rule). |
| E7 | Asset-type cues may classify a document that names no stage? | **No, as scoped** | Admitted as **evidence only** (title-tier `asset_type`), never a stage, never a cell. This satisfies the ticket's letter without inventing a stage. If the owner wants asset-type ⇒ a real stage, that is a **new policy decision** → follow-up ticket. |
| E8 | New ODD cells for `EXISTING` / `CONSTRUCTION` / pre-opening | **Owner — but out of scope** | `policies/canada/pack.json:80` + the 22/29 `existing` pool (G7). **Follow-up ticket, explicitly not this one** (operator constraint: no `policies/` change). |
| E9 | The `a24707c6…` anchor (`detailed`) vs its body (`in-service`) | **Report** | Two committed labels for one document (text-identical twins, verified). v2 records the ambiguity; the artefact flags it. No decision needed to ship v2. |
| E10 | Re-fetching ~49 MB of public PDFs | **No** | URLs are already committed; the fetch is read-only, non-destructive, sha-verified; the repo's own politeness rules apply. |
| E11 | Editing `scripts/harvest-track-a.ts` | **No, but minimal** | The only change recommended is `export` on an existing `const` (or none at all). Editing `STAGE_RULES` in place would change v1 and break `tests/discovery/harvest-track-a-report.test.ts:251` and `tests/discovery/harvest-track-a-round2-report.test.ts:99`. |
| E12 | Committing `.autoforge/`, `.env*`, secrets | **No** | `.git/info/exclude:7` ignores `.autoforge/`; `.autoforge/AGENTS.md` requires curated paths to be force-added; the operator forbids committing `.autoforge/`, `.env*` and secrets. |

**Escalation verdict: NOTHING BLOCKS IMPLEMENTATION.** Every item is either resolvable from repo evidence (E1, E3–E7, E10–E12) or explicitly out of scope / report-only (E2, E8, E9). The run must **not** block on a question the repo already answers.

---

## 4. Recommended implementation shape (for the planner)

**New files only** — no edit to `docs/RSA-Documents/**`, no edit to `scripts/harvest-track-a.ts` beyond an optional one-word `export`, no edit to the committed reports.

```
docs/research/stage-rules/
  stage-rules.v1.json          # frozen v1: the 4 regexes + the head-8000 window + provenance pointer
  stage-rules.v2.json          # the versioned rule set: id, tier, regex, stage(s), confidence, evidence
  stage-rules.v2.md            # per-rule evidence: verbatim quote + docs/references/CA/<file>.pdf p.N
  classifications-v2.jsonl     # one row per re-classified document (G5 shape) — the offline source of truth
  coverage-v2-vs-v1.md         # AC2: Table A, Table B, movement table, ambiguous table (AC3)
scripts/harvest-stage-rules-v2.ts   # fetch | classify | render CLI (new; does not touch the manifest)
tests/discovery/harvest-stage-rules-v2.test.ts   # AC1 per-rule tests + golden fixture verdicts + table byte-identity
```

**Rule set v2 — candidate list (evidence-bearing, ordered most-specific-first).** Each rule carries: `id`, `tier` (1 specific / 2 ambiguity / 3 no-cell / asset), `regex`, `stage` or `candidates[]`, `confidence`, `evidence[]` (quote + `docs/references/CA/<file>.pdf` page), and `negative_tests[]` (the prose traps it must not fire on).

| tier | id | fires on | outcome | evidence |
|---|---|---|---|---|
| 1 | `CA-PREOPEN` | `pre-?opening`, `avant l'ouverture` | `PRE_OPENING` (no cell) | UNB p22; ON p13; BC p5 |
| 1 | `CA-EXISTING` | `in-?service (road|highway|facility|review|audit)`, `existing (road|highway|corridor|facilit)`, `post-?opening`, `already in service`, `mise en service`, `en exploitation`, `évaluation à l'exploitation`, `en service` **only with an audit noun** | `EXISTING` (no cell) | ON p13/p43; UNB p21; QC p10/p12; `EV-CA-032` |
| 1 | `CA-DETAIL` | `detailed design`, **`detail design`**, `stage 3/three`, `plans et devis définitifs`, `avant-projet définitif` | `DETAILED_DESIGN` → `canada:DETAILED_DESIGN` | UNB p21/p26; ON p12; QC p10 |
| 1 | `CA-PRELIM` | `preliminary design/stage`, `draft (preliminary/layout) design`, `stage 2/two`, `plans et devis préliminaires` | `PRELIMINARY_DESIGN` → `canada:PRELIMINARY_DESIGN` | UNB p21/p25; ON p12/p43; QC p10/p12 |
| 1 | `CA-FEAS` | `planning stage`, `feasibility stage/study`, `stage 1/one`, `étude des besoins/solutions`, `planification` | `FEASIBILITY_CONCEPT` → `canada:FEASIBILITY_CONCEPT` | UNB p21; ON p12/p43; impl-plan p13 |
| 1 | `CA-CONSTR` | `construction (phase|stage)`, `des travaux`, `travaux` | `CONSTRUCTION` (no cell) | impl-plan p4; QC p10/p12 |
| 2 | `CA-AMBIG-FUNC` | `functional plan(ning)` (only if tier 1 empty) | pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`, `inferred` | pack.json:25 vs :43; AB p7/p8 |
| 2 | `CA-AMBIG-CONCEPT` | `concept (stage|design)` | pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`, `inferred` | ON p12/p43 |
| 2 | `CA-AMBIG-AVP` | `avant-projet préliminaire` | pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`, `inferred` | QC p10/p12 |
| 2 | `CA-PCT` | `NN% (design|detailed|detail|plan)` with a design noun | pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}`, `inferred` | UNB p141/142/146/154; AB impl-plan p23 |
| asset | `CA-ASSET` | `station design`, `corridor`, `functional design` — **title tier only** | `asset_type` recorded; **no stage, no cell** | ticket bullet 1; `docs/references/CA/ontario-good-roads-rsa-guideline-2023.pdf` p42 (prose trap) |

**Mandatory negative tests** (the traps the repo already warns about — `docs/RSA-Documents/scripts/build-ondisk-inventory.py:122`: *"text cues are deliberately specific - a bare 'existing' in prose is not a stage"*):
- the Transitway body: `in-service` ×3 and `existing` ×4 **must not** produce `EXISTING`;
- `final design` in prose **must not** produce `DETAILED_DESIGN`;
- `50%` (bus volume) and `60 km/h` (speed) **must not** produce a percentage candidate;
- `mise en service` **must not** produce `PRE_OPENING` (v1's false positive — `EV-CA-032` calls it *in-service*).

**Regression proof for the freeze (offline):** re-running the frozen v1 rule set over the committed fixture `ab-neahd-planning-stage-rsa-2009.pdf` (`0af7ea58…`, the manifest's only CLEAR T3 row) must reproduce `FEASIBILITY_CONCEPT`, and over `nb-unb-exemplary-audits-appendix-c-1999.pdf` must reproduce `MULTI_STAGE` (inventory: `pre-opening`, T4). Plus the golden set: `ab-calgary-glenmore-functional-plan-rsa-2017.pdf` → `detailed`; `mb-pth1-pth5-in-service-review-exec-2023.pdf` → `existing`; `on-ottawa-octranspo-transitway-safety-study-2021.pdf` → `existing` (body) — each a **committed** body, so the golden test needs no network.

---

## 5. Risks

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| R1 | Editing `STAGE_RULES` in place silently changes v1 and breaks the committed byte-identity tests | `tests/discovery/harvest-track-a-report.test.ts:251`, `tests/discovery/harvest-track-a-round2-report.test.ts:99`; `scripts/harvest-track-a.ts:516-520` | freeze v1 as data; v2 in a new module; never edit the shared rule array |
| R2 | The corpus's only `canada:DETAILED_DESIGN` coverage candidate is an anchor artefact; v2 may legitimately move it out | `docs/RSA-Documents/track-a-harvest-report.md` §1 (`a24707c6…`, `label confidence anchor`); body says *"in-service road safety review"* | state it in the coverage table and the PR body; do not hide a coverage drop |
| R3 | A coverage **regression** (1 → 0 in a cell) reads as a failure of the ticket | same as R2; also `ed2c0d69…` and `2ea94190…` are borderline | ship the movement table with a `reason` per row; the ticket asks for movement counts, not for a gain |
| R4 | v1's `en\s+service` false positive and the missing `detail design` spelling are *not* fixed by the ticket's examples | `node -e` re-verified: `/d[ée]taill[ée]e?\b/i.test("detailed design") === false`; `/pre-?opening\|avant\s+ouverture\|en\s+service/i.test("mise en service") === true` | the v2 rule table above fixes both; add each as a named test |
| R5 | The 8 000 window hides stage names in real guidance | discovery measurements on 5/7 CA reference PDFs; `scripts/harvest-track-a.ts:538` | whole-text window + `text_chars_scanned`/`truncated` |
| R6 | The v1 French vocabulary is accent- and form-brittle; no NFC normalisation exists | `grep -rn "NFC" src/ scripts/` → no match; `isNFC true` on the MTQ extraction | `normalize("NFC")` + explicit accented alternatives + a test per form |
| R7 | `unpdf` is not installed in this worktree (`node_modules` = 0 entries) ⇒ the classifier cannot run until `npm ci`; the npm registry answers `200` from here | `ls node_modules \| wc -l` → `0`; `curl -o /dev/null -w "%{http_code}" https://registry.npmjs.org/unpdf` → `200` | `npm ci` first; verify accent preservation **through unpdf**, not `pdftotext` |
| R8 | The corpus's re-fetch hits a network allowlist (2/33 dead: `consult.kerrycoco.ie` 403, `www.southampton.gov.uk` no connect) | discovery report; `curl https://example.com` fails from this container | per-row failure tolerance; report unreachable rows explicitly; never abort the run |
| R9 | A new script re-running the harvester would append to the committed manifest | `scripts/harvest-track-a.ts:1245-1256` (`INTAKE_JSONL`) | the v2 script never calls `intake`; scratch dir outside `docs/RSA-Documents/` |
| R10 | The known-hash gate refuses to download documents whose sha is already known — i.e. exactly `a24707c6…` | `scripts/harvest-track-a.ts:274-304`, `HASH_SKIP_REASON` | the v2 fetch bypasses the gate and verifies sha256 itself |
| R11 | Committing body text of RESTRICTED documents | `docs/RSA-Documents/LICENSE-REGISTER.md:10,26-32` | sidecar carries rule ids, hit counts and **offsets**, not verbatim text; verbatim quotes only from `docs/references/CA/` and CLEAR rows |
| R12 | The corpus counts byte-different twins of one document as two documents, with different stages | `a24707c6…` vs `b28c45bf…` — extracted text identical (69 366 chars) | sha-keyed counts (repo convention) + a footnote; separate dedupe ticket |
| R13 | The coverage table's denominator is unstated in the ticket ⇒ any number can be called right | the ticket's bullet 4 | Table A + Table B with denominators on the table face (G1) |
| R14 | `MULTI_STAGE` inflation: reading the whole body increases multi-stage hits, so an "ambiguous ⇒ no cell" rule can *shrink* cell counts | v1: 13/33 `MULTI_STAGE`; discovery's exploratory v2 rows `7b9715f0`, `ed2c0d69` became ambiguous | the tier ordering (G3) keeps single-stage documents out of the ambiguity tier; report the movement per row |
| R15 | Title-tier rules are unreliable because 8/33 corpus "titles" are junk | A7; manifest titles `"APPENDIX H"`, `"CONFIDENTIAL"`, `"23-160-006.01"` | title tier is one signal among several; every rule that needs a real title falls back to the body |
| R16 | The v2 artefact asserts coverage numbers that CI cannot re-derive | bodies absent; CI has no corpus step | commit the sidecar and derive the table from it (G6); CI asserts table ≡ derived-from-sidecar |
| R17 | `/tmp/opencode` is not writable in this container (`drwxr-xr-x root root`) | `ls -la /tmp/opencode` | use `mktemp -d` for scratch space |

---

## 6. Constraints inherited from the operator (binding)

| # | Constraint | How this plan respects it |
|---|---|---|
| C1 | Do not touch `docs/RSA-Documents/` — the committed v1 before/after comparisons must stay valid | every new artefact is under `docs/research/stage-rules/` (A12: not ignored); `stage`/`cell_key` stay strings; the shared report scripts are not edited; the committed manifest, reports and schema are read-only inputs |
| C2 | The corpus PDFs are gitignored and were absent; 9/9 T3 re-fetched sha-identical; 30/33 URLs live; a full re-fetch is ~48.88 MB | re-fetch is local, sha-verified, per-row failure tolerant (G6); scratch dir outside the repo tree; no corpus bytes committed |
| C3 | The production box cannot push `scripts/` and has no corpus access; box re-run is not viable | **no box step is planned**; the v2 classifier is a `scripts/` artefact run in the checkout |
| C4 | The Postgres tenant store (PR #59) is off in production; not in scope | the v2 artefacts are files, not tenant rows; no migration, no runtime change |
| C5 | Production behaviour must not change | the classifier is harvest-only (`scripts/harvest-track-a.ts:964` is the only production call site); the app resolves stages from an operator-chosen `native_stage_id` (`src/domain/pipeline/nodes/stage-select.ts:41-45` → `src/domain/odd.ts:78-89`); no `src/` file is touched |
| C6 | Do not commit `.autoforge/`, `.env*` or secrets | `.autoforge/` is excluded by `.git/info/exclude:7`; the v2 deliverables live in `docs/research/`; no secret is read or written (the re-fetch needs no credentials) |
| C7 | Production policy (`policies/canada/pack.json`) must not change | the pack is **read** (as the source of the stage vocabulary and the triggers); the in-service cell gap is raised as a follow-up ticket (G7) |

---

## 7. Appendix — commands run while grilling (evidence log)

```bash
# corpus of record (A1)
node -e "…manifest rows 33 … round field {\"2\":30,\"undefined\":3} … stage tally {MULTI_STAGE:13,FEASIBILITY_CONCEPT:10,UNSTAGED:6,PRELIMINARY_DESIGN:3,PRE_OPENING:1} …"

# v1 rule array and window (G4)
sed -n '505,560p' scripts/harvest-track-a.ts      # STAGE_RULES at :516, head slice at :538

# v1's two defects, re-verified (R4)
node -e "const re=/d[ée]taill[ée]e?\b/i; …"   # "detailed design" false, "detail design" false, "detaille" true
node -e "const re2=/pre-?opening|avant\s+ouverture|en\s+service/i; …"  # "mise en service" true

# the Transitway document (G2) — re-fetched, sha-identical
curl -sS -L -o tw.pdf "https://documents.ottawa.ca/sites/default/files/Transitway%20Station%20Design%20Safety%20Audit%20-%20Analysis%20of%20Findings%20-%20Final%20Report%20-%20Sep%202021.pdf"
sha256sum tw.pdf   # 0d9a76ff4e71e2b48ff2a5d96081dd7ee5419ec58275ed8587d246d0a0b2793c  == manifest
pdftotext -layout tw.pdf tw.txt && node -e "…census: stage 0, preliminary 0, detailed 0, feasibility 0, pre-opening 0, corridor 0, functional plan 0, in-service 3, existing 4, 50% 1, 60 km/h 1"

# the study report (G2/A5) — re-fetched, sha-identical to the inventory's anchor row
curl -sS -L -o oc.pdf "https://documents.ottawa.ca/sites/default/files/OC_Transpo_Transitway_Road_Safety_Audit.pdf"
sha256sum oc.pdf   # a24707c6081a279f…  == inventory row
pdftotext -layout oc.pdf oc.txt   # "The primary objective for this in-service road safety review was …"

# the two twins are the same document (R12)
sha256sum tests/fixtures/samples/CA/on-ottawa-octranspo-transitway-safety-study-2021.pdf   # b28c45bf100bb713…
node -e "…identical text? true   (69 366 chars each)"

# the Canadian T3/T4 pool (G7)
node -e "…CA inventory rows 146; CA T3/T4 rows 29; stage tally {existing:22,unknown:5,detailed:1,pre-opening:1}"

# the coverage predicate and the merged population (G1)
sed -n '283,300p' scripts/harvest-track-a-report.ts      # coverage_candidate at :289
sed -n '180,190p' scripts/harvest-track-a-round2-report.ts # mergeRows at :183-184

# French accents / NFC (G8d)
pdftotext -layout docs/references/CA/qc-mtq-guide-audits-securite-routiere-2012.pdf qc.txt
node -e "…isNFC true; é×1778; avant-projet×8; travaux×15"

# committed bodies usable offline (A6)
sha256sum tests/fixtures/samples/CA/*.pdf
ls node_modules | wc -l    # 0  → npm ci required (registry answers 200)

# ignore state (A12 / C6)
git check-ignore -v docs/research/stage-rules/x.md .autoforge/requirements/grilling-t62.md docs/RSA-Documents/canada/track-a/x.pdf
```

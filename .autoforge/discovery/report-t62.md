# Discovery — Ticket #62: stage-classifier surface (rule set v2, ambiguous candidates, coverage v2 vs v1)

- Ticket: `Akamel01/AuditorAI#62` — "Stage classifier: map real-world RSA titles to ODD stages, so T3 documents reach their cells"
- Parent map: `#41`. Found by harvest round 2 (`#60`, PR `#61`).
- Branch/worktree: `oc/62` at `5dcaddb` ("Harvest round 2: free, wide search for public Canadian RSAs (#61)").
- Read-only investigation. No repo file was modified. Throwaway scripts and downloads live outside the repo (`~/t62tmp/`).
- Every claim below carries a `file:line` or a quoted command output. Anything I inferred is labelled **[inference]**.

---

## Facts I verified (short list, each proved below)

1. The stage classifier is a **harvest-time artifact only** (`scripts/harvest-track-a.ts:516-548`). The app resolves stages from an explicit operator selection — there is **no** title/text classifier in `src/`.
2. `detectStageWithSource` reads the document body but **only `text.slice(0, 8000)`** (`scripts/harvest-track-a.ts:539`). This truncation alone changes the answer on real Canadian documents (proved on 9/9 T3 docs and on 5 of 7 committed CA reference PDFs).
3. The v1 English DETAILED_DESIGN branch **never matches "detail design"** — the TAC/UNB spelling. `/d[ée]taill[ée]e?\b/i` is French-only (`node -e` output quoted in Q2.2). This is the direct cause of the UNB paper's `PRE_OPENING` label.
4. `en\s+service` in the v1 PRE_OPENING rule (`scripts/harvest-track-a.ts:517`) matches French *"mise en service"* — **in-service**, not pre-opening. A confirmed false positive in the QC guide.
5. The corpus **is re-obtainable**: all 9 T3 document URLs return HTTP 200 and re-download to **byte-identical sha256** (Q3).
6. **The Transitway document names no RSA stage anywhere in 91,794 characters.** The ticket's premise that "station / corridor / functional design" will unlock it is **not supported by the document** (Q2.4, Q7).
7. The largest Canadian T3/T4 pool on the operator's disk (22 documents, stage `existing`) has **no cell to move into** — `policies/canada/pack.json:76-83` gives `ca-tac:pre-opening` `canonical_stages: []` and there is no in-service cell (Q7).

---

## Q1 — Classifier surface

### Q1.1 Where stage detection happens today

**Two independent classifiers exist. Neither is in the app.**

| # | Location | What it classifies | Input |
|---|---|---|---|
| A | `scripts/harvest-track-a.ts:516-520` `STAGE_RULES` (4 rules) → `detectStageWithSource` (`:534-544`) → `detectStage` (`:547-549`) | Manifest `stage` + `cell_key` | Extracted PDF **body text**, first 8 000 chars only (`:539`) |
| B | `docs/RSA-Documents/scripts/build-ondisk-inventory.py:110-121` `STAGE_RULES` (filename cues) + `:123-131` `STAGE_TEXT_PATTERNS` (text patterns) + `:155-164` `DEEP_STAGE_PATTERNS` (count-scored) → `detect_stage` (`:395-406`) / `deep_stage` (`:525-534`) | On-disk **inventory** `stage` field | Filename first, then full text, then count-scored patterns |

Classifier B is the **broader** one today: it already knows `"design stage"`, `"stage 2"`, `"stage 3"`, `"conceptual"`, `"commissioning"`, `"before opening"`, `"post-construction"`, `"concept"`, `"scoping"`, `"screening"` (`:110-121`), and its text patterns already know `"concept stage"`, `"feasibility stage"`, `"existing corridor"`, `"in[- ]service"`, `"post[- ]construction"` (`:123-131`, `:155-164`). **v2 should reconcile with B, not invent a third vocabulary.**

**The app has NO text/title classifier.** Evidence:

- `src/domain/odd.ts:76-89` `resolveOdd(jurisdiction, canonicalStages)` — matches a **canonical-stage multiset** already supplied by the caller against the ODD declaration. It never looks at a title or a body.
- `src/domain/pipeline/nodes/stage-select.ts:17-38` `requireStage(pack, nativeStageId)` — resolves an **operator-chosen `native_stage_id`**; `:40-41` reads `ctx.project.stage_selection.jurisdiction` / `.native_stage_id`. `:47-56` then calls `resolveOdd(pack.jurisdiction, stage.canonical_stages)`.
- `src/domain/odd.ts:73-75` `canonicalKey(stages)` — cell identity is jurisdiction + sorted canonical stages.

⇒ Changing the harvest classifier cannot change app behaviour; the app's stage selection is a separate, human-driven path. **[inference, high confidence]**

### Q1.2 Every caller of `detectStage` / `detectStageWithSource`

```
scripts/harvest-track-a.ts:547   export function detectStage(text, hint): string
scripts/harvest-track-a.ts:548     return detectStageWithSource(text, hint).stage;
scripts/harvest-track-a.ts:964   const stage = detectStageWithSource(text, attrs.stageHint);
tests/discovery/harvest-track-a.test.ts:14,68,70,73,74,75,79,83,87
tests/discovery/harvest-track-a-round2-report.test.ts:14,109,112,115,116,120
```
`grep -rn "detectStage\|detectStageWithSource" --include=*.ts --include=*.tsx --include=*.mjs .` → the only production call site is **`scripts/harvest-track-a.ts:964`**. The export at `:547` exists only for tests.

### Q1.3 Every consumer of the `stage` / `cell_key` fields

**Writer** — `scripts/harvest-track-a.ts`:
- `:80-81` `TSV_COLUMNS` contains `"stage"` and `"cell_key"` (the download-log TSV header).
- `:1010-1011` `stage: stage.stage, cell_key: CANONICAL_STAGE[stage.stage] ?? ""` (the `IntakeRecord`; interface at `:190-217`).
- `:1048` console line `record.tier, record.stage`.
- `:1372-1373` `runReport`: `records.filter(r => r.cell_key === cell.cell_key)` and `... && r.tier === "T3"`.
- `:1377` `const unstaged = records.filter((r) => r.cell_key === "")`.
- `:1432-1434` the unstaged table groups by `r.stage`.
- `:1555` selftest: `check(records.every(r => r.project_id && r.split && r.stage), "every record has project_id, split and stage")` — **`stage` must stay truthy on every row.**

**Report scripts**:
- `scripts/harvest-track-a-report.ts:25-29` `MANIFEST_STAGE_TO_CELL` (stage → cell map); `:34` `UNMAPPED_STAGES = ["existing","pre-opening","unknown","UNSTAGED","MULTI_STAGE","PRE_OPENING"]`; `:252-255` `mergeRows` (manifest wins for stage/cell); `:274-275` per-row `stage`/`cell`; `:320-323` `stageFrom` (hint vs rule provenance); `:468-470` unmapped-stage tally; `:479-483` re-labelling diff; `:541-545` fetched-rows table (`row.stage`, `row.cell_key`); `:621` inventory stage tally.
- `scripts/harvest-track-a-round2-report.ts:251` `coverage.cells.find(c => c.cell_key === cellKey)`; `:262-270` the AC1 before/after coverage table; `:308-313` the near-miss table (`row.stage`); `:370` `MANIFEST_STAGE_TO_CELL[m.stage] !== undefined`; `:471` same predicate for the coverage-candidate rule.

**ODD coverage table** — `state/odd-coverage.json` is **NOT** derived from the manifest. `scripts/discovery-coverage.ts:21,50` reads `state/discovery-ledger.json` and writes `state/odd-coverage.json`; `grep -rn "canada-intake-manifest" src/ scripts/` matches only the harvest scripts. So `state/odd-coverage.json` is a separate pipeline (targets/priorities only) and is **not** affected by a classifier change.

**App UI** — `src/app/dev/mission-control/_components/odd-matrix.tsx:34-47,138` and `cell-card.tsx:161` consume `state/odd-coverage.json` `cell_key` only. **Not affected.**

### Q1.4 What breaks if `stage` becomes a multi-candidate structure

| Consumer | Break |
|---|---|
| `scripts/harvest-track-a.ts:1011` `CANONICAL_STAGE[stage.stage] ?? ""` | An object key lookup returns `""` → the row silently loses its cell. Must become `CANONICAL_STAGE[primary]` with an explicit rule. |
| `scripts/harvest-track-a-report.ts:25-29` `MANIFEST_STAGE_TO_CELL` | `Record<string,string>` indexed by a string; an object key yields `undefined` → `cell: null` (`:254-255`) → row silently drops out of every cell. |
| `scripts/harvest-track-a-report.ts:34` `UNMAPPED_STAGES` | A new stage token (e.g. `AMBIGUOUS`) is not in the list → it disappears from the "unmapped stages" table (`:467-470`) instead of being counted. |
| `scripts/harvest-track-a-report.ts:320-323` `stageFrom` | `row.stage === source.stage_hint` compares a string to a hint; a structure breaks the hint/rule provenance split that §4 of the report depends on. |
| `scripts/harvest-track-a-report.ts:541-545` / `harvest-track-a-round2-report.ts:308-313` | Table cells render `row.stage` — a structure renders as `[object Object]`. |
| `scripts/harvest-track-a.ts:1432-1434` | Unstaged table groups by `r.stage` — needs a per-candidate expansion or a "primary stage" grouping. |
| `scripts/harvest-track-a.ts:1555` selftest | `r.stage` truthiness — an object is truthy, so this passes, but the **committed manifest schema** (`docs/RSA-Documents/corpus-schema.json:14-17`, `stage` is `enum ["PRELIMINARY_DESIGN","DETAILED_DESIGN","FEASIBILITY_CONCEPT"]`) does **not** allow an object. |
| `docs/RSA-Documents/canada-intake-manifest.jsonl` (33 rows) | The committed `stage` values are plain strings; changing the shape **invalidates every committed row** unless a versioned sidecar is used (see Q5). |
| `tests/discovery/harvest-track-a.test.ts:68-89` | `detectStage(...)` is asserted to return a **string**; `:79` asserts `"MULTI_STAGE"`. |
| `tests/discovery/harvest-track-a-round2-report.test.ts:108-121` | Asserts `detectStageWithSource(...).stage` is a string (`:109-120`). |
| `tests/discovery/harvest-track-a-report.test.ts:127-137` | Asserts `MANIFEST_STAGE_TO_CELL` maps the manifest stage vocabulary and leaves the rest unmapped. |

**Cheapest safe shape:** keep `stage: string` **and** `cell_key: string` exactly as they are (so every consumer above keeps working), and add the candidates + confidence in a **separate, versioned sidecar** (Q5). **[inference, medium-high confidence]**

---

## Q2 — Canadian vocabulary source

### Q2.0 Method (what I extracted, and how)

The corpus binaries are absent here (see Q3), so I extracted the **committed Canadian reference PDFs** in `docs/references/CA/` (7 files, 18 MB, listed with sha256 in `docs/references/CA/MANIFEST.md:11-17`):

```
$ cd docs/references/CA && for f in *.pdf; do pdftotext -layout "$f" ~/t62tmp/"${f%.pdf}".txt; done
alberta-transportation-rsa-guidelines-2004 pages=20  chars=43986
alberta-transportation-rsa-implementation-plan-2004 pages=43 chars=88002
bct-moti-rsa-guidelines-tc-t02-04c-2004 pages=11 chars=22792
bct-moti-rsa-policy-tc-t02-04-2004 pages=2 chars=3972
ontario-good-roads-rsa-guideline-2023 pages=54 chars=249035
qc-mtq-guide-audits-securite-routiere-2012 pages=55 chars=152466
unb-transportation-group-rsa-guidelines pages=168 chars=363799
```
Page numbers below are the PDF page index of that extraction (`pdftotext` emits `\f` per page). I also re-extracted the two named T3 documents with **the repo's own tool** (`unpdf`, `extractText(pdf,{mergePages:true})` — identical to `scripts/harvest-track-a.ts:920-925`) to reproduce the classifier's view exactly.

### Q2.1 The Canadian stage vocabulary, verbatim, with evidence

**TAC vocabulary (Alberta equivalency table, `alberta-transportation-rsa-implementation-plan-2004` p13 and `alberta-transportation-rsa-guidelines-2004` p7):**
> "Planning Stage RSA  Stage 1 RSA | Preliminary Design Stage RSA  Stage 2 RSA | Detailed Design Stage RSA  Stage 3 RSA | Pre-opening Stage RSA  Pre-opening Stage RSA"

and (implementation plan p4):
> "The road safety audit stages described in the TAC Canadian Road Safety Audit Guide include **planning, preliminary design, detailed design, construction and pre-opening**."

and (p13): "In-service road safety audits are discussed in a separate section."

**BC (`bct-moti-rsa-guidelines-tc-t02-04c-2004` p5):**
> "Road transportation projects may be subject to road safety audit at the following stages: • Planning Stage • Preliminary Design Stage • Detailed Design Stage • Pre-opening Stage"

**Ontario / Good Roads 2023 (`ontario-good-roads-rsa-guideline-2023` p12-13) — five stages, and they are NOT the Alberta four:**
> p12 "Feasibility stage: Generally, a planning stage where the alignment of a road or general location of a facility are known, but very few other details exist."
> p12 "**Concept design stage**: An early stage of design where basic details have been worked out."
> p12 "Detailed design stage: A late stage of design where virtually all the details have been finalized."
> p13 "**Pre-opening stage**: After construction when the works are substantially complete, but only before the facility has been opened to the public."
> p13 "**Existing conditions**: Distinct from a post-opening audit, this is an audit of a road already in service."
> p14 (Table 2) "Audit stage | Advantages | Challenges" — rows "Feasibility", "Concept design", "Detailed design", "Pre/post-opening", "Existing conditions".
> p43+ (Appendix D prompt list) column headers: "**Feasibility stage | Concept design | Detailed design | Pre-opening | Existing roads or post-opening**".

**UNB / Canadian-context synthesis (`unb-transportation-group-rsa-guidelines` p21, §3.2):**
> p21 "Traditionally, audits have been undertaken at the following key stages: (1) **feasibility (planning)**; (2) **draft (preliminary/layout) design**; (3) **detail design**; (4) **pre-opening**; and (5) **post-opening (including existing or in-service facilities)**."
> p21 §3.2.1 "Feasibility (Planning) Stage"; p21 §3.2.2 "Draft (Preliminary/Layout) Design Stage" (TOC p5); p22 §3.2.3 "Detailed Design Stage"; p22 §3.2.4 "Pre-Opening Stage".
> p25 §3.4.5.1 "**Feasibility and Preliminary Design (Stages 1 and 2)**"; p26 §3.4.5.2 "Detailed Design (Stage 3)"; p26 §3.4.5.3 "Pre-Opening (Stage 4)".
> p40 "Audit stage (e.g., **Stage 3: 50% Detailed Design Road Safety Audit**)".
> p141 "**75% DESIGN STAGE** -NEW FACILITY"; p142 "**75% DESIGN STAGE AUDIT**: ROUTE 20 HIGH SPEED CONNECTOR TO ROUTE 21 INTERCHANGE"; p146 "**50% DESIGN STAGE AUDIT**"; p154 "**95% DESIGN STAGE AUDIT**".

**Quebec / MTQ 2012 (`qc-mtq-guide-audits-securite-routiere-2012`, French) p10:**
> "Selon la nature ou l'ampleur d'un projet, les audits de sécurité routière peuvent être réalisés à différentes étapes du développement d'un projet routier. Le Guide de gestion des projets routiers précise qu'il y aurait lieu de réaliser quatre audits par projet, soit à l'étape : • de l'**avant-projet préliminaire**; • des **plans et devis préliminaires**; • des **travaux**; • de l'**évaluation (mise en service)**. Toutefois, un audit peut être réalisé aux étapes de l'**avant-projet définitif** ou des **plans et devis définitifs**, selon les besoins de l'équipe de projet."

and p12 (checklist column headers — the full Quebec project-step ladder):
> "Étapes | Étude des besoins | Étude des solutions | Avant-projet préliminaire | Avant-projet définitif | Plans et devis préliminaires | Plans et devis définitifs | Avant travaux | Travaux | **Évaluation à l'exploitation**"

(This exact passage is already in the repo's evidence base: `docs/research/canada-rsa-research.md:308-309` and `state/evidence-registry.json:1580-1581`, EV-CA-032.)

**Alberta percentages (implementation plan p23):**
> "A Stage 3 road safety audit will be appropriate to be conducted prior to the Milestone 'Modify Design Based on Recommendations from Others' (**before 75% completion**) by the consultant."

and `policies/canada/pack.json:63-64` (the repo's own trigger for DETAILED_DESIGN): `"~90–95% design"`; `:45` (PRELIMINARY_DESIGN trigger): `"At 95% of the Functional Plan before final submission [EV-CA-008]"`.

### Q2.2 What the current 4 rules MISS — with the failing case proved

I re-extracted the two named T3 documents with the repo's own `unpdf` call and ran the exact v1 rule array:

```
$ node v1.mjs ~/t62tmp/corpus/*.pdf
0af7ea584ae0 manifest= FEASIBILITY_CONCEPT | v1@8000= FEASIBILITY_CONCEPT | v1@full= FEASIBILITY_CONCEPT | len 9290
0d9a76ff4e71 manifest= UNSTAGED           | v1@8000= UNSTAGED           | v1@full= UNSTAGED           | len 91794
2ea94190b6df manifest= PRE_OPENING        | v1@8000= PRE_OPENING        | v1@full= PRE_OPENING        | len 30021
37863ef8e713 manifest= MULTI_STAGE        | v1@8000= MULTI_STAGE        | v1@full= MULTI_STAGE        | len 20245
7b9715f0d030 manifest= MULTI_STAGE        | v1@8000= MULTI_STAGE        | v1@full= MULTI_STAGE        | len 53832
e8810b8a08ac manifest= PRELIMINARY_DESIGN | v1@8000= PRELIMINARY_DESIGN | v1@full= PRELIMINARY_DESIGN | len 17015
ececad097781 manifest= MULTI_STAGE        | v1@8000= MULTI_STAGE        | v1@full= MULTI_STAGE        | len 56541
ed2c0d694461 manifest= FEASIBILITY_CONCEPT | v1@8000= FEASIBILITY_CONCEPT | v1@full= MULTI_STAGE        | len 90699
```
⇒ **All 9 T3 rows reproduce the committed manifest exactly under v1@8000.** The pipeline is deterministic and re-derivable (Q3). Note `ed2c0d694461`: v1@8000 = `FEASIBILITY_CONCEPT`, v1@full = `MULTI_STAGE` — the 8 000-char window alone changes the answer.

**(a) "detail design" — the UNB/TAC spelling — is NEVER matched by v1.**
```
$ node -e "const re=/d[ée]taill[ée]e?\b/i; for(const s of ['detailed design','detail design','detaille','detaillée','detailee','Detailed Design']) console.log(JSON.stringify(s), re.test(s));"
"detailed design" false
"detail design" false
"detaille" true
"detaillée" true
"detailee" false
"Detailed Design" false
```
The v1 DETAILED_DESIGN rule is `[/stage\s*3|detailed design|d[ée]taill[ée]e?\b/i, "DETAILED_DESIGN"]` (`scripts/harvest-track-a.ts:518`). Its third branch is **French-only**; the English branch is the literal phrase "detailed design". The UNB paper writes "**detail design**" (`unb-transportation-group-rsa-guidelines` p21; `unb-paper` unpdf text at offset 5655: `"draft\n(preliminary/layout) design, detail design, pre-opening, and post-opening"`). ⇒ **MISSED.**

**(b) "feasibility" and "preliminary" as bare words are MISSED.** Same UNB sentence (unpdf offsets): `feasibility` @5596, `preliminary` @5627, `detail` @5655, `pre-opening` @5670 — **all inside the 8 000-char window**, yet v1 matched only `pre-opening`. v1's FEASIBILITY rule needs `stage 1|planning stage|functional plan|planification|étude de faisabilité` (`:519`); v1's PRELIMINARY rule needs `stage 2|preliminary design|préliminaire` (`:517` region, `:518-519`). "feasibility (planning)" and "draft (preliminary/layout) design" match neither. ⇒ **This is the exact cause of the UNB paper's `PRE_OPENING` label** (manifest row 23, `docs/RSA-Documents/canada-intake-manifest.jsonl`).

**(c) "en service" in the v1 PRE_OPENING rule is a false positive.** `/en\s+service/i` matches *"mise en service"* = in-service. Measured on the QC guide:
```
FILE qc-mtq-guide-audits-securite-routiere-2012.pdf textLen 79187
  head(8000) hits: ["PRELIMINARY_DESIGN"] => PRELIMINARY_DESIGN
  full-text hits: [...,"PRE_OPENING",...] => MULTI_STAGE
    PRE_OPENING en service@17754, en service@22963, en service@33127, en service@36923
```
⇒ "en service" must move to an **in-service / existing** bucket, not PRE_OPENING.

**(d) "functional plan" is mapped to FEASIBILITY_CONCEPT but the repo's own pack says PRELIMINARY_DESIGN.** `scripts/harvest-track-a.ts:519` maps `functional plan` → FEASIBILITY_CONCEPT; `policies/canada/pack.json:45` says the PRELIMINARY_DESIGN trigger is *"At 95% of the Functional Plan before final submission"*, and `alberta-transportation-rsa-guidelines-2004` p8 says *"A Stage 2 road safety audit should be conducted at the 95% stage of the Functional Plan"*. **Direct contradiction inside the repo.** A test pins the current behaviour: `tests/discovery/harvest-track-a.test.ts:70` (`"Stage 1 Road Safety Audit of the functional plan"` → `FEASIBILITY_CONCEPT`). ⇒ **Needs a human ruling** (Q7).

**(e) The 8 000-char window hides stage names in real Canadian guidance.** Measured on the committed CA reference PDFs (v1 rules, head-8000 vs full text):
```
FILE ontario-good-roads-rsa-guideline-2023.pdf textLen 125835
  head(8000) hits: [] => UNSTAGED
  full-text hits: [PRE_OPENING, DETAILED_DESIGN, PRELIMINARY_DESIGN, FEASIBILITY_CONCEPT] => MULTI_STAGE
    PRE_OPENING Pre-opening@24788, ...
    DETAILED_DESIGN Detailed design@23628, ...
    PRELIMINARY_DESIGN preliminary design@99697
    FEASIBILITY_CONCEPT planning stage@22976, stage 1@29079
FILE bct-moti-rsa-guidelines-tc-t02-04c-2004.pdf textLen 19327
  head(8000) hits: [] => UNSTAGED      (full text: all four stages)
FILE alberta-transportation-rsa-guidelines-2004.pdf textLen 32784
  head(8000) hits: ["FEASIBILITY_CONCEPT"]   (full text: MULTI_STAGE)
FILE qc-mtq-guide-audits-securite-routiere-2012.pdf textLen 79187
  head(8000) hits: ["PRELIMINARY_DESIGN"]    (full text: MULTI_STAGE)
```
⇒ "Read the document body" must mean **read the whole extracted text**, not "read 8 000 characters".

### Q2.3 Words that mean the SAME stage vs words that are genuinely AMBIGUOUS

**Same stage (treat as one canonical stage):**

| Canonical | Aliases (verbatim) | Evidence |
|---|---|---|
| `FEASIBILITY_CONCEPT` | "planning stage", "stage 1", "feasibility stage", "feasibility (planning)", "Étude des besoins", "Étude des solutions" | impl-plan p13; ON p12/p43; UNB p21; QC p12 |
| `PRELIMINARY_DESIGN` | "preliminary design stage", "stage 2", "draft (preliminary/layout) design", "concept design stage", "plans et devis préliminaires" | UNB p21/p25; ON p12/p43; QC p10/p12 |
| `DETAILED_DESIGN` | "detailed design stage", "detail design", "stage 3", "final design", "plans et devis définitifs", "avant-projet définitif" | UNB p21/p26; ON p12; QC p10/p12 |
| `PRE_OPENING` (no cell) | "pre-opening stage", "stage 4", "avant l'ouverture" | UNB p26 §3.4.5.3; ON p13; BC p5 |
| `EXISTING` (no cell) | "post-opening", "in-service", "existing roads", "existing conditions", "mise en service", "évaluation à l'exploitation", "en exploitation" | UNB p21; ON p13/p43; QC p10/p12; impl-plan p13 |
| `CONSTRUCTION` (no cell) | "travaux", "construction" | impl-plan p4; QC p10/p12 |

**Genuinely AMBIGUOUS (must carry ≥2 candidates, never one):**

1. **A document naming two stages in its own scope.** UNB p142: *"This 75% Design Stage audit is supplementary to the **Preliminary Design, 50% Design, and Pre-Opening** Audits completed on June 7, July 16, and August 5, 1999."* → `PRELIMINARY_DESIGN + DETAILED_DESIGN + PRE_OPENING`.
2. **"Stage 1 and 2" documents.** Committed manifest row 33 title: *"COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS' RESPONSE"* → `FEASIBILITY_CONCEPT + PRELIMINARY_DESIGN`. (v1 today labels it `FEASIBILITY_CONCEPT` because its regex needs the literal "stage 2", and the title says "STAGE 1 AND 2".)
3. **Percentage design markers.** "50% Design" (UNB p146), "75% Design Stage" (UNB p141), "95% Design Stage" (UNB p154), "50% Detailed Design" (UNB p40). The percentages straddle the preliminary/detailed boundary: Alberta puts the Stage 3 RSA "before 75% completion" (impl-plan p23) while `policies/canada/pack.json:63-64` puts DETAILED_DESIGN at "~90–95% design" and `:45` puts PRELIMINARY_DESIGN at "95% of the Functional Plan". **No committed source fixes a percentage→stage table** ⇒ percent markers must be a candidate pair (`PRELIMINARY_DESIGN + DETAILED_DESIGN`) with a confidence, not a forced stage. **[inference]**
4. **"Functional Plan" / "functional planning".** Alberta uses "Functional Plan" for the Stage 2 (preliminary) audit (guidelines p8; impl-plan p5 "Stage 2 RSA of Draft Functional Plan"), while "Functional Planning" is also the *project phase* that contains the Stage 1 audit (guidelines p7 "A. Functional Planning"). ⇒ **ambiguous between FEASIBILITY_CONCEPT and PRELIMINARY_DESIGN**; also contradicts the current v1 rule (Q2.2(d)).
5. **"concept design"** — Good Roads places it 2nd of 5 (between Feasibility and Detailed) (ON p12, p43). Whether it maps to FEASIBILITY_CONCEPT or PRELIMINARY_DESIGN is **not settled by any committed source** ⇒ candidate pair with a human ruling. **[inference]**
6. **"avant-projet préliminaire"** — Quebec's *first* audit step (QC p10/p12), i.e. a design proposal; its French literal ("preliminary") maps to PRELIMINARY_DESIGN but its *position* maps to FEASIBILITY_CONCEPT. ⇒ candidate pair.

### Q2.4 The ticket's explicit probes, answered

| Probe | Verdict | Evidence |
|---|---|---|
| "station / corridor / functional design" | **NOT supported as a stage cue.** | The Transitway document contains **zero** occurrences of "design stage", "stage", "preliminary", "detailed", "feasibility", "pre-opening" in 91 794 chars: `node -e "…['station design','design stage','stage','preliminary','detailed','feasibility','pre-opening','opening'].forEach(w=>console.log(w, [...t.matchAll(new RegExp(w,'gi'))].map(m=>m.index).slice(0,10)))"` → `design stage []`, `stage []`, `preliminary []`, `detailed []`, `feasibility []`, `pre-opening []`, `opening []`; only `station design [11,195,576,832,1017,2740,5354,8071,10354,13153]` (the project name) survives. "Station Design Guidelines" is the OC Transpo guideline title (p8: *"the OC Transpo Transitway and Station Design Guidelines, June 2013"*). "corridor" appears in the CA references only in prose, never as a stage: ON p42 ("the corridor in which the project is located"), AB p3 ("at a site, on a corridor, or throughout an area"). "functional design" appears in **none** of the 7 committed CA reference PDFs. |
| "30% / 60% / 90% design" | **Real markers, but different numbers.** The committed corpus uses **50% / 75% / 95%** (UNB p141/p142/p146/p154) and Alberta uses "95% stage of the Functional Plan" (guidelines p8) and "before 75% completion" (impl-plan p23). **No committed source uses 30% or 60%.** | as above |
| "conception préliminaire" | **Not the Quebec term.** QC uses "**avant-projet préliminaire**" and "**plans et devis préliminaires**". "conception préliminaire" appears in **none** of the 7 committed CA PDFs. | QC p10, p12 |
| "conception détaillée" | **Not the Quebec term.** QC uses "**avant-projet définitif**" and "**plans et devis définitifs**". | QC p10, p12 |
| "audit de sécurité routière en exploitation" | **Near-miss.** The QC guide's column header is "**Évaluation à l'exploitation**" (p12), not "en exploitation". "en exploitation" does not appear. | QC p12 |
| TAC stage names (Ontario Good Roads + UNB) | **Five TAC names**, listed in Q2.1. Good Roads = Feasibility / Concept design / Detailed design / Pre-opening / Existing conditions. UNB = feasibility (planning) / draft (preliminary-layout) design / detail design / pre-opening / post-opening (existing, in-service). | ON p12-14, p43; UNB p21 |

### Q2.5 Proposed v2 rule list (ordered, most specific first)

Design: scan the **whole** extracted text (cap 200 000 chars, mirroring `src/lib/extract.ts:39`); each rule contributes a hit count to a stage bucket; the buckets become the candidate list. Order matters only for tie-breaking.

| # | id | regex (illustrative) | stage | cell | evidence |
|---|---|---|---|---|---|
| 1 | `CA-PREOPEN` | `\bpre[-\s]?opening\b\|\bavant\s+l[’']?ouverture\b` | `PRE_OPENING` | — (no cell) | UNB p22 §3.2.4; ON p13; BC p5; impl-plan p13 |
| 2 | `CA-EXISTING` | `\bpost[-\s]?opening\b\|\bin[-\s]?service\s+(road\|highway\|facilit\|review\|audit)\|\balready\s+in\s+service\b\|\bexisting\s+(roads?\|highways?\|corridors?\|facilities)\b\|\bmise\s+en\s+service\b\|\b[ée]n\s+exploitation\b` | `EXISTING` | — | UNB p21; ON p13/p43; QC p10/p12; impl-plan p13 |
| 3 | `CA-CONSTR` | `\bconstruction\s+(phase\|stage)\b\|\bdes\s+travaux\b\|\btravaux\b` | `CONSTRUCTION` | — | impl-plan p4; QC p10 |
| 4 | `CA-PCT` | `\b(\d{1,3})\s?%\s+(design\|d[ée]tail\|detailed\|plan)\b` → capture % | `PCT_DESIGN` | candidate pair | UNB p141/p142/p146/p154/p40; impl-plan p23; pack.json:45,63-64 |
| 5 | `CA-DETAIL` | `\bdetailed\s+design\b\|\bdetail\s+design\b\|\bstage\s*(3\|three)\b\|\bplans\s+et\s+devis\s+d[ée]finitifs?\b\|\bavant[-\s]projet\s+d[ée]finitif\b` | `DETAILED_DESIGN` | `canada:DETAILED_DESIGN` | UNB p21/p26; ON p12; QC p10 |
| 6 | `CA-PRELIM` | `\bpreliminary\s+(design\|stage)\b\|\bdraft\s*\(\s*preliminary\/layout\s*\)\s*design\b\|\bpreliminary\/layout\s+design\b\|\bstage\s*(2\|two)\b\|\bconcept\s+design\b\|\bplans\s+et\s+devis\s+pr[ée]liminaires\b` | `PRELIMINARY_DESIGN` | `canada:PRELIMINARY_DESIGN` | UNB p21/p25; ON p12/p43; QC p10 |
| 7 | `CA-FEAS` | `\bfeasibility\s+(stage\|\(planning\)\|study)\b\|\bplanning\s+stage\b\|\bstage\s*(1\|one)\b\|\b[ée]tude\s+des\s+(besoins\|solutions)\b` | `FEASIBILITY_CONCEPT` | `canada:FEASIBILITY_CONCEPT` | UNB p21 §3.2.1; ON p12/p43; impl-plan p13; QC p12 |
| 8 | `CA-AMBIG-FUNC` | `\bfunctional\s+(plan\|planning)\b` | **candidate pair** FEASIBILITY+PRELIM | — | impl-plan p5/p8; guidelines p7-8; pack.json:45 — **contested, see Q7** |
| 9 | `CA-AMBIG-CONCEPT` | `\bconcept\s+(stage\|design)\b` | **candidate pair** FEASIBILITY+PRELIM | — | ON p12/p43 — **contested, see Q7** |
| 10 | `CA-AMBIG-AVP` | `\bavant[-\s]projet\s+pr[ée]liminaire\b` | **candidate pair** FEASIBILITY+PRELIM | — | QC p10/p12 |

**Two rules deliberately tightened (false-positive traps):**
- Do **not** keep `en\s+service` inside the PRE_OPENING rule (it matches "mise en service") — move it to `CA-EXISTING`.
- Do **not** use bare `existing\s+condition` / `final\s+design` / `functional plan` — the repo itself warns: *"text cues are deliberately specific - a bare 'existing' in prose is not a stage"* (`docs/RSA-Documents/scripts/build-ondisk-inventory.py:122`). Proof of the trap: my exploratory v2 prototype put the Transitway document in `canada:DETAILED_DESIGN` purely on the prose hit *"the responsibility for the **final design** and operation of the Transitway rests with the Owner"* (unpdf offset 4023).

**Rule count:** 10 rules (7 canonical-stage rules + 1 in-service + 1 construction + 1 percentage rule), of which **3 emit a candidate pair** (rules 8-10) and **2 map to no cell** (rules 1-3 group).

### Q2.6 Exploratory preview (NOT a committed result — a prototype)

A throwaway prototype of the above (count-scored, whole text, "dominant if top ≥ 2× runner-up") over the 9 T3 documents:

```
0af7ea584ae0  v1=FEASIBILITY_CONCEPT  v2=SINGLE     FEASIBILITY_CONCEPT=14                cell(v2)=canada:FEASIBILITY_CONCEPT   manifest cell=canada:FEASIBILITY_CONCEPT
0d9a76ff4e71  v1=UNSTAGED            v2=SINGLE     DETAILED_DESIGN=1                    cell(v2)=canada:DETAILED_DESIGN      manifest cell=-
2ea94190b6df  v1=PRE_OPENING         v2=DOMINANT   EXISTING=9 PRE_OPENING=1 DETAILED_DESIGN=1 PRELIMINARY_DESIGN=1   cell(v2)=-   manifest cell=-
37863ef8e713  v1=MULTI_STAGE         v2=DOMINANT   DETAILED_DESIGN=27 EXISTING=11 PRE_OPENING=9 PRELIMINARY_DESIGN=3 FEASIBILITY_CONCEPT=1   cell(v2)=canada:DETAILED_DESIGN  manifest cell=-
7b9715f0d030  v1=MULTI_STAGE         v2=AMBIGUOUS  DETAILED_DESIGN=25 FEASIBILITY_CONCEPT=18 PRELIMINARY_DESIGN=16 EXISTING=1   cell(v2)=-   manifest cell=-
e8810b8a08ac  v1=PRELIMINARY_DESIGN  v2=SINGLE     PRELIMINARY_DESIGN=20                cell(v2)=canada:PRELIMINARY_DESIGN    manifest cell=canada:PRELIMINARY_DESIGN
ececad097781  v1=MULTI_STAGE         v2=DOMINANT   DETAILED_DESIGN=71 PRELIMINARY_DESIGN=19 FEASIBILITY_CONCEPT=7   cell(v2)=canada:DETAILED_DESIGN  manifest cell=-
ed2c0d694461  v1=FEASIBILITY_CONCEPT  v2=AMBIGUOUS  FEASIBILITY_CONCEPT=12 DETAILED_DESIGN=9 PRELIMINARY_DESIGN=2 EXISTING=1   cell(v2)=-   manifest cell=canada:FEASIBILITY_CONCEPT
```
Read this as a **design probe, not a result**:
- The Transitway row (`0d9a76ff4e71`) shows the trap: its only DETAILED_DESIGN hit is the prose "final design" ⇒ **the movement is an artefact, not evidence**.
- `ed2c0d694461` shows the **coverage-regression risk**: under a strict "ambiguous ⇒ no cell" rule a document that currently sits in `canada:FEASIBILITY_CONCEPT` would **lose** its cell. Any v2 must state whether ambiguous documents keep their primary cell or leave it.
- The UNB paper (`2ea94190b6df`) now correctly shows **four** candidates instead of a forced `PRE_OPENING`.

---

## Q3 — Corpus availability (the hard constraint)

### Q3.a Is there a committed artefact holding the body text?

**No.** Searches:
```
$ grep -rln "Multidisciplinary Road Safety" . | grep -v node_modules | grep -v '\.git/'
./docs/RSA-Documents/canada-intake-manifest.jsonl
$ grep -rn "Transitway" -l .
./docs/RSA-Documents/{track-a-reconciliation.md,ingestion-manifest.md,track-a-round2-candidate-log.tsv,canada-intake-manifest.jsonl,track-a-round2-harvest-report.md,corpus-catalog.json,dedupe-index.json,track-a-split.json,track-a-ondisk-inventory.jsonl,dedupe-report.md,track-a-harvest-report.md,canadian-download-log.tsv,track-a-round2-candidates.json,track-a-round2-duplicates.json,scripts/build-ondisk-inventory.py}
```
All hits are **metadata** (titles, paths, sha256, counters). `docs/RSA-Documents/corpus-catalog.json` holds `{canonical_id, path, bytes, sha256, jurisdiction, license, quarantine, tier, doc_type, stage, label_confidence, needs_review, shelf}` — **no body text**. The manifest rows carry exactly these fields:
```
$ node -e "…console.log(Object.keys(rows[0]))"
['project_id','sha256','tier','stage','cell_key','ca_province','lang','split','doc_type','source_url','licence_verdict','licence_basis','licence_ref','track','missing_side_note','title','fetched_at','bytes','local_path','source_id']
```
⇒ **No committed extract/text cache exists.** The bodies must be re-fetched.

### Q3.b Are the public URLs still fetchable from here?

Network is partially open from this container (an allowlist): `curl https://example.com` fails (exit 7) while the corpus hosts succeed. **HEAD only, no bodies**, over all 33 committed manifest URLs:

```
$ while read u b; do curl -sIL -o /dev/null -w "%{http_code} %{content_type}" "$u"; ...; done
200 application/pdf | len=35444    | man=35444    | T3 | FEASIBILITY_CONCEPT | neahdappendixc.pdf
200 application/pdf | len=179306   | man=179306   | T1 | MULTI_STAGE | Confederation Line ... AODA.pdf
200 application/pdf | len=146419   | man=146419   | T1 | PRELIMINARY_DESIGN | MEMO_WestboroStation ...
200 application/pdf | len=114317   | man=114317   | T1 | PRELIMINARY_DESIGN | MEMO_WestboroStation ...
200 application/pdf | len=1151579  | man=1151579  | T3 | UNSTAGED | Transitway Station Design ...
200 application/pdf | len=11126108 | man=11126108 | T1 | MULTI_STAGE | appendix-h.pdf
200 application/pdf | len=3581735  | man=3581735  | T1 | MULTI_STAGE | waitemata-greenways-pre-opening...
403 text/html       | len=146      | man=4028187  | T1 | FEASIBILITY_CONCEPT | 25068-01-001_RSA1.pdf
... (30 rows total with 200 + exact content-length == manifest bytes)
000 (no response)   |              | man=27414    | T1 | FEASIBILITY_CONCEPT | Additional Document 2 - Appendix C2 RSA Designers Response.pdf
```
Summary: **30 of 33 return HTTP 200 with a content-length exactly equal to the committed `bytes`; 2 return 200 without a content-length; 1 returns 403 (`consult.kerrycoco.ie`); 1 fails to connect (`www.southampton.gov.uk`).**

**The 9 T3 URLs are all 200 with exact content-length.** I then downloaded exactly those 9 (12.04 MB) and **every sha256 matched the manifest byte-for-byte**:
```
0af7ea584ae0.pdf 0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95
0d9a76ff4e71.pdf 0d9a76ff4e71e2b48ff2a5d96081dd7ee5419ec58275ed8587d246d0a0b2793c
7b9715f0d030.pdf 7b9715f0d03000e487953485e65b582da6148c054aabb49038de63c3e7b4f76a
e8810b8a08ac.pdf e8810b8a08ac067455bb869cec1bf246dcf3f718498672669039059282dddede
ed2c0d694461.pdf ed2c0d69446169b221217c97861c335e7d675e1bb68dc9c8cbf4b201163030d2
37863ef8e713.pdf 37863ef8e7134dc993ea5c2530df347c7bb0f290c3a4ca73e50e6615e81b137e
ececad097781.pdf ececad09778175b4624f4fed327b078eca1982012cf4cd587431c04c4b510893
2ea94190b6df.pdf 2ea94190b6df90060009794589689884d0db779299cc99ee5dcd1e8887c2602e
```
⇒ **The corpus is byte-reproducible from the committed URLs.** This is the single most important fact for the planner: **the "hard constraint" is not hard.**

### Q3.c Size and count if the corpora are re-fetched

```
$ node -e "…"
T3 n= 9 bytes= 12037812 11.48MB
T1 n= 24 bytes= 39214220 37.40MB
ALL n= 33 bytes= 51252032 48.88MB
```
- **Round 1 + round 2 corpus of record = the 33 manifest rows = 48.88 MB.** Round 1 contributed 3 rows, round 2 contributed 30 (`round` field; `undefined` ×3, `"2"` ×30).
- The round-2 **candidate log** has 108 rows; only 30 were ingested. The other 78: 39 "not RSA", 18 "hash-already-present" (downloaded in full then discarded — their bytes are in the operator's inventory, not the manifest), 7 "not a pdf", 13 robots-refused, 1 HTTP 403.
- The operator's on-disk corpus (304 inventoried rows, `docs/RSA-Documents/track-a-ondisk-inventory.jsonl`) is ~1.5 GB and is **not** reachable by URL — that is the only part that cannot be re-fetched.

### Q3.d RECOMMENDATION

**Re-fetch — the committed 33-row corpus, 48.88 MB, locally (not on the box).**

- **Which subset:** all 33 rows of `docs/RSA-Documents/canada-intake-manifest.jsonl`. The 9 T3 rows (12.04 MB) are the minimum that can change a coverage cell (T1 never counts as coverage — `scripts/harvest-track-a-report.ts:363`); the 24 T1 rows (37.40 MB) are needed only if the ticket's "report how many documents move into which cells" must cover every row.
- **Which script supports it:** none today. `scripts/harvest-track-a.ts` has `fetch|intake|accounting|report|selftest` (`:1588-1598`) and **no classify-only mode**; `fetch` writes to `docs/RSA-Documents/canada/track-a/**` (gitignored, `.gitignore:76-79`) and `intake` **appends to the committed manifest** (`scripts/harvest-track-a.ts:1249-1251`) — which would **invalidate the committed v1 record**. ⇒ **A new, separate script is required** (e.g. `scripts/harvest-stage-rules-v2.ts`) that (a) downloads to a scratch dir, (b) verifies sha256 against the manifest, (c) classifies under v2, and (d) writes **only** to a new path outside `docs/RSA-Documents`.
- **Box re-run:** **not needed and not recommended.** The corpus is 48.88 MB, but `oc-box` can only push `src/`, `tools/`, `tests/` and has no access to `docs/RSA-Documents`; the classifier is a `scripts/` artifact, and `scripts/` is outside the pushable set. Running the box would mean shipping the corpus itself — strictly worse than doing it in the checkout where the manifest, the reports and the gitignored corpus shelf already live. **Keep the box as a last option.**
- **Alternative — `docs/references/CA` as the body source (18 MB, 7 PDFs, already committed):** good for **designing and unit-testing the rules** (it is where the vocabulary evidence comes from), but it **cannot satisfy AC "re-run the round-1 and round-2 corpora"** — the reference PDFs are not corpus members and are not in the manifest. It is a *fixture* source, not a corpus source.
- **Alternative — committed metadata/titles only:** satisfies **none** of the three acceptance criteria. AC1 "a test per new rule, using real titles from the corpus" needs the corpus titles (available) but the rules must be validated against bodies; AC2 "a coverage table under rule set v2 versus v1" needs v2 classifications of the corpus, which needs bodies; AC3 "ambiguous documents listed with both candidate stages" needs bodies. Titles alone cannot produce candidates or confidence.

| Option | AC1 (test per rule) | AC2 (coverage v2 vs v1) | AC3 (ambiguous list) |
|---|---|---|---|
| **Re-fetch 33 rows (48.88 MB)** | ✅ real corpus titles + bodies | ✅ v1 and v2 on the same bodies | ✅ |
| `docs/references/CA` only | ✅ as fixtures, ❌ as corpus titles | ❌ | ❌ |
| Committed metadata/titles only | ⚠️ partial | ❌ | ❌ |

---

## Q4 — Versioned rule set: where v1 and v2 live

### Q4.1 Requirements vs the current layout

- **(i) v1 stays reproducible and the committed reports stay valid.** `scripts/harvest-track-a.ts:516-520` is the v1 rule set, but it is **inline in the harvester** — not a separately addressable artefact. The committed reports (`docs/RSA-Documents/track-a-harvest-report.md`, `track-a-round2-harvest-report.md`) are **byte-reproducible** from the committed inputs (`scripts/harvest-track-a-round2-report.ts:5-9`; `tests/discovery/harvest-track-a-round2-report.test.ts:99` "regenerates byte-identically from the committed inputs"; `tests/discovery/harvest-track-a-report.test.ts:251` "equals the freshly computed report, byte for byte"). **Any change to `STAGE_RULES` in place would silently change v1 and break those byte-identity tests.** ⇒ **v1 must be frozen as data.**
- **(ii) v2 is a distinct versioned artefact.**
- **(iii) the coverage table v2-vs-v1 is reproducible by a command.**

### Q4.2 Proposed paths

```
docs/research/stage-rules/
  stage-rules.v1.json          # frozen snapshot of today's 4 rules + their evidence
  stage-rules.v2.json          # the new versioned rule set (machine-readable)
  stage-rules.v1.md            # human-readable v1 (provenance: scripts/harvest-track-a.ts:516-520)
  stage-rules.v2.md            # human-readable v2 (per-rule evidence, from docs/references/CA)
  coverage-v2-vs-v1.md         # the comparison table (committed, no timestamp)
  ambiguous-v2.jsonl           # one row per ambiguous document: both candidates + confidence
scripts/harvest-stage-rules-v2.ts   # the v2 classifier + the reclassify CLI
tests/discovery/harvest-stage-rules-v2.test.ts  # per-rule tests + the table regression
```

- **Why `docs/research/`:** it already exists and holds exactly this kind of committed analysis (`docs/research/canada-rsa-research.md`, `harvest-success-criteria.md`, `harvest-backend-seams.md`).
- **`.gitignore` check:** `git check-ignore -v docs/research/stage-rules/x.md docs/research/foo.json` → **no match (exit 1)** ⇒ **not ignored**. (Contrast `docs/RSA-Documents/**/*.pdf` at `.gitignore:78` and `docs/RSA-Documents/canada/track-a/` at `:76`.) `docs/research/` is tracked today (`git ls-files docs/research` → non-empty).
- **Where v1 lives:** `docs/research/stage-rules/stage-rules.v1.json` — a **frozen copy** of `scripts/harvest-track-a.ts:516-520`, with a pointer back to the source line. v2 is a *sibling file*, never an edit of v1. The harvester keeps importing the **inline v1** it has today (so the committed reports stay byte-identical); the v2 script imports `stage-rules.v2.json`.

### Q4.3 Exact commands

```bash
# 1. freeze v1 (one-off, human-committed)
npx tsx scripts/harvest-stage-rules-v2.ts freeze-v1   # → docs/research/stage-rules/stage-rules.v1.json

# 2. re-fetch the 33-row corpus to a scratch dir (NOT into docs/RSA-Documents)
npx tsx scripts/harvest-stage-rules-v2.ts fetch --manifest docs/RSA-Documents/canada-intake-manifest.jsonl --out .scratch/t62-corpus/

# 3. classify under v1 and v2 and write the comparison table
npx tsx scripts/harvest-stage-rules-v2.ts compare \
    --rules-v1 docs/research/stage-rules/stage-rules.v1.json \
    --rules-v2 docs/research/stage-rules/stage-rules.v2.json \
    --corpus .scratch/t62-corpus/ \
    --manifest docs/RSA-Documents/canada-intake-manifest.jsonl \
    --out docs/research/stage-rules/coverage-v2-vs-v1.md \
    --ambiguous-out docs/research/stage-rules/ambiguous-v2.jsonl
```
Determinism requirements (mirroring the existing reports): **no timestamp** in the output; sha256-verified inputs; byte-reproducible output; a test asserting the committed table equals the freshly generated one (`tests/discovery/harvest-track-a-round2-report.test.ts:99` is the precedent).

**Do NOT write under `docs/RSA-Documents`** — the ticket forbids it, and the committed round-1/round-2 reports must stay valid. `docs/research/stage-rules/` is untracked-by-ignore and outside the forbidden tree.

---

## Q5 — Ambiguity output shape

### Q5.1 The current schema

- `docs/RSA-Documents/corpus-schema.md:10` — "Axes and values (high level)": `stage: PRELIMINARY_DESIGN, DETAILED_DESIGN, FEASIBILITY_CONCEPT` (values drawn from `policies/odd.json` canonical_stages); the file states it "serves as the human contract for the catalog schema".
- `docs/RSA-Documents/corpus-schema.json:14-17` — machine validator: `"stage": {"type":"string","enum":["PRELIMINARY_DESIGN","DETAILED_DESIGN","FEASIBILITY_CONCEPT"]}`.
- The **manifest writer** is `scripts/harvest-track-a.ts:1008-1030` (`const record: IntakeRecord = { ... stage: stage.stage, cell_key: CANONICAL_STAGE[stage.stage] ?? "", ... }`); the `IntakeRecord` interface is `:190-217`; the `stage` field is declared `stage: string` (`:193`) and `cell_key: string` (`:194`); `stage_source?: string` (`:215`).
- The committed manifest holds 33 rows with plain-string `stage`: `MULTI_STAGE` ×13, `FEASIBILITY_CONCEPT` ×10, `UNSTAGED` ×6, `PRELIMINARY_DESIGN` ×3, `PRE_OPENING` ×1 (measured).

### Q5.2 Minimal output shape

**Recommendation: do NOT change `stage`.** Keep `stage: string` and `cell_key: string` exactly as they are, and add a **versioned sidecar**. Rationale: `stage`/`cell_key` are read by 12+ places (Q1.3) and by a JSON-schema `enum`; changing the shape breaks the committed manifest, the byte-identity report tests, and the `docs/RSA-Documents` record — all of which the ticket says must stay valid.

**Sidecar: `docs/research/stage-rules/ambiguous-v2.jsonl`** — one JSON object per manifest row:

```json
{
  "sha256": "2ea94190b6df90060009794589689884d0db779299cc99ee5dcd1e8887c2602e",
  "rule_set_version": "v2",
  "stage_v1": "PRE_OPENING",
  "stage_v2_primary": "EXISTING",
  "candidates": [
    {"stage": "EXISTING", "confidence": 0.72, "rule_ids": ["CA-EXISTING"], "hits": 9},
    {"stage": "PRE_OPENING", "confidence": 0.08, "rule_ids": ["CA-PREOPEN"], "hits": 1},
    {"stage": "DETAILED_DESIGN", "confidence": 0.08, "rule_ids": ["CA-DETAIL"], "hits": 1},
    {"stage": "PRELIMINARY_DESIGN", "confidence": 0.08, "rule_ids": ["CA-PRELIM"], "hits": 1}
  ],
  "ambiguous": true,
  "confidence": 0.72,
  "cell_key_v2": "",
  "matched_text_span": "…post-opening (including existing or in-service facilities)…",
  "text_chars_scanned": 30021
}
```
Field rationale:
- `candidates[]` — "record both candidates" (never force one). Each carries its own `rule_ids` so the decision is auditable back to `stage-rules.v2.json`.
- `confidence` — a single 0..1 number = top candidate's hits ÷ total hits (count-based, deterministic, no model). **[inference — the exact formula is the planner's call.]**
- `stage_v2_primary` — the top candidate, so simple consumers still have a single token.
- `cell_key_v2` — `""` when `ambiguous` is true (a genuinely ambiguous document belongs to no cell until a human picks), otherwise the canonical cell.
- `stage_v1` — kept so the v2-vs-v1 table is derivable from the sidecar alone.
- `matched_text_span` — the verbatim snippet that triggered the rule (the ticket's "read the document body" evidence trail).

### Q5.3 How `MULTI_STAGE` (13 of 33 rows) is treated

`MULTI_STAGE` is v1's collapse of ">1 distinct rule hit" (`scripts/harvest-track-a.ts:541-543`: *"A document naming several stages is not one cell's document."*). Under v2 it becomes **the `ambiguous: true` case**, with the full candidate list retained instead of collapsed. But two sub-cases must be separated:

- **(a) genuinely ambiguous** — the document names two stages of *its own scope* (UNB p142; manifest row 33 "COMBINED STAGE 1 AND 2"). Keep all candidates, `cell_key_v2 = ""`.
- **(b) a multi-stage reference document** — a guideline/manual that *lists* all stages (Alberta, BC, Ontario, UNB, QC — all five of the committed CA reference PDFs land here under v1@full). The document's own stage is not ambiguous; the *listing* is. Under v2 these should get `stage_v2_primary` = the stage the document is *about* (e.g. a guidelines document → `EXISTING`/`CONSTRUCTION`/`METHODOLOGY` — i.e. **no cell**), not a false ambiguity.
  ⇒ **v2 needs a third dimension beyond "candidates": whether the stage words describe the document's own scope or merely enumerate the taxonomy.** **[inference]** The cheapest discriminator is positional: stage words in the title / subject line / first paragraph = the document's own scope; stage words in a table of contents or an equivalency table = taxonomy. The repo already has a precedent for that idea: `scripts/harvest-track-a.ts:586-590` `subjectRegion(text)` extracts the document's own subject region, and `isRsaDocument` (`:598`) uses it to reject "a passing citation of another circular is not a subject".

### Q5.4 Which committed files a schema change would make stale — and why a sidecar avoids it

If `stage` became an object:
- `docs/RSA-Documents/canada-intake-manifest.jsonl` — all 33 rows invalid → **stale**.
- `docs/RSA-Documents/corpus-schema.json:14-17` — the `stage` enum invalid → **must be edited**, but the ticket forbids touching `docs/RSA-Documents`.
- `docs/RSA-Documents/corpus-schema.md` — the human contract → **stale**.
- `docs/RSA-Documents/track-a-harvest-report.md` and `track-a-round2-harvest-report.md` — regenerated by the two report scripts, which index `MANIFEST_STAGE_TO_CELL[m.stage]` (`harvest-track-a-report.ts:25-29`) → **stale**, and their byte-identity tests (`harvest-track-a-report.test.ts:251`, `harvest-track-a-round2-report.test.ts:99`) would fail.
- `docs/RSA-Documents/track-a-coverage.md` — regenerated by `runReport` from `r.cell_key` (`scripts/harvest-track-a.ts:1372-1373`) → **stale**.
- `docs/RSA-Documents/track-a-split.json`, `canadian-download-log.tsv` (`:80-81` TSV header) → **stale**.
- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` (304 rows) and `track-a-ondisk-summary.json` → **stale** if the inventory vocabulary changes too.
- `state/odd-coverage.json` → **NOT stale** (derived from the discovery ledger, `scripts/discovery-coverage.ts:21,50`).

**A versioned sidecar avoids all of it**: the committed v1 manifest and every committed report stay byte-identical, and the v2 view lives in a new file under `docs/research/stage-rules/`.

---

## Q6 — Test surface

### Q6.1 Existing classifier tests

| File | Lines | What it asserts |
|---|---|---|
| `tests/discovery/harvest-track-a.test.ts` | `:68-89` `describe("detectStage")` | `:69-76` "reads the explicit stage from the document text" — `"Stage 1 Road Safety Audit of the functional plan"` → `FEASIBILITY_CONCEPT`; `"Stage 2 Road Safety Audit"` → `PRELIMINARY_DESIGN`; `"Stage 3 Road Safety Audit"` → `DETAILED_DESIGN`; `"Pre-opening Road Safety Audit"` → `PRE_OPENING`. `:78-80` "marks a document that names several stages as multi-stage" — `"covers planning stage and detailed design"` → `MULTI_STAGE`. `:82-84` "keeps a single-stage document in its own cell". `:86-89` "falls back to the source hint when no stage appears". |
| `tests/discovery/harvest-track-a-round2-report.test.ts` | `:108-121` | "maps French stage words to a canonical stage (R32)" — `:109` `"Audit de securite routiere - etude preliminaire"` → `PRELIMINARY_DESIGN`; `:112` `"…rapport detaille"` → `DETAILED_DESIGN`; `:115` `"Audit avant ouverture"` → `PRE_OPENING`; `:116` `"Planification et etude de faisabilite"` → `FEASIBILITY_CONCEPT`; `:120` `"Rapport"` → `UNSTAGED`. Also `:99` the report "regenerates byte-identically from the committed inputs". |
| `tests/discovery/harvest-track-a-report.test.ts` | `:112-142` `describe("stage mapping")` | `:113-120` each inventory stage → its canonical cell; `:121-126` `existing`/`pre-opening`/`unknown` stay unmapped; `:127-137` the manifest stage vocabulary maps and the rest does not; `:138-143` the 13 CA province codes. Plus `:251` "equals the freshly computed report, byte for byte" and `:267` "pins the committed coverage counts". |

### Q6.2 Natural home for the new per-rule tests

**A NEW file: `tests/discovery/harvest-stage-rules-v2.test.ts`.** Reasons:
1. It keeps the v1 tests **untouched**, so the committed reports' byte-identity assertions (`harvest-track-a-report.test.ts:251`, `harvest-track-a-round2-report.test.ts:99`) keep proving that v1 is frozen.
2. The AC is *"a test per new rule, using real titles from the corpus"* — that is a **new** artefact, not an extension of the v1 suite.
3. The v1 tests import `detectStage` from `../../scripts/harvest-track-a` (`harvest-track-a.test.ts:14`) — v2 will live in a different module, so a different file avoids importing both vocabularies into one suite and muddying which contract is under test.

**Per-rule test shape** (one `it()` per rule id from Q2.5), each using a **real corpus title**:
- `CA-DETAIL` — `"Transitway Station Design"` is a bad fixture (it names no stage). Real fixtures available in the committed manifest titles include *"CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project"* (row 13), *"ROAD SAFETY AUDIT STAGE 1: SPRINT SCHEME"* (row 21), *"Bessborough Housing Development Road Safety Audit – Stage 1"* (row 18), *"COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS' RESPONSE"* (row 33), *"A795 Ambridge Bypass"* (rows 15/16), *"WAITEMATA GREENWAYS PRE-OPENING"* (row 9), *"Note Méthodologique : audit de sécurité routière asr"* (row 27), *"MINISTÈRE DES TRANSPORTS ET DE LA MOBILITÉ DURABLE"* (row 26).
- For the corpus bodies (not just titles), the test must **not** depend on the network. Two options: (a) commit a small **fixture** of extracted text snippets under `tests/fixtures/` (the repo already has `tests/fixtures/samples/CA/…` per `.autoforge/execution/work-order-loop6.json`), or (b) test the rule set against **verbatim snippets quoted in the test file** with their `docs/references/CA/<file>.pdf` page cited — this keeps the test offline and byte-stable, and matches the repo's existing style (the report scripts quote evidence inline).

### Q6.3 Ownership / lane risk

`git log --format='%h %ad %an %s' -- tests/discovery/harvest-track-a*.test.ts scripts/harvest-track-a*.ts`:
```
5dcaddb 2026-10-21 Ahmed Kamel Harvest round 2: free, wide search for public Canadian RSAs (#61)
3bd03d5 2026-10-21 Ahmed Kamel Harvest Track A: fetch the public Canadian RSA documents named in the harvesting plan (#58)
```
All the harvest scripts and their tests were last touched by the **same author** in the two most recent merged PRs (#58, #61). There is no other lane holding them. `git branch -a` shows no open branch touching these files. ⇒ **Low collision risk**; a new test file is clean.

**Caveat:** `scripts/harvest-track-a.ts` *is* the shared harvester. If the planner edits `STAGE_RULES` in place, the committed reports change and their byte-identity tests break (see Q4.1). **Do not edit `STAGE_RULES` in place; add a v2 module.**

---

## Q7 — Risks / unknowns

### Q7.1 Acceptance criteria that cannot be met as stated

1. **"Read the document body … so T3 documents reach their cells" — the Transitway document names no stage.** 91 794 chars, zero occurrences of "stage", "design stage", "preliminary", "detailed", "feasibility", "pre-opening". The only handles are the project name "Station Design" and the guideline title "Transitway and Station Design Guidelines". ⇒ **Any rule that moves it into a cell is a guess.** The ticket's own example ("station / corridor / functional design") names **project/asset types, not stages** — and "corridor" and "functional design" appear in **no** committed Canadian reference document as a stage term ("corridor" only in prose). **This needs a human ruling: is it acceptable to classify a document by the *asset type* it audits, or must the document name a stage?** The second reading makes the Transitway document permanently UNSTAGED.
2. **"Re-run the round 1 and round 2 corpora" — the corpora are 48.88 MB of URLs, not of files.** The bodies are not in git and are not on the operator's machine from here; they are re-fetchable (Q3.b proved 9/9 T3 sha256-identical). The ticket's wording implies a re-run of the *harvest*; the honest operation is a **re-classification** of the same 33 documents, and the ticket should say so (the harvest itself did not change).
3. **"Report how many documents move into which cells" — the biggest pool has no cell to move into.** Canadian T3/T4 rows on the operator's disk: `existing` 22, `unknown` 5, `detailed` 1, `pre-opening` 1 (measured from `docs/RSA-Documents/track-a-ondisk-inventory.jsonl`). 22 of 29 are **in-service/existing-roads audits**, and `policies/canada/pack.json:76-83` gives `ca-tac:pre-opening` `canonical_stages: []` — **there is no canonical cell for existing-roads audits**. ⇒ A perfect classifier would still produce **0 new coverage** for those 22 documents. **This is a policy gap, not a classifier gap**, and the ticket says not to touch `policies/`.
4. **MULTI_STAGE inflation.** 13 of 33 committed rows are `MULTI_STAGE` today, mostly T1 documents that *list* the stage taxonomy. Reading the whole body (Q2.2(e)) will **increase** multi-stage hits. If "ambiguous ⇒ no cell", the v2 table can show **fewer** documents in cells than v1 — a coverage **regression**, not a gain. The ticket must state whether an ambiguous document keeps its primary cell.

### Q7.2 Other risks

| Risk | Evidence | Mitigation |
|---|---|---|
| **False positives from prose.** "existing condition", "final design", "functional plan", "planning" are common English words. | My prototype put the Transitway doc in `canada:DETAILED_DESIGN` on the single prose hit "the responsibility for the **final design** … rests with the Owner" (unpdf offset 4023). The repo already warns: *"a bare 'existing' in prose is not a stage"* (`build-ondisk-inventory.py:122`). | Require stage context (e.g. `existing (road|highway|corridor) audit`, `existing conditions audit`), not bare adjectives. Reuse `build-ondisk-inventory.py:123-131`'s deliberately-specific `STAGE_TEXT_PATTERNS`. |
| **Contradiction inside the repo about "functional plan".** | `scripts/harvest-track-a.ts:519` → FEASIBILITY_CONCEPT vs `policies/canada/pack.json:45` → PRELIMINARY_DESIGN. Pinned by `tests/discovery/harvest-track-a.test.ts:70`. | Human ruling (see Q7.3). |
| **Bare "stage N" is unsafe.** `pack.json:96-97`: "Alberta Stage 3 = detailed design while UK Stage 3 = post-construction — bare stage numbers are meaningless across jurisdictions". | `scripts/harvest-track-a.ts:517-519` already matches bare `stage 1/2/3` — an international corpus doc that says "Stage 3" may be UK Stage 3. | Namespace the stage-number rule by jurisdiction token, or drop bare numbers and keep the named forms. |
| **`\b` + French accents.** `d[ée]taill[ée]e?\b` never matched "detailed design"; accented forms need explicit classes. | Proved by node output in Q2.2(a). | Write both spellings explicitly; test each. |
| **Editing `scripts/harvest-track-a.ts` in place breaks the committed reports.** | `harvest-track-a-report.test.ts:251`, `harvest-track-a-round2-report.test.ts:99` assert byte-identity. | Freeze v1 as data (Q4.2); v2 in a new module. |
| **`.autoforge/` new files are git-ignored in this checkout.** | `git check-ignore -v .autoforge/discovery/__tmp_probe.md` → `/home/oc/repos/AuditorAI/.git/info/exclude:7:.autoforge/`. The `.gitignore` negation (`!.autoforge/discovery/**`) cannot re-include files under the excluded `.autoforge/` directory (the classic gitignore parent-directory trap). Existing `.autoforge/discovery/report.md` and `tracker-index.md` are tracked only because they were force-added. | The planner must `git add -f .autoforge/discovery/report-t62.md .autoforge/discovery/tracker-index-t62.md`. **The v2 artefacts should live under `docs/research/` instead** (not ignored). |
| **Network reachability is host-dependent.** | 30/33 URLs 200; `consult.kerrycoco.ie` 403; `www.southampton.gov.uk` connection failed. `curl https://example.com` fails from here (exit 7) while the corpus hosts succeed → an allowlist proxy. | The re-fetch must tolerate per-URL failure and report the 2 dead rows rather than aborting. |

### Q7.3 Cheapest honest fallback

If the classifier work cannot be completed in this session:

1. Ship **`docs/research/stage-rules/stage-rules.v1.json`** (the frozen 4 rules) + **`stage-rules.v2.json`** (the 10 rules from Q2.5) + the **evidence table** (each rule → verbatim quote → `docs/references/CA/<file>.pdf` page). This alone satisfies the *vocabulary* half of the ticket and is reviewable without a single byte of corpus.
2. Ship the **per-rule unit tests** against **verbatim snippets** quoted from the committed CA reference PDFs (offline, no corpus needed) + the **corpus titles** from the manifest as the "real titles from the corpus" fixture.
3. Re-fetch only the **9 T3 documents (12.04 MB)** and produce the coverage v2-vs-v1 table for those, stating explicitly that the 24 T1 rows were not re-fetched (T1 never counts as coverage — `harvest-track-a-report.ts:363`), so the coverage claim is unaffected.
4. Report the Transitway document as **genuinely ambiguous with no stage candidate** (empty candidate list, `confidence: 0`), i.e. "the document names no stage" — rather than inventing a rule to place it. This satisfies "never force a single stage" more honestly than any rule.

### Q7.4 Open questions / needs a human

1. **"Functional Plan"**: FEASIBILITY_CONCEPT (current rule, `harvest-track-a.ts:519`, test-pinned at `harvest-track-a.test.ts:70`) or PRELIMINARY_DESIGN (`policies/canada/pack.json:45`, Alberta guidelines p8)? Or a candidate pair?
2. **"Concept design"** (Good Roads p12/p43): FEASIBILITY_CONCEPT or PRELIMINARY_DESIGN? No committed source settles it.
3. **"Avant-projet préliminaire"** (QC p10/p12): FEASIBILITY_CONCEPT (position: QC's first audit) or PRELIMINARY_DESIGN (literal French)?
4. **Asset-type cues** ("station design", "corridor"): may they classify a document that names no stage? (The ticket's example says yes; the Transitway evidence says the document does not support it.)
5. **Percentage markers** (50% / 75% / 95%): is there a published percentage→stage table? None exists in the committed sources; Alberta uses "before 75% completion" (impl-plan p23) while `pack.json:63-64` uses "~90–95% design".
6. **Do ambiguous documents keep their primary cell?** Decides whether the v2 coverage table gains or loses rows.
7. **Should `EXISTING` / `CONSTRUCTION` become new ODD cells?** They have no canonical cell today (`pack.json:76-83`) and hold 22 of the 29 Canadian T3/T4 on-disk documents. This is a **policy** decision, outside #62's scope but it is the actual coverage bottleneck.
8. **Bare "Stage N"**: keep matching it (current behaviour) or namespace it per jurisdiction, given `pack.json:96-97`?
9. **Is the box re-run expected?** Recommendation: **no** — the corpus is 48.88 MB and `oc-box` can only push `src/`, `tools/`, `tests/`; the classifier lives in `scripts/`. Local re-fetch is strictly simpler.

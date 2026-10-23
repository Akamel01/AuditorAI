# Plan — Ticket #62: versioned stage rule set v2, corpus re-run, v2-vs-v1 coverage table, ambiguity list

- **v2 (amendment, 2026-10-22).** This is an amendment of the v1 plan, not a re-plan. The locked decisions D1–D14 are untouched (the table in §0 is verbatim). The independent plan critique (`.autoforge/reviews/plan-critique-t62.md`, VERDICT `CHANGES_REQUIRED`) raised 14 required changes; each is closed in the module that owns it and marked **[A1]**…**[A14]** below. Its "What the plan got RIGHT" list is a do-not-re-open list and was not re-litigated.
- Ticket: `Akamel01/AuditorAI#62` — "Stage classifier: map real-world RSA titles to ODD stages, so T3 documents reach their cells"
- Parent map: `#41`. Branch/worktree: `oc/62` @ `5dcaddb` ("Harvest round 2: free, wide search for public Canadian RSAs (#61)")
- Inputs: `.autoforge/architecture/report-t62.md`, `.autoforge/requirements/grilling-t62.md` (G2–G6, G9, G10, H1), `.autoforge/reviews/plan-critique-t62.md`, `docs/research/enterprise-gap-audit.md`, `docs/RSA-Documents/track-a-round2-harvest-report.md`, `docs/adr/0002-canonical-stage-model.md`
- Outputs of this plan: `.autoforge/plans/plan-t62.md`, `.autoforge/execution/work-order-t62.json`

## 0. Ground rules (binding, not re-litigated)

**Operator constraints.** `docs/RSA-Documents/**` is byte-frozen — nothing there is created, modified or deleted. The corpus cache lives OUTSIDE it, in `.autoforge/tmp/stage-rules-v2-cache/` (ignored at `.gitignore:57` `.autoforge/*` and `.git/info/exclude:7`). The Postgres tenant store (`TENANT_STORE=postgres`, PR #59) is out of scope and stays off. No box round trip: everything runs in this worktree. `npm ci` is already done. **Download bound [A10]: 25 MB per file, 64 MB total, enforced while streaming** — the corpus is ≤ ~48.9 MB with a largest row of 11 126 108 bytes, so the bound is safe; the operator constraint is "never download large files". The committed reference PDFs already in `docs/references/CA/` are read-only inputs and are never re-downloaded.

**Locked decisions (D1–D14) and where each is implemented.** No design question is reopened by this plan.

| D | decision | implemented in |
|---|---|---|
| D1 | confidence = ADR-0002 enum `authoritative \| interpreted \| inferred` (`docs/adr/0002-canonical-stage-model.md`, decision 3) | M2 `Confidence`, M5 sidecar `confidence` |
| D2 | window = whole extracted text, NFC, cap 1 000 000 chars; record `text_chars_scanned` + `truncated` | M2 `classify`, M5 sidecar |
| D3 | rule sets as JSON: `stage-rules.v1.json` (frozen) + `stage-rules.v2.json`; rule = id/pattern/stage-or-bucket/tier/language/evidence | M1 |
| D4 | pure classifier `scripts/stage-rules.ts` (no I/O) exporting the decision type, rule loader, `classify(text, {title, hint}, ruleSet)` | M2 |
| D5 | ambiguity = versioned sidecar `docs/research/stage-rules/classifications-v2.jsonl`, one row per corpus document (all 33); never a change to `stage`/`cell_key` in the committed manifest | M5 |
| D6 | coverage table = `coverage-v2-vs-v1.md` + machine companion `coverage-v2-vs-v1.json`; Table A = 33 re-classified manifest rows; Table B = merged Canadian+T3 rows reproducing the committed round-2 "after have" (1 / 0 / 1); "moved" = cell-level; md byte-derivable from json | M5 |
| D7 | ambiguity list = `docs/research/stage-rules/ambiguous-v2.md` (human table) | M5 |
| D8 | write-up = `docs/research/stage-rules/README.md` | M6 |
| D9 | corpus = fetch the 33 committed manifest rows into the gitignored cache; sha256-verified; a mismatch is excluded and reported, never silently reclassified; never write the committed manifest (the `intake` path `scripts/harvest-track-a.ts:1245-1256` is forbidden); bypass the known-hash gate (`:274-304`) | M4 |
| D10 | asset cue = `asset_type` metadata only, never a stage, never a cell; the Transitway row stays `UNSTAGED` with `asset_type: "station"` | M1 (`CA-ASSET`), M5, M6 |
| D11 | functional-plan conflict resolved by tiering: Tier-1 named-stage rules win; Tier-2 ambiguity rules fire only when Tier 1 is empty, producing `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}` with confidence `inferred` | M1, M2 |
| D12 | no-cell buckets `EXISTING` / `CONSTRUCTION` = stages with confidence `inferred`, `cell_key ""`; `policies/canada/pack.json` untouched; ODD-matrix gap = follow-up ticket named in the README | M1, M2, M6 |
| D13 | untouched: `scripts/harvest-track-a.ts`, `docs/RSA-Documents/**`, `policies/**`, `src/**`, `state/odd-coverage.json`, and the 3 existing harvest test files | M7 |
| D14 | the new stage tokens (`EXISTING`, `CONSTRUCTION`) appear only in the new sidecar/table; the committed `stage` field keeps its enum (`scripts/harvest-track-a-report.ts:34` `UNMAPPED_STAGES` consumers unaffected) | M5 |

**Why the architecture report's numeric confidence is not used.** `.autoforge/architecture/report-t62.md:158-177` proposes a float confidence and `docs/RSA-Documents/canada/track-a/t62/` as the cache. D1/D9 override both: the enum is repo-native (`docs/adr/0002-canonical-stage-model.md` decision 3) and the cache must sit outside `docs/RSA-Documents/`. The report's module split is otherwise followed.

## 1. Facts this plan is built on (verified)

| fact | value | source |
|---|---|---|
| v1 rules | 4 rules, 4 stages, `PRE_OPENING/DETAILED_DESIGN/PRELIMINARY_DESIGN/FEASIBILITY_CONCEPT`, **all four `/…/i`** | `scripts/harvest-track-a.ts:516-521` |
| v1 cell map | 3 canonical cells, `PRE_OPENING` unmapped | `scripts/harvest-track-a.ts:523-527` |
| v1 window | `text.slice(0, 8000)`; >1 distinct rule ⇒ `MULTI_STAGE`; 0 ⇒ hint | `scripts/harvest-track-a.ts:538-543` |
| v1 defects | `/d[ée]taill[ée]e?\b/i` never matches "detail design"; `/en\s+service/i` matches French "mise en service" ⇒ false `PRE_OPENING` | `scripts/harvest-track-a.ts:517-518`, `.autoforge/requirements/grilling-t62.md` G2/G4 |
| only production call site | `scripts/harvest-track-a.ts:964` — v1 stays exactly as it is | D13 |
| app has no text classifier | operator-selected `native_stage_id` | `src/domain/odd.ts:73-89`, `src/domain/pipeline/nodes/stage-select.ts:40-56` |
| corpus of record | 33 rows, 9 T3 / 24 T1, 12 with `ca_province`, **no body text** | `docs/RSA-Documents/canada-intake-manifest.jsonl` |
| committed manifest stage counts | FEASIBILITY_CONCEPT 10, UNSTAGED 6, **MULTI_STAGE 13**, PRELIMINARY_DESIGN 3, PRE_OPENING 1 | manifest `stage` |
| **Table A** cell occupancy (all 33) | `canada:FEASIBILITY_CONCEPT` 10, `canada:PRELIMINARY_DESIGN` 3, `canada:DETAILED_DESIGN` 0, no cell 20 | manifest `cell_key` |
| **Table A** cell occupancy (T3 only, 9) | FEASIBILITY 3, PRELIMINARY 1, no cell 5 | manifest `cell_key` |
| **Table B** merged corpus | `mergeRows(inventory, manifest)` = **335 rows** (304 inventory + 33 manifest − 2 shared), 156 Canadian, 32 Canadian T3/T4 (22 `existing`, 5 `unknown`, 1 `detailed`, 1 `FEASIBILITY_CONCEPT`, 1 `pre-opening`, 1 `UNSTAGED`, 1 `PRE_OPENING`) | `scripts/harvest-track-a-report.ts:233-298` (imported unmodified) |
| **Table B** coverage candidates | **2** — `a24707c6081a…` (inventory-only, ON, `stage:"detailed"` → `canada:DETAILED_DESIGN`) and `0af7ea584ae0…` (manifest row 1, AB → `canada:FEASIBILITY_CONCEPT`); `canada:PRELIMINARY_DESIGN` 0 ⇒ the committed **after have 1 / 0 / 1** | `coverage_candidate` predicate, `scripts/harvest-track-a-report.ts:255-268,293-299` |
| committed round-2 "after have" | FEASIBILITY 1, PRELIMINARY 0, DETAILED 1 (targets 13 / 41 / 41) | `docs/RSA-Documents/track-a-round2-harvest-report.md:35-38` |
| round-2 table columns | `ODD cell \| target \| priority \| before have \| after have \| before usable (CLEAR) \| after usable (CLEAR) \| gap before \| gap after \| moved` | same |
| licence | 32 `RESTRICTED`, 1 `CLEAR` (`0af7ea58`, Alberta) | manifest `licence_verdict` |
| corpus bodies | gitignored (`.gitignore:75-79`), absent from the worktree; 33 rows, **51 252 032 B ≈ 48.9 MB total, largest row 11 126 108 B** | manifest `bytes` |
| candidate log (committed) | both hosts the plan previously called "dead" are **HTTP 200 / `ingested`** (`consult.kerrycoco.ie` 200 4 028 187; `www.southampton.gov.uk` 200 27 414); 32 of 33 manifest shas appear in the log, **all HTTP 200, all `ingested`** (the 33rd is a round-1 row) | `docs/RSA-Documents/track-a-round2-candidate-log.tsv` **[A13]** |
| evidence shelf | 7 committed OPEN-LICENCE Canadian reference PDFs | `docs/references/CA/MANIFEST.md` |
| PDF text extraction | `unpdf` already a dependency (pure JS) | `scripts/harvest-track-a.ts:19,924`; `package.json:31` |
| politeness rules | robots gate + ≤1 req/s/host, ≤2 concurrent/host | `src/discovery/robots.ts`, `src/discovery/ratelimit.ts`, `scripts/harvest-track-a.ts:762-788` |
| motivating doc | sha `0d9a76ff…`, "Transitway Station Design", ON, T3 — **names no stage word in 91 794 chars** | manifest row 7 |
| UNB paper | sha `2ea94190…`, NB, T3 — feasibility@5596, preliminary@5627, detail@5655, pre-opening@5670 | manifest row 23 |
| byte-identity guards | `tests/discovery/harvest-track-a-report.test.ts:251`, `tests/discovery/harvest-track-a-round2-report.test.ts:99` | D13 |

**Measured attestation of the committed reference PDFs (NFC-normalised extracted text, `unpdf`, measured in this worktree 2026-10-22) [A7][A9].** This table is the *only* source of truth for what a rule's evidence phrase may cite. A phrase that is not in this table is not attested in the committed reference set.

| reference PDF (size) | attested stage phrases (measured) |
|---|---|
| `alberta-transportation-rsa-guidelines-2004.pdf` (83 KB — **small**) | `planning stage`, `stage 1`, `stage 2`, `stage 3`, `preliminary design`, `detailed design`, `pre-opening`, `existing road`, `construction stage`, `functional plan`, `functional planning`, `in-service road safety audit`, `90%-100% Design Audit`, and the ladder sentence `before 75% completion of the project and is the equivalent of the 90% to 95% stage of the design` |
| `alberta-transportation-rsa-implementation-plan-2004.pdf` (152 KB — **small**) | `planning stage`, `stage 1/2/3`, `preliminary design`, `detailed design`, `pre-opening`, `in service`, `existing road`, `existing corridor`, `construction stage`, `functional plan`, `functional planning`, `in-service road safety audit`, `90%-100% Design Audit`, `75% completion` |
| `bct-moti-rsa-guidelines-tc-t02-04c-2004.pdf` (167 KB — **small**) | `planning stage`, `preliminary design`, `detailed design`, `pre-opening`, `existing road`, `during construction` |
| `bct-moti-rsa-policy-tc-t02-04-2004.pdf` (22 KB — **small**) | *no stage phrase* — it is the RSA **policy** circular (its extracted text is "Technical Circular T-02/04 … ROAD SAFETY AUDIT (RSA) POLICY … PURPOSE …"). It may not be cited as stage evidence. |
| `ontario-good-roads-rsa-guideline-2023.pdf` (8.7 MB — **slow**) | `planning stage`, `feasibility stage`, `stage 1`, `preliminary design`, `detailed design`, `pre-opening`, `post-opening`, `in service`, `already in service`, `existing road`, `concept design` |
| `qc-mtq-guide-audits-securite-routiere-2012.pdf` (5.5 MB — **slow**) | `après ouverture`, `plans et devis préliminaires`, `plans et devis définitifs`, `avant-projet préliminaire`, `avant-projet définitif`, `des travaux`, `travaux`, `mise en service`, `planification`, `avant son ouverture` (`… avant son ouverture à la circulation …`); `exploitation` occurs **only** as `Dossier de transfert à l'exploitation` |
| `unb-transportation-group-rsa-guidelines.pdf` (3.5 MB — **slow**) | `stage 1/2/3`, `feasibility stage`, `preliminary design`, `draft design`, `detailed design`, `pre-opening`, `post-opening`, `post opening`, `in service`, `in-service`, `already in service`, `existing road`, `existing highway`, `during construction`, `construction stage` |

**Measured non-attestation [A8][A9].** `detail design`, `avant l'ouverture`, `conception préliminaire`, `conception détaillée`, `en exploitation`, `audit de sécurité routière en exploitation` have **0 hits in all 7 committed reference PDFs**. They may still appear in a rule's *pattern* (the pattern is the rule's intent), but they may **not** be cited as attested evidence in a reference PDF. The three ticket terms are attested **nowhere** in the committed set → their evidence is the ticket + a fetch-time corpus attestation (M4/M5) or, if the corpus does not attest them either, an explicit "unattested" entry in the README (M6).

**Licence constraint (binding).** 8 of the 9 T3 corpus rows are `RESTRICTED` (Crown copyright). Therefore **no corpus body text is committed**. Committed artefacts carry only rule patterns, short verbatim TERM quotes (≤ ~10 words — house style, `docs/references/CA/MANIFEST.md`), and source references (corpus `sha256` + url, or reference-PDF name). This is why the per-rule tests read the **committed open-licence reference PDFs at test time** (they are public documents already in the repo) rather than a corpus body fixture — **[A7]** the reference-PDF extraction test replaces the old "feed the rule its own `evidence.phrase`" tautology.

## 2. Module table

| M | purpose | touches (globs) | blocked_by | key command |
|---|---|---|---|---|
| M1 | rule sets v1 + v2 with evidence, flags, scope, attestation | `docs/research/stage-rules/stage-rules.v1.json`, `docs/research/stage-rules/stage-rules.v2.json` | — | `node -e "…JSON.parse + schema check…"` **[A14]** |
| M2 | pure classifier + unit/per-rule tests | `scripts/stage-rules.ts`, `tests/discovery/stage-rules.test.ts` | M1 | `npx vitest run tests/discovery/stage-rules.test.ts` |
| M3 | CLI `selftest` / `fetch` / `compare` / `render` | `scripts/harvest-stage-rules-v2.ts` | M2 | `npx tsx scripts/harvest-stage-rules-v2.ts compare --cache <empty>` |
| M4 | corpus fetch + sha256 verify + text extraction (gitignored cache only) | `.autoforge/tmp/stage-rules-v2-cache/**` | M3 | `npx tsx scripts/harvest-stage-rules-v2.ts fetch` + `git status --porcelain` |
| M5 | sidecar + coverage md/json + ambiguity list + artefact tests | `docs/research/stage-rules/classifications-v2.jsonl`, `docs/research/stage-rules/coverage-v2-vs-v1.md`, `docs/research/stage-rules/coverage-v2-vs-v1.json`, `docs/research/stage-rules/ambiguous-v2.md`, `tests/discovery/stage-rules-artifacts.test.ts` | M1, M3, M4 | `npx tsx scripts/harvest-stage-rules-v2.ts compare` + `render` byte-check |
| M6 | write-up (the ticket's answer) | `docs/research/stage-rules/README.md` | M5 | `grep` the required statements |
| M7 | verification (suite, lint, typecheck, byte-identity, clean tree) | *(no writes — read-only checks)* | M1–M6 | `npm run lint && npm run typecheck && npx vitest run …` |

**Adjustment to the operator's split, stated once:** the architect's M6 (human write-up) becomes **M6**, and the operator's M6 (verification) becomes **M7**. The architect's `docs/research/stage-rules/stage-rules.evidence.md` is dropped — D3 puts the evidence inside the rule JSON, and the README carries the provenance prose (one less file, one less thing to drift).

**Test-file split [A1].** Two files, two owners:

| file | owner | content | count |
|---|---|---|---|
| `tests/discovery/stage-rules.test.ts` | M2 | 17 per-rule tests + v1 freeze (source/flags + cells) + v1 behavioural equality vs the live `detectStage` + 4 classifier unit tests + 4 negative prose traps | **28** |
| `tests/discovery/stage-rules-artifacts.test.ts` | M5 | md == render(json) + sidecar row shape + non-vacuous v1 reproduction (live `detectStage`) + ambiguity list shape + committed-report byte identity | **5** |

**Why the touches are disjoint:** M1 owns `stage-rules.v*.json`; M5 owns `coverage-*`/`classifications-*`/`ambiguous-*` **and the artefact test file**; M6 owns `README.md`; M2 owns `scripts/stage-rules.ts` **and `tests/discovery/stage-rules.test.ts` only**; M3 owns the CLI; M4 owns the gitignored cache. No two modules write the same file. The only shared *read* artefacts are the two rule files (M1 → M2/M3/M5) and the cache dir (M4 → M5), both expressed as `blocked_by` edges.

## 3. Module task lists

### M1 — rule sets (blocked_by: none)

**M1.1** Create `docs/research/stage-rules/stage-rules.v1.json` — a frozen, behaviourally identical transcription of `scripts/harvest-track-a.ts:516-527`. Envelope: `rule_set_version: "v1"`, `frozen: true`, `provenance.source: "scripts/harvest-track-a.ts:516-527"`, `scan: { mode: "head", chars: 8000 }` (v1's window — required for the freeze, `scripts/harvest-track-a.ts:538`), `cells` = **byte-equal copy of `CANONICAL_STAGE` (`:523-527`, exactly 3 keys)**, and the 4 rules with their regex sources **and their flags** verbatim (`:517-520` — all four are `/…/i`), `tier: 1`, `language: "en"`, `stage` as in v1, `scope: "text"` (v1 scans the body head only), and `evidence` = the source line reference.

- **`PRE_OPENING` is NOT a key of `cells`.** It resolves through the "unknown stage → no cell" rule (`cell_key: ""`), which is the only way to reconcile v1's cell map with `CANONICAL_STAGE`'s 3 keys. **[A5]**
- Proof: `node -e "const j=require('./docs/research/stage-rules/stage-rules.v1.json'); console.log(j.rules.length, j.rules.map(r=>r.flags).join(','))"` ⇒ `4 i,i,i,i`.
- Acceptance **[A5]**: `cells` deep-equals `CANONICAL_STAGE` restricted to its 3 mapped keys (byte-equal, 3 keys, no extra key); the 4 `{source, flags}` pairs are **parsed out of `scripts/harvest-track-a.ts:517-520` at test time** by the M2 v1-freeze test and compared to the JSON — not eyeballed.

**M1.2** Create `docs/research/stage-rules/stage-rules.v2.json` — envelope `rule_set_version: "v2"`, `frozen: false`, `scan: { mode: "whole", chars: 1000000, normalize: "NFC" }` (D2), `cells` = the 3 canonical cells + `""` for `PRE_OPENING`, `EXISTING`, `CONSTRUCTION` (D12/D14).

**Rule schema (v2) — extended [A2][A9]:**

```ts
export type RuleScope = "text" | "title" | "any";
export interface RuleEvidence {
  phrase: string;             // short verbatim TERM quote (<= ~10 words)
  corpus_sha256?: string;     // a corpus row's sha256 (body evidence)
  reference_doc?: string;     // docs/references/CA/<file>.pdf
  reference_page?: number;    // OPTIONAL — attestation is page-agnostic
  kind: "reference-doc" | "corpus" | "ticket-declared";
  attested: boolean;          // measured true/false — never assumed
  note?: string;
}
export interface StageRule {
  id: string;
  pattern: string;            // regex source, no delimiters
  flags: string;              // default "i"; recorded explicitly in every rule
  scope: RuleScope;           // which region the rule may match
  tier: 1 | 2;
  language: "en" | "fr";
  stage?: CanonicalStage;     // tier 1
  candidates?: CanonicalStage[]; // tier 2: exactly 2
  asset_type?: string;        // CA-ASSET: records asset_type, never a stage/cell
  confidence_form: "named" | "derived";
  evidence: RuleEvidence[];
}
```

**Rules — 17 in total [A8][A9].** `flags` is `"i"` for all 17 (recorded explicitly). `scope` selects the scan region (see M2.2). The **attested evidence** column names the exact phrase and the doc it was measured in; `corpus` evidence names the sha and is attested **at fetch time** (M4) and recorded in the sidecar + `coverage-v2-vs-v1.json.rule_attestations`.

| id | tier | lang | scope | outcome | fires on (pattern intent) | attested evidence (measured) |
|---|---|---|---|---|---|---|
| `CA-FEAS` | 1 | en | any | `FEASIBILITY_CONCEPT` → `canada:FEASIBILITY_CONCEPT` | `planning stage`, `feasibility stage\|study`, `stage 1`/`stage one`, `étude de faisabilité`, `planification` | `planning stage` — AB guidelines (small) **and** impl-plan, BCT guidelines, ON; also corpus title row 1 `0af7ea584ae0…` "PLANNING STAGE" and row 19 `ed2c0d694461…` "Stage 1 Road Safety Audit" |
| `CA-PRELIM` | 1 | en | any | `PRELIMINARY_DESIGN` → `canada:PRELIMINARY_DESIGN` | `preliminary design\|stage`, `draft design`, `stage 2`/`stage two`, `plans et devis préliminaires` | `preliminary design` — AB guidelines (small), impl-plan, BCT guidelines, ON, UNB |
| `CA-DETAIL` | 1 | en | any | `DETAILED_DESIGN` → `canada:DETAILED_DESIGN` | `detailed design`, **`detail design`** (the v1 miss), `stage 3`/`stage three`, `plans et devis définitifs` | `detailed design` — AB guidelines (small), impl-plan, BCT guidelines, ON, UNB; the `detail design` form: **corpus** sha `2ea94190b6df…` (UNB paper) — attested at fetch time, `attested` flips to true only if the fetched body contains it |
| `CA-PREOPEN` | 1 | en | any | `PRE_OPENING` → `""` (no cell) | `pre-?opening`, `avant (son \|l['’])ouverture` | `pre-opening` — AB guidelines (small), impl-plan, BCT guidelines, ON, UNB; `avant son ouverture` — QC guide (slow); also corpus title row 9 `babe092a5473…` "WAITEMATA GREENWAYS PRE-OPENING" |
| `CA-EXISTING` | 1 | en | any | `EXISTING` → `""` (no cell, D12) | `in-?service (road\|highway\|corridor\|facilit\|review\|audit)`, `existing (road\|highway\|corridor\|facilit)`, `post-?opening`, `already in service` | `existing road` — AB guidelines (small), impl-plan, BCT guidelines, ON; `already in service` — ON (slow); `post-opening` — ON (slow) |
| `CA-CONSTR` | 1 | en | any | `CONSTRUCTION` → `""` (no cell, D12) | `construction (phase\|stage)`, `during construction`, `des travaux`, `travaux` | `construction stage` — AB guidelines (small), impl-plan; `during construction` — BCT guidelines (small); `des travaux` — QC guide (slow) |
| `CA-PRELIM-FR` | 1 | fr | text | `PRELIMINARY_DESIGN` → `canada:PRELIMINARY_DESIGN` | `avant-projet préliminaire`, `plans et devis préliminaires` | `avant-projet préliminaire` — QC guide (slow); `plans et devis préliminaires` — QC guide (slow) |
| `CA-DETAIL-FR` | 1 | fr | text | `DETAILED_DESIGN` → `canada:DETAILED_DESIGN` | `plans et devis définitifs`, `avant-projet définitif` | `plans et devis définitifs` — QC guide (slow); `avant-projet définitif` — QC guide (slow) |
| `CA-PCT-DETAIL` | 1 | en | any | `DETAILED_DESIGN` → `canada:DETAILED_DESIGN` | `(?:9\d\|100)\s*%` followed within 60 chars by a design noun — the ticket's **90 %** rung | `90% to 95% stage of the design` — AB guidelines (small), impl-plan (`90%-100% Design Audit`) |
| `CA-AMBIG-FUNCPLAN` | 2 | en | any | pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`, `inferred` (D11) | `functional plan(ning)` | `functional plan` — AB guidelines (small), impl-plan |
| `CA-AMBIG-CONCEPT` | 2 | en | any | pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}` | `concept (design\|stage)` | `concept design` — ON guideline (slow) |
| `CA-AMBIG-AVP` | 2 | fr | any | pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}` | `avant-projet préliminaire` | `avant-projet préliminaire` — QC guide (slow) |
| `CA-AMBIG-PCT` | 2 | en | any | pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}` | `NN%` followed within 60 chars by a design noun — the ticket's **30 % / 60 %** rungs (tier 2 ⇒ no cell, `inferred`) | `before 75% completion of the project and is the equivalent of the 90% to 95% stage of the design` — AB guidelines (small) |
| `CA-PRELIM-TICKET` | 1 | fr | text | `PRELIMINARY_DESIGN` → `canada:PRELIMINARY_DESIGN` | `conception préliminaire` — **the ticket's own term**, shipped as an accepted alias of `avant-projet préliminaire` | `kind:"ticket-declared"`, `attested:false` — 0 hits in all 7 reference PDFs; corpus attestation at fetch time (row 26 `1530d327c4c3…`, French) |
| `CA-DETAIL-TICKET` | 1 | fr | text | `DETAILED_DESIGN` → `canada:DETAILED_DESIGN` | `conception détaillée` — **the ticket's own term**, alias of `avant-projet définitif` | `kind:"ticket-declared"`, `attested:false` — 0 hits in all 7 reference PDFs |
| `CA-EXISTING-TICKET` | 1 | fr | text | `EXISTING` → `""` (no cell) | `audit de sécurité routière en exploitation` (and the alias `en exploitation`) — **the ticket's own term**, near-miss of the real MTQ term `Évaluation à l'exploitation` | `kind:"ticket-declared"`, `attested:false` — 0 hits in all 7 reference PDFs; `exploitation` occurs in QC only as `Dossier de transfert à l'exploitation` |
| `CA-ASSET` | 1 | en | **title** | **no stage, no cell** — records `asset_type` only (D10) | `station design`, `station`, `corridor`, `functional design` | corpus **title** row 7 `0d9a76ff4e71…` "Transitway Station Design" (title-scoped, no body needed) |

**The percentage ladder, stated once [A8].** The ticket's 30 % / 60 % / 90 % design ladder is implemented by **two** rules: `CA-PCT-DETAIL` (tier 1) fires on a 90 %/100 % design-percentage marker ⇒ `DETAILED_DESIGN`, on the measured authority of the AB guideline sentence *"before 75% completion of the project and is the equivalent of the 90% to 95% stage of the design"*; `CA-AMBIG-PCT` (tier 2) fires on any other percentage marker near a design noun ⇒ the contested pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}` with `inferred` confidence and **no cell** — this is where the 30 % and 60 % rungs land. D11 (tier 1 wins) means 90 % always resolves to `DETAILED_DESIGN` and 30 %/60 % never force a stage. The 30/60/90 numbers are the **ticket's declared intent**, recorded in the rule's `evidence[].note`; the corpus uses 50 % / 75 % / 95 %, so the rule's pattern is `NN%`, not a hard-coded 30/60.

**The ticket's French terms, stated once [A8].** `conception préliminaire`, `conception détaillée` and `audit de sécurité routière en exploitation` ship as tier-1 rules (`CA-PRELIM-TICKET`, `CA-DETAIL-TICKET`, `CA-EXISTING-TICKET`) so the ticket's vocabulary is honoured literally, but their evidence is `kind:"ticket-declared"`, `attested:false`. The real MTQ vocabulary is already covered by `CA-PRELIM-FR` / `CA-DETAIL-FR` / `CA-EXISTING`. If the fetch-time corpus attestation also fails, the README lists each such rule under **"declared by ticket #62, unattested in the committed corpus at the time of writing"** — no attestation is ever claimed that was not measured.

- Proof: `node -e "for (const f of ['v1','v2']) JSON.parse(require('fs').readFileSync('docs/research/stage-rules/stage-rules.'+f+'.json'))"`; `node -e "…schema check: 4 v1 rules with flags, 17 v2 rules each with flags+scope+≥1 evidence+attested flag…"`.
- Acceptance: unique ids; every rule has `flags` and `scope`; every rule has ≥1 `evidence` entry; every `evidence.reference_doc` exists under `docs/references/CA/` **and its `phrase` occurs in that document's extracted text** (checked by the M2 reference-PDF test); every `evidence.corpus_sha256` is a sha present in the committed manifest; every `evidence.phrase` ≤ 10 words; no rule pattern matches the v1 French false positive `mise en service`; `CA-ASSET` has no `stage` and no `cell`.

**M1.3** Rule-set self-check (implemented in M2's module, no extra file): the loader rejects duplicate ids, a rule without evidence, an empty `candidates` array, a tier-2 rule with ≠2 candidates, and a `CA-ASSET`-shaped rule carrying a stage.

### M2 — pure classifier + tests (blocked_by: M1)

**M2.1** Create `scripts/stage-rules.ts` — **pure: no `fs`, no `fetch`, no I/O inside `classify` and `loadRuleSet`** **[A14]**. The loader is a *pure validator*: `loadRuleSet(json: unknown): RuleSet` takes an already-parsed JSON value; reading the file from disk is the caller's job (M3's CLI). The module may import nothing from `node:fs`. Exact exported types:

```ts
export type Confidence = "authoritative" | "interpreted" | "inferred";
export type CanonicalStage =
  | "FEASIBILITY_CONCEPT" | "PRELIMINARY_DESIGN" | "DETAILED_DESIGN"
  | "PRE_OPENING" | "EXISTING" | "CONSTRUCTION";
export type StageToken = CanonicalStage | "MULTI_STAGE";   // MULTI_STAGE is a v1-only token
export type RuleTier = 1 | 2;
export type RuleLanguage = "en" | "fr";
export type RuleScope = "text" | "title" | "any";
export type EvidenceScope = "body" | "title" | "hint";
export type DecisionSource = "text" | "title" | "hint";
export type StageOrUnstaged = StageToken | "UNSTAGED";

export interface StageCandidate {
  stage: StageToken;
  cell_key: string;
  confidence: Confidence;
  rule_ids: string[];
  evidence_scope: EvidenceScope;
  matched_phrase: string;   // the rule's evidence phrase (<= 10 words)
  offset: number;           // char offset of the match inside its region; -1 for hint
}
export interface StageDecision {
  rule_set_version: string;
  stage: StageOrUnstaged;
  cell_key: string;
  confidence: Confidence | null;   // null when no candidate (D1)
  ambiguous: boolean;               // candidates.length >= 2
  candidates: StageCandidate[];     // ordered best-first, never truncated, never collapsed
  asset_type: string | null;
  scope_basis: "own_scope" | "taxonomy_reference";
  text_chars_scanned: number;
  truncated: boolean;
  source: DecisionSource;
  body_available: boolean;
}
export function loadRuleSet(json: unknown): RuleSet;
export function classify(text: string, ctx: { title: string; hint: string }, ruleSet: RuleSet): StageDecision;
```

**`MULTI_STAGE` is in the stage union [A3]** because v1 returns it (`scripts/harvest-track-a.ts:541`) and **13 of the 33 committed manifest rows carry it**. It is a pre-existing committed token, not a new one — D14 is unaffected (D14 concerns the new tokens `EXISTING`/`CONSTRUCTION`).

**M2.2 `classify` algorithm (deterministic, total).** **The v2 scan input, stated once and unambiguously [A2]:**

> **Regions.** Region **B** (body) = `bodyText.normalize("NFC").slice(0, 1_000_000)`; `truncated = bodyText.length > 1_000_000`; `text_chars_scanned = B.length`. Region **T** (title) = `title.normalize("NFC")`. Region **B** is empty when no body is available.
> **Scanning.** B and T are scanned **independently**. A rule's `scope` selects the regions it may match: `scope:"text"` ⇒ **B only**; `scope:"title"` ⇒ **T only**; `scope:"any"` ⇒ **B and T**.
> **Provenance.** Every match records `evidence_scope` (`"body"` for a B match, `"title"` for a T match) and `offset` (the char offset **inside that region**; `-1` for a hint). A `scope:"any"` rule that matches in *both* regions contributes the stage **once**, and the **title** match wins (`evidence_scope:"title"`, offset in T) — the title is the document's own name and the stronger signal.
> **Source.** `source` = `"text"` when the deciding candidate came from B; `"title"` when it came from T (which includes every title-only row); `"hint"` when there is no candidate at all and the hint was used.
> **Title-only rows.** A row with no body (`body_available:false`, B = "") can only be decided by `scope:"title"` and `scope:"any"` rules, and its sidecar row records `body_available:false` and `source:"title"`. **It is never counted as if it had body evidence** — the md marks it as title-only and the ambiguity/coverage counts treat it as a title-only row.

1. v1 path (frozen semantics, used only to lock the baseline): the scanned input is **B only**, `B.slice(0, 8000)`; `>1` distinct rule stage ⇒ `stage: "MULTI_STAGE"`, `cell_key: ""`; `1` ⇒ that stage; `0` ⇒ the hint, `source: "hint"`, `confidence: null`.
2. v2 path: run **Tier-1** rules over the regions their `scope` permits. Each rule hit contributes its stage; hits are grouped by stage into candidates (a stage matched by several rules carries all their `rule_ids`).
3. If Tier 1 produced **zero** stages, run **Tier-2** rules ⇒ one candidate per stage in the pair, each `confidence: "inferred"` (D11). If Tier 1 produced ≥1 stage, Tier 2 is not consulted (D11) — and the asset rule never yields a stage.
4. Per-candidate confidence (D1): `candidates.length >= 2` ⇒ `inferred`; else `authoritative` when the single candidate's rule has `confidence_form: "named"` **and** the stage has a canonical cell; `interpreted` when `confidence_form: "derived"` (bare `Stage 2`, a derived French synonym); `inferred` when the stage is a no-cell bucket (`PRE_OPENING`, `EXISTING`, `CONSTRUCTION`, D12) or the record is asset-only.
5. Document confidence = the **weakest** candidate's confidence; `null` when there is no candidate (D1).
6. `ambiguous` = `candidates.length >= 2`; `cell_key` = `""` when ambiguous (no Canadian multi-stage cell, D12/D14), else the candidate's cell.
7. `asset_type` is set only by `CA-ASSET` (D10) and never affects stage/cell.
8. `scope_basis`: `taxonomy_reference` when the document enumerates the stage taxonomy (≥3 distinct stage candidates **and** zero hits in the document's own subject/title region) else `own_scope`. The subject region = the `SUBJECT`/`TITLE`/`RE` line if present, else the first 600 chars — the same rule as `subjectRegion()` (`scripts/harvest-track-a.ts:586-590`), re-implemented in the pure module (the harvester is not imported).
9. Tie-break for candidate order: tier asc, then rule declaration order, then stage name ASCII. No floats, no model, no randomness.

**M2.3** Create `tests/discovery/stage-rules.test.ts` — **28 tests** **[A1]**. No artefact is read and no M3 module is imported by this file.

**Group 1 — per-rule tests (17 `it()`s, one per rule id).** Every rule test asserts three things: (i) the rule's pattern compiles with its recorded `flags` and matches its **committed attested phrase**; (ii) the phrase **occurs in the cited document's extracted text** (the committed open-licence reference PDF, extracted at test time with `unpdf`, NFC-normalised) or, for a corpus-sourced rule, in the **fetch-time attestation** recorded in the sidecar; (iii) `classify` returns the expected stage/confidence/cell for that phrase. This replaces the old tautology (feeding the rule its own `evidence.phrase` and asserting the rule id) — the phrase must now be found in a **real document**. **[A7][A9]**

| # | rule | attested source used by the test | assertion |
|---|---|---|---|
| 1 | `CA-FEAS` | corpus title row 1 `0af7ea584ae0…` "PLANNING STAGE" **and** AB guidelines `planning stage` | title match ⇒ `FEASIBILITY_CONCEPT`, `authoritative`, `canada:FEASIBILITY_CONCEPT`, `evidence_scope:"title"` |
| 2 | `CA-FEAS` | corpus title row 19 `ed2c0d694461…` "Stage 1 Road Safety Audit" | `interpreted` (bare `Stage 1`) |
| 3 | `CA-PRELIM` | AB guidelines `preliminary design` (small PDF) | `PRELIMINARY_DESIGN`, `canada:PRELIMINARY_DESIGN` |
| 4 | `CA-DETAIL` | AB guidelines `detailed design` (small PDF) | `DETAILED_DESIGN`, `canada:DETAILED_DESIGN` |
| 5 | `CA-DETAIL` | corpus title row 13 `2b3115c3438b…` "…Stage 3 Road Safety Audit…" | bare `Stage 3` ⇒ `interpreted` |
| 6 | `CA-PREOPEN` | corpus title row 9 `babe092a5473…` "WAITEMETA GREENWAYS PRE-OPENING" | `PRE_OPENING`, `cell_key ""`, `inferred` |
| 7 | `CA-EXISTING` | AB guidelines `existing road` (small PDF) | `EXISTING`, `cell_key ""`, `inferred` |
| 8 | `CA-CONSTR` | AB guidelines `construction stage` + BCT guidelines `during construction` (both small) | `CONSTRUCTION`, `cell_key ""`, `inferred` |
| 9 | `CA-PRELIM-FR` | QC guide `avant-projet préliminaire` + `plans et devis préliminaires` (**slow** PDF) | `PRELIMINARY_DESIGN` |
| 10 | `CA-DETAIL-FR` | QC guide `plans et devis définitifs` + `avant-projet définitif` (**slow** PDF) | `DETAILED_DESIGN` |
| 11 | `CA-PCT-DETAIL` | AB guidelines `90% to 95% stage of the design` (small PDF) | `DETAILED_DESIGN` (tier 1 wins over tier 2) |
| 12 | `CA-AMBIG-FUNCPLAN` | AB guidelines `functional plan` (small PDF) | tier-2 pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`, `inferred`, `cell_key ""`; with a tier-1 phrase present, tier 1 wins |
| 13 | `CA-AMBIG-CONCEPT` | ON guideline `concept design` (**slow** PDF) | tier-2 pair, no cell |
| 14 | `CA-AMBIG-AVP` | QC guide `avant-projet préliminaire` (**slow** PDF) | tier-2 pair, no cell |
| 15 | `CA-AMBIG-PCT` | AB guidelines `before 75% completion of the project and is the equivalent of the 90% to 95% stage of the design` (small PDF) | tier-2 pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}` for the 75 % marker (tier 1 does not fire on 75 %) |
| 16 | `CA-PRELIM-TICKET` | **ticket #62 bullet 1** — no reference PDF attests it | the rule matches `conception préliminaire`; the test asserts the rule's evidence entry is `kind:"ticket-declared"` and `attested:false` — it asserts the **honesty flag**, not an attestation |
| 17 | `CA-DETAIL-TICKET`, `CA-EXISTING-TICKET`, `CA-ASSET` | ticket / corpus title row 7 `0d9a76ff4e71…` "Transitway Station Design" | `CA-DETAIL-TICKET` matches `conception détaillée` with `attested:false`; `CA-EXISTING-TICKET` matches `audit de sécurité routière en exploitation` with `attested:false`; `CA-ASSET` ⇒ `stage:"UNSTAGED"`, `asset_type:"station"`, `candidates:[]`, `cell_key:""` (D10) |

> **Test-count discipline [A1]:** the three ticket-declared rules and `CA-ASSET` share one `it()` (test 17) because their assertion is the same shape (an unattested-but-declared rule, or an asset-only rule). **Every rule id has at least one dedicated assertion** — 17 rules, 17 rule-focused `it()`s.

**Group 2 — v1 freeze (2 `it()`s) [A5].**
- **Test 18 — source & flags equality, proven mechanically.** The test **parses the four `/…/i` regex literals out of `scripts/harvest-track-a.ts:517-520` at test time** (read the file, match the literal regexes), builds `{source, flags}` for each, and compares them to `stage-rules.v1.json`'s four rules *in order*. The test fails if the source file's literals change, if the JSON's `flags` differ from the parsed flags (the default `"i"` bug the old schema had), or if the JSON's sources differ. It also asserts the v1 rule set has exactly 4 rules and `tier: 1`.
- **Test 19 — cells.** `stage-rules.v1.json.cells` is **byte-equal to `CANONICAL_STAGE`** imported from `scripts/harvest-track-a.ts` (3 keys: `FEASIBILITY_CONCEPT`, `PRELIMINARY_DESIGN`, `DETAILED_DESIGN`) — no `PRE_OPENING` key, no extra key, same key order and same values; and `MANIFEST_STAGE_TO_CELL` (`scripts/harvest-track-a-report.ts:24-29`) restricted to its 3 mapped keys equals it.

**Group 3 — v1 behavioural equality (1 `it()`).**
- **Test 20.** For the 33 committed manifest titles **and** the literals at `tests/discovery/harvest-track-a.test.ts:69-79` and `tests/discovery/harvest-track-a-round2-report.test.ts:108-119` (both verified to exist): `classify(text, {title, hint}, v1).stage === detectStage(text, hint)` where `detectStage` is imported **live** from `scripts/harvest-track-a.ts`. The input set covers single-stage, multi-stage (`covers planning stage and detailed design` ⇒ `MULTI_STAGE`), French (`etude preliminaire` ⇒ PRELIMINARY, `rapport detaille` ⇒ DETAILED, `Audit avant ouverture` ⇒ PRE_OPENING, `Planification et etude de faisabilite` ⇒ FEASIBILITY), the hint fallback (`Rapport` + hint `UNSTAGED` ⇒ `UNSTAGED`), **and one case where two rules of the *same* stage fire** (the live code collapses distinct **stages**, not distinct rules — `const distinct = [...new Set(hits)]`, `scripts/harvest-track-a.ts:541` — so the frozen v1 must not collapse per rule).

**Group 4 — classifier unit tests (4 `it()`s).**
- **Test 21 — no candidate.** `classify("", {title:"", hint:"UNSTAGED"}, v2)` ⇒ `stage:"UNSTAGED"`, `confidence:null`, `candidates:[]`, `cell_key:""`, `source:"hint"`.
- **Test 22 — ambiguity.** A two-stage input ⇒ `ambiguous:true`, `candidates.length>=2`, `confidence:"inferred"`, `cell_key:""`.
- **Test 23 — no-cell buckets.** `EXISTING` and `CONSTRUCTION` ⇒ `cell_key:""`, `confidence:"inferred"`.
- **Test 24 — asset-only.** `CA-ASSET` alone ⇒ `stage:"UNSTAGED"`, `asset_type` set, `candidates:[]`, `cell_key:""`, and the asset cue **never** changes a stage.

**Group 5 — negative prose traps (4 `it()`s).**
- **Test 25** "the responsibility for the final design rests with the Owner" ⇒ no `DETAILED_DESIGN`.
- **Test 26** "leave the current end treatment in-service" ⇒ no `EXISTING` (the audit-noun requirement).
- **Test 27** "mise en service" ⇒ **not** `PRE_OPENING` (v1's false positive).
- **Test 28** "50 %" bus volume and "60 km/h" ⇒ no percentage candidate (the ticket's 30/60/90 ladder must not fire on them).

**Reference-PDF extraction performance [A7].** The four **small** PDFs (AB guidelines 83 KB, AB impl-plan 152 KB, BCT guidelines 167 KB, BCT policy 22 KB) are extracted in the ordinary test body. The **slow** ones (ON 8.7 MB, QC 5.5 MB, UNB 3.5 MB) are extracted **once per test file**, memoised in a `describe("reference-PDF attestation (slow)")` block with a generous timeout (e.g. 120 000 ms). No corpus body is read by any test, so no test depends on the network.

- Proof: `npx vitest run tests/discovery/stage-rules.test.ts` ⇒ 28 green.
- Acceptance: `npm run lint` and `npm run typecheck` clean (`tsconfig.json` includes `**/*.ts`; `eslint.config.mjs:4` ignores only build output).

### M3 — CLI (blocked_by: M2)

**M3.1** Create `scripts/harvest-stage-rules-v2.ts`. Pure, exported render functions (`renderCoverageTable(json)`, `renderAmbiguousTable(rows)`, `renderMovementTable(rows)`) plus `main()` guarded so the module can be imported by the test without side effects.

**M3.2 — exact CLI surface.**

```
npx tsx scripts/harvest-stage-rules-v2.ts selftest [flags]
npx tsx scripts/harvest-stage-rules-v2.ts fetch    [flags]
npx tsx scripts/harvest-stage-rules-v2.ts compare  [flags]
npx tsx scripts/harvest-stage-rules-v2.ts render   [flags]
```

| verb | flags (defaults) | behaviour |
|---|---|---|
| `selftest` **[A14]** | `--rules` (v2 json), `--rules-v1` (v1 json) | loads both rule files, compiles every regex with its recorded `flags`, runs the loader's validation (M1.3), prints the rule ids and the compiled-flag table. **This is the `--selftest` that used to live on the pure M2 module** — it needs file I/O, so it belongs to the CLI, not to the pure module. |
| `fetch` | `--manifest` (docs/RSA-Documents/canada-intake-manifest.jsonl), `--cache` (.autoforge/tmp/stage-rules-v2-cache/), `--tier` (all), `--limit` (0 = all), `--timeout-ms` (30000), `--max-file-bytes` (**25 000 000**), `--max-total-bytes` (**64 000 000**), `--user-agent` (the repo's `AuditorAI-RSA-Harvest/1.0 (+public documents only)`) | the ONLY network path. robots gate → ≤1 req/s per host, ≤2 concurrent per host (`src/discovery/robots.ts`, `src/discovery/ratelimit.ts`) → **stream** the body to `<cache>/<sha256>.pdf.part`, counting bytes as they arrive → sha256 → rename to `<cache>/<sha256>.pdf` **only on match**. **A file that exceeds `--max-file-bytes` or the run's remaining `--max-total-bytes` budget is aborted mid-stream, its `.part` is deleted, and the row is reported as `unavailable` (`oversize`) — it is never written [A10].** A sha mismatch ⇒ the row is **excluded and reported** (`sha-mismatch`), never silently reclassified (D9). A robots refusal is likewise a per-row `unavailable` outcome (`robots`), not a fatal error. **After the sha check, the PDF is text-extracted with `unpdf` and the NFC-normalised text (capped at 1 000 000 chars) is written to `<cache>/<sha256>.txt` [A11].** A PDF whose extraction yields no text is a **no-text-layer** row: the `.txt` is written empty, the row is reported `no-text-layer`, and the row is treated downstream as **title-only** (`body_available:false`, `source:"title"`). Stale `*.part` files are removed at start; an existing cache file is re-hashed before reuse and treated as absent if its sha does not match its filename. |
| `compare` | `--manifest` (as above), `--cache` (as above), `--rules` (v2 json), `--rules-v1` (v1 json), `--out` (…/coverage-v2-vs-v1.md), `--json-out` (…/coverage-v2-vs-v1.json), `--sidecar-out` (…/classifications-v2.jsonl), `--ambiguous-out` (…/ambiguous-v2.md), `--inventory` (docs/RSA-Documents/track-a-ondisk-inventory.jsonl), `--coverage` (state/odd-coverage.json) | **never touches the network** (no `fetch` call in this code path — enforced by a unit assertion that the compare path makes no network call). **Reads the `.txt` files only** (never the `.pdf`), so it is a pure cache read [A11]. A row with no cached text is classified from its **title** only and is marked `body_available:false`, `source:"title"` — and is **never counted as if it had body evidence**. **Classifies every row under BOTH rule sets over the SAME corpus and the SAME text** [orchestrator]: the v1 column is the **v1 rule file's verdict recomputed over that text**, *not* a copy of the committed manifest's `stage` column; the committed manifest value is recorded alongside as `stage_v1_committed`, and the per-row agreement is recorded as `v1_agreement` (`agree` / `disagree`). **A disagreement is a finding, not a bug** — it is itemised in the md and the README, never silently reconciled. Writes the 4 outputs. |
| `render` | `--from` (…/coverage-v2-vs-v1.json), `--out` (…/coverage-v2-vs-v1.md) | offline re-render of the md from the committed json companion; proves byte-derivation with no corpus and no network. |
| `render` (ambiguity) **[A12]** | `--from` (…/classifications-v2.jsonl), `--ambiguous-out` (…/ambiguous-v2.md) | **the ambiguity re-render path**: regenerates `ambiguous-v2.md` from the committed sidecar **alone** (no corpus, no network, no coverage json). `render --from <jsonl> --ambiguous-out <md>` writes only the ambiguity list; `render --from <json> --out <md>` writes only the coverage md. The two `--from` forms are distinguished by the file extension/content shape and both are documented in §8 of the md and in the README. |

**Exit codes (all verbs):** `0` success · `1` usage error (unknown verb/flag, missing file) · `2` fatal (unreadable manifest, unwritable cache) · `3` partial: `fetch` verified 0 rows (network dead) / `compare` wrote the outputs but ≥1 row had no body (title-only). `compare` still writes correct outputs on exit 3.
**Determinism:** rows sorted by `sha256`; no timestamp, no absolute path, no hostname in any output (precedent `scripts/harvest-track-a-report.ts:357`); rule-set and manifest sha256 recorded in the json companion.

- Proof: `npx tsx scripts/harvest-stage-rules-v2.ts selftest` ⇒ prints 4 v1 + 17 v2 rule ids with their flags; `npx tsx scripts/harvest-stage-rules-v2.ts compare --cache /tmp/empty-cache --out /tmp/t.md --json-out /tmp/t.json --sidecar-out /tmp/t.jsonl --ambiguous-out /tmp/a.md` ⇒ exit 0 (or 3), 4 files written, `bodies.fetched: 0`, `bodies.unavailable: 33`; `npx tsx scripts/harvest-stage-rules-v2.ts render --from /tmp/t.json --out /tmp/t2.md` ⇒ `/tmp/t2.md` byte-equals `/tmp/t.md`; `npx tsx scripts/harvest-stage-rules-v2.ts render --from /tmp/t.jsonl --ambiguous-out /tmp/a2.md` ⇒ `/tmp/a2.md` byte-equals `/tmp/a.md`.
- Acceptance: `npm run lint` and `npm run typecheck` clean; `compare` produces no network call (verified by the code path + a test that stubs/asserts no fetch); `fetch` enforces the 25 MB/file and 64 MB/total caps **while streaming**; `fetch` writes both `<sha256>.pdf` and `<sha256>.txt`.

### M4 — corpus fetch into the gitignored cache (blocked_by: M3)

**M4.1** `npx tsx scripts/harvest-stage-rules-v2.ts fetch --manifest docs/RSA-Documents/canada-intake-manifest.jsonl --cache .autoforge/tmp/stage-rules-v2-cache/` — **up to 33 rows, ≈ 48.9 MB total (51 252 032 B), largest row 11 126 108 B**, sha256-verified against the manifest `sha256` column, under the 25 MB/file and 64 MB/total streaming caps [A10]. **Expectation [A13]: per-row failure tolerant, partial results labelled** — a row whose bytes do not match the committed sha is **excluded and reported** (`sha-mismatch`); a row whose host is unreachable, whose robots gate refuses it, or which is oversize is **reported as unavailable with its reason** and the run still succeeds (exit 3 if nothing was verified). The committed candidate log shows **both previously-"dead" hosts at HTTP 200 / `ingested`** and **32 of 33 logged rows at HTTP 200**, so the expectation is a full 33/33 run; a partial run must be labelled as partial, never presented as complete. The cache is ignored twice over (`.gitignore:57`, `.git/info/exclude:7`).
**M4.2** Verify the cache location and the tree: `git check-ignore -v .autoforge/tmp/stage-rules-v2-cache/x.pdf` ⇒ ignored; `git status --porcelain` ⇒ **no new tracked file**; `git diff --stat -- docs/RSA-Documents` ⇒ empty.
- Acceptance: every cached file's sha256 == the manifest sha256 (the CLI prints a per-row outcome table); the total bytes fetched ≤ 64 MB and no single file > 25 MB; **no row is written when either cap is hit**; `git status --porcelain` shows no new tracked file; `git diff --stat -- docs/RSA-Documents` is empty; **no licence-register or quarantine row is owed** — nothing under `docs/RSA-Documents/` is written, every cached body is sha-verified against the manifest, and no body text is committed (`docs/RSA-Documents/LICENSE-REGISTER.md` and `QUARANTINE.md` stay untouched).

### M5 — artefacts (blocked_by: M1, M3, M4)

**M5.1** Create `docs/research/stage-rules/classifications-v2.jsonl` — the sidecar (D5): **one row per corpus document, all 33**, sorted by `sha256`. Exact row type:

```ts
export interface ClassificationRow {
  project_id: string;
  sha256: string;
  title: string;
  tier: string;                 // "T3" | "T1"
  ca_province: string | null;
  lang: string;                 // "en" | "fr"
  stage_v1_committed: string;   // the committed manifest stage, never rewritten
  cell_key_v1_committed: string;
  stage_v1_recomputed: string;  // the v1 RULE FILE's verdict over the same text
  cell_key_v1_recomputed: string;
  v1_agreement: "agree" | "disagree";  // a disagreement is a finding, not a bug
  stage_v2_primary: string;     // CanonicalStage | "MULTI_STAGE" | "UNSTAGED"
  cell_key_v2: string;          // "" when ambiguous (no Canadian multi-stage cell)
  candidates: StageCandidate[]; // stage, cell_key, confidence, rule_ids[], evidence_scope, matched_phrase, offset
  ambiguous: boolean;
  confidence: Confidence | null; // document level = the weakest candidate's label; null when no candidate
  asset_type: string | null;     // "station" | "corridor" | "functional_design" | null
  scope_basis: "own_scope" | "taxonomy_reference";
  text_chars_scanned: number;
  truncated: boolean;
  body_available: boolean;       // false => title-only row
  source: "text" | "title" | "hint";  // "title" = title-only row
  attestations: { rule_id: string; phrase: string; offset: number }[]; // fetch-time corpus attestations
}
```

- Acceptance: 33 rows; every `sha256`/`stage_v1_committed`/`cell_key_v1_committed` equals the committed manifest row; **`body_available:false` ⇔ `source:"title"` ⇔ the row had no body** (and such rows are excluded from every body-evidence count); `cell_key_v2 == ""` for every `ambiguous: true` row; no body text in the file (no field holds a body).

**M5.2** Create `docs/research/stage-rules/coverage-v2-vs-v1.json` — the machine companion. Shape:

```jsonc
{
  "rule_sets": { "v1": {"path","sha256"}, "v2": {"path","sha256"} },
  "manifest":  { "path","sha256","rows": 33 },
  "bodies":    { "fetched": n, "unavailable": m, "title_only_rows": n, "unavailable_rows": [{"sha256","reason"}] },
  "denominators": {
    "table_a_rows": 33, "table_a_t3_rows": 9,
    "table_a_cell_occupancy_v1": { "canada:FEASIBILITY_CONCEPT": 10, "canada:PRELIMINARY_DESIGN": 3, "canada:DETAILED_DESIGN": 0, "": 20 },
    "table_b_merged_rows": 335, "table_b_canadian_rows": 156, "table_b_canadian_t3_t4_rows": 32,
    "table_b_coverage_candidates": 2,
    "table_b_candidate_shas": ["a24707c6081a…", "0af7ea584ae0…"]
  },
  "table_a": [ { "cell_key","target","priority","have_v1_committed","have_v1_recomputed","have_v2","usable_clear_v1","usable_clear_v2","moved_in","moved_out","ambiguous_at_cell","title_only_rows" } ],
  "table_b": [ { "cell_key","target","priority","before_have","after_have","before_usable_clear","after_usable_clear","gap_before","gap_after","moved" } ],
  "no_cell":  [ { "label","count" } ],
  "v1_reproduced": { "rows": n, "mismatches": [], "disagreements": [{ "sha256","committed","recomputed" }] },
  "rule_attestations": { "<rule_id>": { "kind","attested", "sources": [{ "reference_doc","phrase" } | { "corpus_sha256","phrase" }] } },
  "rows": [ { "sha256","tier","ca_province","title","v1_committed","v1_recomputed","v1_agreement","v2_primary_stage","v2_cell","body_available","ambiguous","moved","reason" } ]
}
```

**Table B's definition, stated once [A4]:** Table B is **not** the 33 manifest rows. It is the repo's own **`mergeRows(inventory, manifest)`** from `scripts/harvest-track-a-report.ts` — **imported unmodified, never edited** — producing **335 merged rows** (304 inventory + 33 manifest − 2 shas in both), counted with the repo's own **`coverage_candidate` predicate** (`scripts/harvest-track-a-report.ts:293-299`: Canadian ∧ tier T3/T4 ∧ `cell !== null` ∧ `klass === "rsa-sample"` ∧ not a duplicate ∧ licence not `BLOCKED`). The predicate selects **2 rows**: `a24707c6081a…` (inventory-only, ON, `stage:"detailed"` → `canada:DETAILED_DESIGN`) and `0af7ea584ae0…` (manifest row 1, AB → `canada:FEASIBILITY_CONCEPT`), giving `canada:FEASIBILITY_CONCEPT` 1, `canada:PRELIMINARY_DESIGN` 0, `canada:DETAILED_DESIGN` 1 — the committed round-2 "after have" **1 / 0 / 1**. **Manifest-only yields 1 / 0 / 0, not 1 / 0 / 1** — the denominator is the merged corpus. `merged_rows: 335` and both candidate shas are recorded in the json.

**How the merged rows are re-classified under v2 (precise) [A4]:**
- The 33 **fetched** manifest rows are the only merged rows that get a v2 verdict. They are re-classified from their fetched body text (or title-only when the fetch failed) exactly as in Table A.
- The **302 merged rows with no manifest entry** (inventory-only) have **no body in this repo** (the inventory is a path/label index, not a corpus) and are **not re-fetched** — they carry **no v2 verdict** and keep their v1/committed stage and cell. They are counted exactly as the v1 column counted them.
- The 2 coverage candidates: `a24707c6081a…` is **inventory-only ⇒ no v2 verdict ⇒ it keeps its `detailed` stage and remains a `canada:DETAILED_DESIGN` candidate**; `0af7ea584ae0…` is manifest row 1 ⇒ it **does** get a v2 verdict and may therefore move cell.
- A merged row with **no v2 verdict** is counted by its v1 stage; a merged row with a v2 verdict is counted by its v2 stage. Rows with no v2 verdict are **never counted as if they had been re-classified**, and the md states how many merged rows carried a v2 verdict (33 of 335).

**M5.3** Create `docs/research/stage-rules/coverage-v2-vs-v1.md` — byte-derivable from M5.2 (`renderCoverageTable(json)`), 8 fixed sections:

- **§1 Scope and denominators** — corpus of record + row/tier counts + `bodies.fetched n/33` + the title-only row count **+ the two-denominator line [A4]: "Table A's 10 / 3 / 20 are CELL OCCUPANCY over the 33 manifest rows; Table B's 1 / 0 / 1 are COVERAGE CANDIDATES over the merged 335 rows. Two different populations — never mixed."**
- **§2 Table A — the re-classified corpus (denominator: the 33 manifest rows)**. Columns: `ODD cell | target | priority | have (v1, committed) | have (v1, recomputed) | have (v2) | usable CLEAR (v1) | usable CLEAR (v2) | moved in | moved out | ambiguous (unadjudicated) | title-only rows`. The `have (v1, committed)` column reproduces the manifest cell occupancy 10 / 3 / 20; the `have (v1, recomputed)` column is the v1 rule file's verdict over the same text.
- **§3 Table B — merged corpus-of-record coverage (denominator: `mergeRows(inventory, manifest)` = 335 rows, counted with the repo's `coverage_candidate` predicate)**. Columns (identical to the committed round-2 table, `docs/RSA-Documents/track-a-round2-harvest-report.md:35`): `ODD cell | target | priority | before have | after have | before usable (CLEAR) | after usable (CLEAR) | gap before | gap after | moved`. The **v1 ("before") column MUST equal the committed round-2 "after have"** — `canada:FEASIBILITY_CONCEPT` 1, `canada:PRELIMINARY_DESIGN` 0, `canada:DETAILED_DESIGN` 1. **On the table face, next to the v2 column [C9]: "no new document was fetched for v2 — every v2 cell is a re-labelling of an already-ingested document (newly fetched rows: 0)"**, plus the count of merged rows that carried a v2 verdict (33 of 335).
- **§4 Movement detail (33 rows)**. Columns: `sha256 (12) | tier | province | title | v1 committed | v1 recomputed | v1 agree? | body available | v2 kind | v2 primary stage | v2 candidates | v2 cell | moved | reason`. **Every row where `v1_agreement` is `disagree` is listed here and flagged as a finding, not a bug.**
- **§5 Ambiguity (AC3)** — the rows with `ambiguous: true`; mirrored from `ambiguous-v2.md`.
- **§6 No-cell buckets** — `PRE_OPENING` / `EXISTING` / `CONSTRUCTION` / `AMBIGUOUS` / `UNSTAGED` / `MULTI_STAGE` counts, each with a one-line note (`policies/canada/pack.json:75-89` defines no cell for `existing`/`construction`).
- **§7 Caveats** — the three caveat lines verbatim from `.autoforge/architecture/report-t62.md:499-503` (re-labelling not new coverage; ambiguous has no cell and is counted both ways; a row can lose a cell) + the licence note (32 `RESTRICTED` / 1 `CLEAR`).
- **§8 Reproduction and the reproducibility boundary [A12]** — the exact `selftest` + `fetch` + `compare` + `render` commands and the sha256 of both rule files, **and the boundary stated plainly**: *"the committed `coverage-v2-vs-v1.json`, `classifications-v2.jsonl` and `coverage-v2-vs-v1.md` are reproducible **offline** from the committed rule files and the committed manifest — no corpus and no network; only **re-deriving** them from scratch needs the gitignored corpus cache, which requires a network fetch. The md is byte-derivable from the json; the ambiguity list is byte-derivable from the committed sidecar alone (`render --from classifications-v2.jsonl --ambiguous-out ambiguous-v2.md`)."*

"moved" is **cell-level** (`v1_cell ≠ v2_cell`); stage-token changes are itemised in §4 and §6 (D6). Ambiguous rows are counted, never forced.

**M5.4** Create `docs/research/stage-rules/ambiguous-v2.md` (D7) — human table of the ambiguous rows: `document (sha256 12) | real title | candidate 1 (stage · confidence · rule ids) | candidate 2 (stage · confidence · rule ids) | n candidates | scope_basis (own_scope | taxonomy_reference) | cell if adjudicated at candidate 1`. Plus a short note that ambiguity ⇒ **no cell** (no Canadian multi-stage cell; v1 already treats `MULTI_STAGE` as unmapped, `scripts/harvest-track-a-report.ts:34`).

**M5.5** Generate: `npx tsx scripts/harvest-stage-rules-v2.ts compare --cache .autoforge/tmp/stage-rules-v2-cache/` then `… render --from docs/research/stage-rules/coverage-v2-vs-v1.json --out docs/research/stage-rules/coverage-v2-vs-v1.md` then `… render --from docs/research/stage-rules/classifications-v2.jsonl --ambiguous-out docs/research/stage-rules/ambiguous-v2.md`.

**M5.6** Create `tests/discovery/stage-rules-artifacts.test.ts` — **5 tests** **[A1]**:

| # | test | asserts |
|---|---|---|
| 1 | `the coverage table is byte-derivable from its json companion` | `renderCoverageTable(JSON.parse(readFileSync("docs/research/stage-rules/coverage-v2-vs-v1.json")))` byte-equals the committed `.md`; no timestamp pattern `/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/`; **Table B's v1 column == 1 / 0 / 1**; `denominators.table_b_merged_rows == 335`; `table_b_candidate_shas` == `["a24707c6081a…","0af7ea584ae0…"]` |
| 2 | `the sidecar covers the corpus of record exactly once` | `classifications-v2.jsonl` has 33 rows; each row's `sha256` is a manifest sha; each row's `stage_v1_committed`/`cell_key_v1_committed` equal the committed manifest `stage`/`cell_key`; `body_available:false` ⇔ `source:"title"`; every `ambiguous:true` row has `cell_key_v2 == ""`; no committed file under `docs/RSA-Documents/**` is modified (git check) |
| 3 | `the v1 baseline is reproduced row-for-row by the LIVE harvester` **[A6]** | **the v1 verdict is recomputed inside the test from the live `detectStage` imported from `scripts/harvest-track-a.ts`** over the rows whose body was fetched (the gitignored cache), and `mismatches` is asserted **on that computation** to be `[]` — the committed artefact's `v1_reproduced.mismatches` is only read as a **shape check** (an array), never as the thing being verified. The test therefore cannot pass by comparing an artefact with itself. The offline part of the same test always runs: the frozen v1 rule set vs the live `detectStage` over the 33 committed titles and the committed literals ⇒ equal. *(When the cache is absent — a CI lane without the corpus — the corpus half is `it.skipIf(cacheAbsent)`; the offline half always runs.)* |
| 4 | `an ambiguous document carries both candidates and no cell` | synthetic two-stage input ⇒ `ambiguous:true`, `candidates.length>=2`, `confidence:"inferred"`, `cell_key:""`; every committed sidecar row with `ambiguous:true` has ≥2 candidates, each with a valid enum label, non-empty `rule_ids` and a `matched_phrase`; every row with `ambiguous:false` has <2 candidates; **`ambiguous-v2.md` is byte-derivable from the committed sidecar alone** (`renderAmbiguousTable(rows)` == the committed md) and its rows are exactly the sidecar's `ambiguous:true` rows |
| 5 | `the committed round-1 / round-2 reports stay byte-identical` | the committed manifest's cell occupancy is still 10 / 3 / 20; the committed `docs/RSA-Documents/track-a-round2-harvest-report.md` "after have" line is still 1 / 0 / 1; the committed manifest sha256s are unchanged; `git diff --exit-code -- docs/RSA-Documents/` is empty |

- Acceptance: `md` byte-equals `render(json)`; `ambiguous-v2.md` byte-equals `renderAmbiguousTable(sidecar)`; `rows.length == 33`; the **live-computed** v1 reproduction has `mismatches == []`; the committed `v1_reproduced.mismatches` is `[]`; Table B's v1 column == 1 / 0 / 1; `merged_rows == 335`; `git diff --stat -- docs/RSA-Documents` empty; `git status --porcelain` shows only the new `docs/research/stage-rules/**` files.

### M6 — write-up (blocked_by: M5)

**M6.1** Create `docs/research/stage-rules/README.md` (D8). Required content, each a greppable line:
1. **Denominators** — Table A = 33 manifest rows (9 T3 / 24 T1, 12 with `ca_province`), Table A's v1 cell occupancy = 10 / 3 / 20; Table B = the merged corpus `mergeRows(inventory, manifest)` = **335 rows** (156 Canadian), coverage candidate = the repo's `coverage_candidate` predicate, **2 candidates** (`a24707c6081a…`, `0af7ea584ae0…`) ⇒ 1 / 0 / 1. "Two denominators, never mixed."
2. **The rule set** — the v1 → v2 delta (window 8000 → whole text/NFC/1e6; `detail design` added; `mise en service` no longer `PRE_OPENING`; Tier-1-before-Tier-2; 17 rules) and the confidence vocabulary with its `docs/adr/0002-canonical-stage-model.md` citation.
3. **Honest coverage impact** — the numbers may barely move and may shrink; the gain is correctness and auditability, not coverage; **22 of the 29 Canadian T3/T4 rows on the operator's on-disk inventory (22 of the 32 in the merged corpus) are in-service/`existing` audits with no cell to move into** (a policy gap, not a classifier gap); Canada's cells carry **0 of 16** covered cells in the gap audit (`docs/research/enterprise-gap-audit.md:250,267-268`).
4. **The Transitway premise correction** (D10) — the motivating document names no stage word in 91 794 chars; its verdict is `UNSTAGED` with `asset_type: "station"`; no rule can give it a cell, because in-service has no Canadian cell.
5. **Caveats** — the three lines from §7.
6. **Repro commands** — the `selftest` / `fetch` / `compare` / `render` invocations with the exact flags and the rule-file sha256s.
7. **The reproducibility boundary [A12]** — the committed json + sidecar + md are reproducible **offline** from the committed rule files + manifest; only **re-deriving** them needs the gitignored corpus cache (a network fetch); `render --from classifications-v2.jsonl` regenerates the ambiguity list from the committed sidecar alone.
8. **The download bound [A10]** — "never download large files": **25 MB per file, 64 MB total, enforced while streaming**; an oversize or over-budget row is reported as unavailable and never written.
9. **The AC1 evidence quality, stated honestly [A7][C9]** — **4 of the 17 rules are exercisable by a real corpus title** (`CA-FEAS`, `CA-DETAIL`, `CA-PREOPEN`, `CA-ASSET`); **10 are proven against a real committed open-licence reference PDF** (extracted at test time); **3 are the ticket's own terms and are attested nowhere** (`CA-PRELIM-TICKET`, `CA-DETAIL-TICKET`, `CA-EXISTING-TICKET`). "A test per new rule" is met; "using real corpus titles" is met for 4 of 17 rules only.
10. **The unattested list [A8]** — every rule whose evidence is not attested in the committed corpus at the time of writing is listed here, verbatim: **"declared by ticket #62, unattested in the committed corpus at the time of writing"**. No attestation is claimed that was not measured.
11. **The v1 recomputation findings** — the rows where the recomputed v1 verdict disagrees with the committed manifest stage (`v1_agreement: "disagree"`): **a finding, not a bug**; listed with the count and the reason.
12. **Follow-up tickets (named, not designed)** — (a) add `EXISTING`/`CONSTRUCTION` canonical stages + Canadian cells to `policies/canada/pack.json` (D12); (b) rule on the contested vocabulary ("Functional Plan" per `policies/canada/pack.json:25` vs `:43`, "concept design", "avant-projet préliminaire"); (c) decide whether asset-type cues may ever classify a stage-less document; (d) reconcile the Quebec stage vocabulary (`avant-projet préliminaire` is the real term; `conception préliminaire` is the ticket's alias) with the issuing authority.
13. **Licence note** — 32 `RESTRICTED` / 1 `CLEAR`; no corpus body text is committed; only short TERM quotes and source references are.

### M7 — verification (blocked_by: M1–M6)

**M7.1** `npm run lint` ⇒ clean. **M7.2** `npm run typecheck` ⇒ clean. **M7.3** `npx vitest run tests/discovery/stage-rules.test.ts tests/discovery/stage-rules-artifacts.test.ts` ⇒ 33 green (28 + 5). **M7.4** `npx vitest run tests/discovery/harvest-track-a.test.ts tests/discovery/harvest-track-a-report.test.ts tests/discovery/harvest-track-a-round2-report.test.ts` ⇒ green **without editing those files** (the v1 lane stays frozen). **M7.5** `npm run test` ⇒ green. **M7.6** byte-identity of the committed v1 artefacts: `git diff --exit-code -- docs/RSA-Documents/` ⇒ no diff; `git status --porcelain` ⇒ only the new files (`docs/research/stage-rules/**`, `scripts/stage-rules.ts`, `scripts/harvest-stage-rules-v2.ts`, `tests/discovery/stage-rules.test.ts`, `tests/discovery/stage-rules-artifacts.test.ts`); the cache is untracked-and-ignored. **M7.7** `git diff --exit-code -- scripts/harvest-track-a.ts policies/ src/ state/odd-coverage.json` ⇒ no diff (D13). **M7.8** `node scripts/vault-sync.mjs --check` ⇒ clean.

## 4. DAG and parallelisation

```
M1 ──► M2 ──► M3 ──► M4 ──┐
 │              │          ├──► M5 ──► M6
 └──────────────┴──────────┘          │
                                      ▼
                                     M7
```

Edges (machine form): `M2.blocked_by=[M1]`, `M3.blocked_by=[M2]`, `M4.blocked_by=[M3]`, `M5.blocked_by=[M1,M3,M4]`, `M6.blocked_by=[M5]`, `M7.blocked_by=[M1,M2,M3,M4,M5,M6]`.

**Parallelisation call.**
- **Forced sequential:** M1→M2→M3 (data → module → CLI): the classifier's types are the CLI's contract. M4→M5 (M5 reads the cache dir M4 writes — shared mutable state). M5→M6 (the README quotes the final numbers). M1→M5 (M5 loads the rule files). M6→M7 (M7 verifies everything, including M6's README).
- **Safe to run concurrently:** **M1's rule authoring overlaps M2's code authoring** (M1 writes only the two JSON files; M2 writes only `scripts/stage-rules.ts` — disjoint). M2's *test run* needs M1 (it loads the rule JSON), so the overlap is authoring-only. **M7 is strictly last** (its `blocked_by` is every module) — the earlier v1 wording claiming "M7 lint/typecheck can start once M1–M4 land" is withdrawn as inconsistent with the DAG. **Net: this ticket is a single sequential chain;** the one real win is that M4's network wait (≈ 49 MB) can overlap M2's final test authoring only after M3's CLI exists, so M4's fetch is started immediately after M3 and consumed by M5 while the remaining assertions are reviewed.
- **Never parallelize:** anything touching the cache dir, the rule files, or the committed manifest.

## 5. Risks and mitigations

| # | risk | mitigation |
|---|---|---|
| R1 | **Network / partial fetch**: a host is unreachable, refuses robots, or serves different bytes | **up to 33 rows, ≈ 48.9 MB, per-row failure tolerant, partial results labelled**; the committed candidate log shows both previously-"dead" hosts at HTTP 200 / `ingested` and 32/32 logged rows at 200, so a full run is the expectation and a partial run must be labelled; `fetch` prints a per-row outcome table and exits 3 if nothing was verified; `compare` classifies those rows from the **title** only, marks `body_available:false` / `source:"title"`, and the md states the title-only count so a partial run cannot masquerade as a full one |
| R2 | **Corpus drift** (a URL now serves different bytes) | sha256 is verified per row against the committed manifest; a mismatch ⇒ the row is **excluded and reported** (`sha-mismatch`), never silently reclassified; the mismatch is listed in §1 and in `bodies.unavailable_rows` |
| R3 | **False positives from prose** ("final design", "existing", "functional plan", "planning", "50 %") | every rule requires stage context; `CA-ASSET` is title-scoped and yields no stage/cell; the four negative tests pin the traps; `scope_basis` separates an own-scope hit from a taxonomy enumeration |
| R4 | **Coverage regression, not gain** — 13 of 33 rows are `MULTI_STAGE` today; v2 can show fewer documents in cells | Table A carries `have (v1, committed)` **and** `have (v1, recomputed)` **and** `have (v2)` **and** `ambiguous (unadjudicated)`; §4 itemises every move in both directions; the md states on the table face that no new document was fetched for v2; the README states it plainly. The artefact cannot claim a gain it did not produce |
| R5 | **Corpus text leaking into the commit** (48.9 MB, 32/33 RESTRICTED) | the cache lives in `.autoforge/tmp/stage-rules-v2-cache/` (ignored twice over); the CLI has **no** code path that writes under `docs/RSA-Documents/` or to the committed manifest (the `intake` path is never called); only rule patterns, ≤10-word TERM quotes and source references are committed; M7.6 asserts `git status` shows nothing new under `docs/RSA-Documents/` |
| R6 | **A second agent lane touches the same files** | `touches` globs are disjoint per module (M1/M5/M6 write different files; M2/M3 write different scripts; M2 and M5 own **different** test files; M4 writes only the cache); the v1 lane (`scripts/harvest-track-a.ts` + the 3 harvest test files) is touched by nobody (D13) |
| R7 | **The md and the json drift apart** | the md is **rendered from** the json (`renderCoverageTable`), and the artefact test asserts byte-equality; `render` reproduces the md from the committed json with no corpus and no network; `render --from classifications-v2.jsonl` reproduces the ambiguity list from the committed sidecar alone |
| R8 | **The rule set encodes a wrong taxonomy** ("Functional Plan", "concept design", "avant-projet préliminaire" are unsettled by any committed source) | tier-2 rules emit a **pair** with `inferred` confidence and **no cell** (D11); the contested mappings are named as follow-up (b) in the README; no rule ever forces a contested stage |
| R9 | **A v2 rule accidentally matches v1's false positive** and re-creates the UNB `PRE_OPENING` bug | `CA-PREOPEN` requires `pre-?opening` / `avant … ouverture` only; "mise en service" is a pinned negative test; the UNB row's v2 verdict is asserted explicitly in the sidecar |
| R10 | **An unattested rule is presented as attested** | every evidence entry carries `attested`; the ticket-declared rules are `attested:false` by construction; the README's "unattested list" is asserted by the artefact test (a rule whose evidence is `attested:false` must appear in the README's unattested section) |
| R11 | **An unbounded download** | 25 MB/file and 64 MB/total, **enforced while streaming**; the largest corpus row is 11 126 108 B and the whole corpus is 51 252 032 B, so the bound never truncates a legitimate row; an oversize row is aborted, its `.part` deleted, and reported `unavailable` — never written |

## 6. Non-goals (explicit)

1. **No change to `docs/RSA-Documents/**`** — the manifest, both committed reports, the schema, the candidate log, the licence register, the quarantine and the sources files stay byte-identical.
2. **No change to `scripts/harvest-track-a.ts`** — v1's rules, cell map, window and `MULTI_STAGE` collapse stay exactly as they are; the new script does not reuse its `intake` path or its known-hash gate.
3. **No change to `policies/**`** — no new ODD cell, no `EXISTING`/`CONSTRUCTION` cell (D12); that is a follow-up ticket.
4. **No change to `src/**` or the app** — the app resolves stages from an operator-selected `native_stage_id` (`src/domain/odd.ts:73-89`); there is no text classifier in the app and none is added.
5. **No change to `state/odd-coverage.json`** — derived from `state/discovery-ledger.json` by `scripts/discovery-coverage.ts`, not from the manifest.
6. **No Postgres tenant-store work** — `TENANT_STORE=postgres` stays off; production behaviour unchanged.
7. **No box round trip** — no push to `oc-box`, no corpus on the box.
8. **No new stage token in the committed manifest** (D14) and no new `UNMAPPED_STAGES` entry (that would touch a shared report file).
9. **No corpus body text committed** — licence constraint (32/33 `RESTRICTED`).
10. **No new dependency** — `unpdf` is already there (`package.json:31`); no `package.json` edit.
11. **Not a re-run of the 108 round-2 candidates** — only the 33 ingested manifest rows are corpus members; the other 75 are `not RSA` / `hash-already-present` / `not a pdf` / robots / 403 in the committed candidate log.
12. **No per-document adjudicated cell for ambiguous rows** — ambiguity is reported, never resolved.
13. **No re-fetch of the 302 inventory-only merged rows** — Table B's merged corpus is counted from the committed inventory + manifest; only the 33 manifest rows are fetched and re-classified.
14. **No edit to `scripts/harvest-track-a-report.ts`** — `mergeRows` and `coverage_candidate` are **imported unmodified** (A4); the v2 tooling reads them, it never rewrites them.

## 7. Verification commands (final)

```bash
npm run lint
npm run typecheck
npx vitest run tests/discovery/stage-rules.test.ts tests/discovery/stage-rules-artifacts.test.ts
npx vitest run tests/discovery/harvest-track-a.test.ts \
                tests/discovery/harvest-track-a-report.test.ts \
                tests/discovery/harvest-track-a-round2-report.test.ts
npm run test
node scripts/vault-sync.mjs --check
git diff --exit-code -- docs/RSA-Documents/ scripts/harvest-track-a.ts policies/ src/ state/odd-coverage.json
git status --porcelain
git check-ignore -v .autoforge/tmp/stage-rules-v2-cache/x.pdf
```

## 8. Acceptance mapping

| Ticket AC | artefact | command that proves it | caveat (stated honestly) |
|---|---|---|---|
| **AC1** — a test per new rule, using real corpus titles | `tests/discovery/stage-rules.test.ts` — 17 rule-focused `it()`s (one per v2 rule id) + the v1 freeze + classifier units + negative traps (28 tests in total) | `npx vitest run tests/discovery/stage-rules.test.ts` | **"Using real corpus titles" is met for 4 of the 17 rules** (`CA-FEAS`, `CA-DETAIL`, `CA-PREOPEN`, `CA-ASSET`). **10 rules are proven against a real committed open-licence reference PDF** (`docs/references/CA/*.pdf`), extracted at test time with `unpdf` — the rule must fire on the phrase **in that document**. **3 rules are the ticket's own terms** (`CA-PRELIM-TICKET`, `CA-DETAIL-TICKET`, `CA-EXISTING-TICKET`), attested nowhere in the committed set; their test asserts the honesty flag (`attested:false`), and the README lists them as "declared by ticket #62, unattested in the committed corpus at the time of writing". `CA-CONSTR` and `CA-AMBIG-CONCEPT` have **no corpus row**: they are proven against the AB guidelines and the ON guideline respectively |
| **AC2** — a coverage table under v2 vs v1 | `docs/research/stage-rules/coverage-v2-vs-v1.md` (Table A: 33 re-classified manifest rows, v1 committed **and** v1 recomputed; Table B: the **merged 335-row corpus** counted with the repo's `coverage_candidate` predicate, reproducing the committed round-2 "after have" 1 / 0 / 1) + the machine companion `coverage-v2-vs-v1.json`; "moved" = cell-level; ambiguous counted, never forced | `npx tsx scripts/harvest-stage-rules-v2.ts compare --cache .autoforge/tmp/stage-rules-v2-cache/` then `… render --from docs/research/stage-rules/coverage-v2-vs-v1.json --out docs/research/stage-rules/coverage-v2-vs-v1.md`; artefact test 1 asserts `md == render(json)` byte-for-byte, the Table B v1 column == 1 / 0 / 1, `merged_rows == 335` and the two candidate shas | Table A's 10 / 3 / 20 and Table B's 1 / 0 / 1 are **different populations** (cell occupancy over 33 manifest rows vs coverage candidates over the merged 335) — never mixed. The v2 column is a **re-labelling**, not new coverage (0 new documents fetched) |
| **AC3** — ambiguous documents listed with both candidate stages | `docs/research/stage-rules/ambiguous-v2.md` (document, real title, both candidate stages, per-candidate confidence, rule ids, `scope_basis`) + the `ambiguous: true` rows of `docs/research/stage-rules/classifications-v2.jsonl` | `npx vitest run tests/discovery/stage-rules-artifacts.test.ts -t 'ambiguous'` — every `ambiguous: true` sidecar row has ≥2 candidates, each with a valid ADR-0002 confidence label, non-empty `rule_ids`, a `matched_phrase`, and `cell_key_v2 == ""`; and `ambiguous-v2.md` is byte-derivable from the committed sidecar alone | the ambiguity list is regenerable offline from the committed sidecar (`render --from classifications-v2.jsonl`) |
| **Goal clause** ("so T3 documents reach their cells") — *a result, not a criterion* | `docs/research/stage-rules/README.md` §3 states plainly what moved and what cannot: only 3 of 33 rows are Canadian **and** T3; the Transitway row names no stage and stays `UNSTAGED` (`asset_type: "station"`); **22 of the 29** Canadian T3/T4 on-disk inventory documents (22 of the 32 in the merged corpus) are in-service/`existing` audits with no cell to move into (a policy gap) | `grep -n` the required statements in `README.md`; §2/§3 of the coverage table | the goal clause is a goal, not a criterion; the honest expectation is that the numbers barely move |

---

## 9. Amendment A — M1 review fix round (CHANGES_REQUIRED, resolved)

- **Round.** The independent review of M1 (`.autoforge/reviews/M1-t62.md`, VERDICT `CHANGES_REQUIRED`) raised MAJOR-1 (the bare `pr[ée]liminaire` alternative is an unsanctioned false-positive family), MAJOR-2 (`CA-PRELIM-FR` and `CA-AMBIG-AVP` share a trigger, so the tier-2 rule is unreachable), MAJOR-3 (`in-?service` cannot match the attested **spaced** spelling), MINOR-1 (v1's leftover `d[ée]taill[ée]e?\b`), MINOR-2 (`CA-AMBIG-PCT` cites a photo caption, not the plan's AB sentence) and NIT-1/NIT-2. This amendment closes them. The **classifier is not changed** (`scripts/stage-rules.ts` stays byte-identical) — the rule set remains a pure stage-vocabulary artefact.
- **Two judgement calls were decided by the orchestrator and are implemented exactly as decided** (not re-opened here): (a) the bare French forms are **kept** (FIX 3), because dropping them would make a document **leave** a canonical cell under v2 — a v1→v2 coverage regression, the opposite of this ticket's goal — so they are fixed by **sanction** (this amendment) plus **evidence** (a measured TERM quote and the document it was measured in), not by removal; (b) the classifier's `BARE_STAGE_ORDINAL` refinement stays in the classifier (FIX 4).

### A.1 What changed, fix by fix

| fix | review finding | change | where |
|---|---|---|---|
| **FIX 1** | MAJOR-3 | `CA-EXISTING`: `in-?service` → `in[\s-]?service`, `post-?opening` → `post[\s-]?opening`. The **audit-noun alternation is kept** (`road\|highway\|corridor\|facilit\|review\|audit`), so the negative trap *"leave the current end treatment in-service"* still yields no `EXISTING`. New attested evidence: `post opening` (UNB guidelines). | `docs/research/stage-rules/stage-rules.v2.json` |
| **FIX 2** | MAJOR-2 | `CA-PRELIM-FR` (tier 1) keeps the **named** forms `avant-projet pr[ée]liminaire` and `plans et devis pr[ée]liminaires`; `CA-AMBIG-AVP` (tier 2) now triggers on the **BARE** `avant-projet` through the negative lookahead `avant-projet(?!\s+(?:pr[ée]liminaire\|d[ée]finitif))`. The two rules can therefore never match the same phrase, and the tier-2 ambiguity is reachable for a document that has a body (D11: tier 1 wins). | idem |
| **FIX 3** | MAJOR-1 + MINOR-1 | the bare French forms `pr[ée]liminaire` (`CA-PRELIM-FR`) and `d[ée]taill[ée]e?\b` (`CA-DETAIL-FR`) are **kept** — they are v1-parity (`scripts/harvest-track-a.ts:518-519`) — and are now **sanctioned** by this amendment and **evidenced**: new attested entries `préliminaire` (QC guide) and `analyse détaillée` (QC guide), both measured with `unpdf` on 2026-10-22. | idem |
| **FIX 4** | M2 disclosure | the bare stage-ordinal refinement is **part of the confidence doctrine** (D1 / `docs/adr/0002-canonical-stage-model.md`), not a rule: it is the classifier's hard-coded `BARE_STAGE_ORDINAL` (`scripts/stage-rules.ts`), covered by M2's tests 2 and 5 (a bare `Stage 1`/`Stage 3` reads as `interpreted`). `scripts/stage-rules.ts` is **not** changed by this round, so the rule set stays a pure stage-vocabulary artefact. | — |
| **FIX 5** | MINOR-2 | `CA-AMBIG-PCT`'s evidence entry now states in its note that the attested occurrence of `75% design` is a **UNB figure caption**, not prose. The AB 17-word sentence is **not** claimed as attested anywhere. | idem |
| **FIX 6** | NIT-1 | re-checked: `CA-PCT-DETAIL` = `(?:9\d\|100)\s*%[\s\S]{0,60}?(?:design\|de[ée]tail\|d[ée]taill\|plan)` — the design noun must **follow** the percentage inside the 60-character window. `design 95%` does not match; `50 % of the daily bus volume at 60 km/h` matches neither percentage rule. | verified, no change |

### A.2 Amended M1 rule-table rows (replace the §3 M1.2 rows for these five rules)

| id | tier | lang | scope | outcome | fires on (pattern intent) | attested evidence (measured) |
|---|---|---|---|---|---|---|
| `CA-EXISTING` | 1 | en | any | `EXISTING` → `""` (no cell, D12) | `in[\s-]?service (road\|highway\|corridor\|facilit\|review\|audit)` (space **or** hyphen — the spaced spelling is the attested one), `existing (road\|highway\|corridor\|facilit)`, `post[\s-]?opening` (space **or** hyphen), `already in service`, `après ouverture` | `existing road` — AB guidelines (small), impl-plan, BCT guidelines, ON; `already in service` — ON (slow); `post-opening` — ON (slow); **`post opening` — UNB (slow), the spaced spelling**; `après ouverture` — QC guide (slow) |
| `CA-PRELIM-FR` | 1 | fr | text | `PRELIMINARY_DESIGN` → `canada:PRELIMINARY_DESIGN` | `avant-projet pr[ée]liminaire`, `plans et devis pr[ée]liminaires`, **and the bare `pr[ée]liminaire`** (v1-parity, retained — see A.3) | `avant-projet préliminaire` — QC guide (slow); `plans et devis préliminaires` — QC guide (slow); **`préliminaire` — QC guide (slow): the standalone word occurs 8×, 7 of them inside `avant-projet préliminaire` and 1 standalone (`préliminaire de l'ordre de déplacement`)** |
| `CA-DETAIL-FR` | 1 | fr | text | `DETAILED_DESIGN` → `canada:DETAILED_DESIGN` | `plans et devis définitifs`, `avant-projet définitif`, **and the bare `d[ée]taill[ée]e?\b`** (v1-parity, retained — see A.3) | `plans et devis définitifs` — QC guide (slow); `avant-projet définitif` — QC guide (slow); **`analyse détaillée` — QC guide (slow): the only occurrence of `détaillée` in the 7 committed PDFs, in the QC guide's negative disclaimer "l'audit n'est pas une analyse détaillée d'accidents" (the quote is attested; its context is a disclaimer, not a stage label)** |
| `CA-AMBIG-AVP` | 2 | fr | any | pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`, `inferred`, no cell (D11) | the **BARE** `avant-projet` — not qualified by `pr[ée]liminaire` / `d[ée]finitif` (negative lookahead) | **`attested:false`** — the unqualified form has **0 occurrences** in all 7 committed reference PDFs (measured 2026-10-22): the 8 occurrences of the string `avant-projet` in the QC guide are all qualified. The corpus attestation happens at fetch time (M4) |
| `CA-AMBIG-PCT` | 2 | en | any | pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}`, `inferred`, no cell | `NN%` followed within 60 chars by a design noun — the ticket's **30 % / 60 %** rungs | `75% design` — UNB guidelines (slow) — **the attested occurrence is a figure caption** ("… 75% DESIGN STAGE -NEW FACILITY ROUTE 20 HIGH SPEED CONNECTOR …"), not prose. The plan's AB sentence (17 words) exceeds the 10-word TERM-quote cap and is **not** cited as attested evidence |

**One line on the French split (FIX 2):** a **bare** `avant-projet` (unqualified) is the ambiguous French case — it is the tier-2 `CA-AMBIG-AVP` trigger; `avant-projet préliminaire` and `avant-projet définitif` are **named** tier-1 stages (`CA-PRELIM-FR` / `CA-DETAIL-FR`) and never reach the tier-2 rule.

### A.3 The v1-parity rationale (FIX 3)

v1's own frozen rules carry the bare French forms: `scripts/harvest-track-a.ts:518` — `d[ée]taill[ée]e?\b` (DETAILED_DESIGN) and `scripts/harvest-track-a.ts:519` — `pr[ée]liminaire` (PRELIMINARY_DESIGN). Under v1, **any** French document containing those words was labelled `DETAILED_DESIGN` / `PRELIMINARY_DESIGN`. Removing them in v2 would let a document **leave** its canonical cell — a v1→v2 **coverage regression**, the opposite of this ticket's goal (T3 documents must reach their cells). They are therefore **kept, sanctioned and evidenced**, not removed:

- `CA-PRELIM-FR` keeps `pr[ée]liminaire`; `CA-DETAIL-FR` keeps `d[ée]taill[ée]e?\b`. Each now carries an **evidence entry with a short TERM quote and the document it was measured in** (`préliminaire` — QC guide; `analyse détaillée` — QC guide), with `attested` set to the **measured** truth.
- The cost is the false-positive family the review named: a French text that merely contains `préliminaire` / `détaillée` is now a tier-1 `PRELIMINARY_DESIGN` / `DETAILED_DESIGN`. That trade is deliberate and recorded here, in the rule's own `evidence[].note`, and in the file-level `note`.
- `CA-PRELIM-TICKET` and `CA-DETAIL-TICKET` are **not shadowed** by these forms: they match their own strings `conception préliminaire` / `conception détaillée` (different strings from the bare adjectives), they still fire, and their rule ids are still recorded in the candidate's `rule_ids`. They are, however, no longer the *only* rule that fires on those strings — the bare v1-parity forms match them too. The ticket's terms remain honoured and attested nowhere (`attested:false`, as the ticket-declared honesty flag requires).

### A.4 The percentage ladder, stated once (FIX 5 amendment)

Unchanged in substance, corrected in one respect. The ticket's 30 % / 60 % / 90 % design ladder is implemented by **two** rules: `CA-PCT-DETAIL` (tier 1) fires on a 90 %/100 % design-percentage marker ⇒ `DETAILED_DESIGN`; `CA-AMBIG-PCT` (tier 2) fires on any other percentage marker near a design noun ⇒ the contested pair `{PRELIMINARY_DESIGN, DETAILED_DESIGN}`, `inferred`, **no cell** — this is where the 30 % and 60 % rungs land. D11 (tier 1 wins) means 90 % always resolves to `DETAILED_DESIGN`. The 30/60/90 numbers are the **ticket's declared intent**, recorded in the rule's `evidence[].note`; the corpus uses 50 % / 75 % / 95 %, so the pattern is `NN%`, not a hard-coded 30/60. **Correction:** the attested `CA-AMBIG-PCT` phrase `75% design` occurs in the UNB guidelines as a **figure caption**, not as prose; the AB guideline sentence *"before 75% completion of the project and is the equivalent of the 90% to 95% stage of the design"* is 17 words and exceeds the 10-word TERM-quote cap, so it is **not** cited as attested evidence anywhere.

### A.5 Test expectations changed by this round (FIX 7)

`tests/discovery/stage-rules.test.ts` keeps **28 tests**; only the expectations the rule changes genuinely invalidate were touched, and every change strengthens the test rather than weakening it:

| test | change |
|---|---|
| `CA-AMBIG-AVP` | re-pointed at the rule's **new** trigger: the bare `avant-projet` yields the contested pair (`rule_ids == ["CA-AMBIG-AVP"]`, `inferred`, no cell), and the rule's evidence entry is asserted **`attested:false`** (the bare form is unattested — the honesty flag, never an attestation). Added: the qualified forms `avant-projet préliminaire` / `avant-projet définitif` are **not** ambiguous — they are tier 1 (`CA-PRELIM-FR` / `CA-DETAIL-FR`) and never reach the tier-2 rule. The QC-guide assertion for `avant-projet préliminaire` is kept. |
| `CA-EXISTING` | added: the **spaced** spelling `in service road safety audit` and `post opening` both classify as `EXISTING` (FIX 1). |
| `CA-PRELIM-FR` | added: the retained v1-parity bare form (`rapport préliminaire de l'audit`) still classifies as `PRELIMINARY_DESIGN` with the `canada:PRELIMINARY_DESIGN` cell. |
| `CA-DETAIL-FR` | added: the retained v1-parity bare form (`analyse détaillée d'accidents`) still classifies as `DETAILED_DESIGN` with the `canada:DETAILED_DESIGN` cell. |

No test was deleted; the v1-freeze, v1-behavioural, determinism, classifier-unit and all four negative-trap tests are untouched.

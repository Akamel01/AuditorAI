# Decisions — Ticket #62: versioned stage rule set v2

ADR-style. Each entry: context / decision / alternatives rejected / evidence / consequence.
Numbered D1..D12. Every claim carries a `file:line`.

---

## D1 — v1 and v2 live as two JSON rule-set files under `docs/research/stage-rules/`

**Context.** #62 requires a versioned rule set so earlier before/after comparisons stay valid. v1 today is an inline array, `scripts/harvest-track-a.ts:516-521`, and it is *behaviourally load-bearing*: the two committed reports are byte-reproducible from it (`tests/discovery/harvest-track-a-report.test.ts:251`, `tests/discovery/harvest-track-a-round2-report.test.ts:99`). Editing that array changes v1 and breaks both tests.

**Decision.** Two JSON files — `docs/research/stage-rules/stage-rules.v1.json` (a frozen snapshot of `scripts/harvest-track-a.ts:516-527`) and `docs/research/stage-rules/stage-rules.v2.json` — loaded by a new module. `docs/research/` is tracked (`git ls-files docs/research` → non-empty) and not git-ignored (`git check-ignore -v docs/research/stage-rules/x.md` → no match; discovery §Q4.2). v1's JSON is a *transcription*, not an extraction: v1 stays inline in the harvester and the harvester is not edited.

**Alternatives rejected.**
- *Two TS modules under `scripts/`* — a "frozen v1 module" is still code; a later edit silently changes v1, which is precisely what the two byte-identity tests exist to catch.
- *Edit `scripts/harvest-track-a.ts:516-521` in place* — changes v1, breaks both byte-identity tests, and touches a file two other lanes last wrote (#58, #61).
- *Put the rules under `docs/RSA-Documents/`* — that tree is the committed corpus of record and the ticket forbids changing it.

**Evidence.** `scripts/harvest-track-a.ts:516-527`; `tests/discovery/harvest-track-a-report.test.ts:251`; `tests/discovery/harvest-track-a-round2-report.test.ts:99`; `.gitignore:76,79`; discovery §Q4.1–Q4.2.

**Consequence.** v1's behaviour is provable against the frozen JSON; v2 is reviewable as data. Cost: the cell map (`scripts/harvest-track-a.ts:523-527`) is duplicated into the JSON — mitigated by a test asserting `frozenV1.cells` ≡ `MANIFEST_STAGE_TO_CELL` (`scripts/harvest-track-a-report.ts:24-29`, exported).

---

## D2 — The classifier lives in a new module `scripts/stage-rules.ts`, never inside the harvester

**Context.** The harvester is the v1 implementation and the only production call site of the classifier is `scripts/harvest-track-a.ts:964`. A v2 that lives in the same file makes the two rule sets indistinguishable and puts every future v2 change in another lane's file.

**Decision.** A separate module `scripts/stage-rules.ts` exporting only pure functions (`loadRuleSet`, `compileRules`, `classifyDocument`) — no `fs`, no `fetch` — so a reviewer can unit-test the classifier with no network.

**Alternatives rejected.**
- *Add `STAGE_RULES_V2` inside `scripts/harvest-track-a.ts`* — mixes the frozen v1 with the new v2 in one file; the freeze story collapses.
- *Put the classifier in `src/`* — `src/` is the app; the app has no text classifier (`src/domain/odd.ts:74-90`, `src/domain/pipeline/nodes/stage-select.ts:40-56`) and must not gain one.

**Evidence.** `scripts/harvest-track-a.ts:964`; `scripts/harvest-track-a.ts:534-548`; `src/domain/odd.ts:74-90`; `src/domain/pipeline/nodes/stage-select.ts:40-56`; discovery §Q1.2.

**Consequence.** `scripts/harvest-track-a.ts` is byte-untouched, so all three existing harvest test files keep passing without edits. The new module is covered by `tsconfig.json`'s `include: ["**/*.ts"]` and by `eslint.config.mjs` (which ignores only build output), so it must pass `npm run lint` and `npm run typecheck`.

---

## D3 — The decision value carries ordered candidates, per-candidate confidence, and a `kind`; nothing is ever collapsed

**Context.** The ticket requires: "when genuinely ambiguous between two stages record BOTH candidates and a confidence, never force a single stage". v1 collapses every multi-hit document to a single token `MULTI_STAGE` (`scripts/harvest-track-a.ts:541-543`), which loses the evidence.

**Decision.** `StageDecision { rule_set_version, kind, candidates[], primary, confidence, ambiguous, cell_key, source, title, text_chars_scanned }` with `StageCandidate { stage, cell_key, confidence, rule_ids[], hits, matched_text, evidence_scope }`. `kind ∈ {single, ambiguous, taxonomy, unstaged}`. `candidates` is never truncated; `cell_key` is non-empty only for `kind === "single"`.

**Alternatives rejected.**
- *Extend `StageDecision.stage` with a comma-joined token* — unparseable, and it would silently break the string lookups at `scripts/harvest-track-a.ts:1011` and `scripts/harvest-track-a-report.ts:25-29`.
- *Change the manifest's `stage` to an object* — invalidates all 33 committed rows against `docs/RSA-Documents/corpus-schema.json:14-17` and both frozen reports (discovery §Q1.4, §Q5.4).

**Evidence.** `scripts/harvest-track-a.ts:534-546`; `docs/RSA-Documents/corpus-schema.json:14-17`; `scripts/harvest-track-a-report.ts:25-29,320-323`; discovery §Q1.4, §Q5.1–Q5.2.

**Consequence.** The `MULTI_STAGE` token disappears from the v2 view; the v1 token stays in the committed manifest. The v2 view is a *sidecar*, so nothing downstream has to learn the new shape.

---

## D4 — Confidence is an ordinal tier by evidence source, plus a dominance bonus, plus an ambiguity cap

**Context.** The ticket asks for a confidence on ambiguous documents and forbids a model or randomness.

**Decision.**
`scope_base`: `scope_region` 0.90 > `body` 0.70 > `title` 0.50 > `hint` 0.30.
`dominance_bonus` = 0.10 when the candidate's hits ≥ 2× the runner-up's (and the runner-up has >0 hits).
`candidate.confidence = clamp(scope_base + dominance_bonus, 0.01, 0.99)`.
`decision.confidence = kind==="single" ? primary.confidence : kind==="ambiguous" ? min(primary.confidence, 0.49) : 0`.

**Alternatives rejected.**
- *hits ÷ total hits* (the discovery prototype's ratio, §Q5.2) — a ratio says a document with 9 hits of one stage and 1 of another is "90% confident", which is false when the minority hit is the document's *own* scope and the majority is a taxonomy listing. The ordinal tier is not fooled by that.
- *A learned/calibrated score* — needs training data the repo does not have and is not deterministic across environments.

**Evidence.** `scripts/harvest-track-a.ts:539` (the 8000-char head that hides stage names); `scripts/harvest-track-a.ts:581,586-590` (`subjectRegion` — the repo's own "the document's own subject region" precedent); `src/lib/extract.ts:39` (the 200 000-char cap to mirror); discovery §Q2.2(e), §Q2.6, §Q5.2.

**Consequence.** The three regions (`scope_region` / `body` / `title`) are what implement "read the document BODY not only the title": v1 read only `text.slice(0, 8000)` (`scripts/harvest-track-a.ts:539`), which discovery §Q2.2(e) measured changing the answer on 5 of 7 committed CA reference PDFs.

---

## D5 — "Ambiguous" means no cell; the table shows the count both with and without ambiguous documents

**Context.** If an ambiguous document gets no cell, v2 can show *fewer* documents in cells than v1 — a coverage regression (discovery §Q7.1.4). If it silently keeps its primary cell, the table overclaims.

**Decision.** An ambiguous document has `cell_key = ""`. The coverage table reports **three** counts per cell: `v1`, `v2 (primary)` (ambiguous excluded), `v2 (incl. ambiguous)` (each ambiguous document counted at its primary candidate's cell). The difference between the last two columns is exactly the set needing human adjudication.

**Alternatives rejected.**
- *Ambiguous documents keep the primary cell* — forces a stage, which the ticket forbids.
- *Ambiguous documents are dropped from the table* — hides the decisions that need a human.

**Evidence.** Ticket requirement "never force a single stage"; `scripts/harvest-track-a.ts:541-543` ("A document naming several stages is not one cell's document"); `scripts/harvest-track-a.ts:523-527` (the stage→cell map is 1:1 for the three mapped stages, so cell-move and stage-move coincide except in the no-cell bucket); discovery §Q7.1.4, §Q2.6.

**Consequence.** The table can show a net *loss* without being wrong. §4 itemises every move in both directions and §7 says so in words.

---

## D6 — "Moved" is measured at the cell, with the stage-token change reported alongside

**Context.** The ticket asks "report how many documents move into which cells". The stage token is only a means to a cell.

**Decision.** Primary metric: `moved ⇔ v1_cell_key ≠ v2_cell_key`. The movement detail table also carries `v1 stage → v2 primary stage`, and a separate no-cell section carries the buckets where the stage changed but the cell did not (e.g. `PRE_OPENING → EXISTING`).

**Alternatives rejected.**
- *Stage-only* — hides `PRE_OPENING → EXISTING`, which is exactly the fix discovery §Q2.2(c) identified, and would look like "no movement".
- *Cell-only* — hides the same change for the reader who cares about stages.

**Evidence.** `scripts/harvest-track-a.ts:523-527`; `scripts/harvest-track-a-report.ts:25-29`; `scripts/harvest-track-a-report.ts:34` (`UNMAPPED_STAGES` = `existing, pre-opening, unknown, UNSTAGED, MULTI_STAGE, PRE_OPENING` — the no-cell vocabulary).

**Consequence.** One number to headline, no information lost.

---

## D7 — The v2 view of the corpus is a versioned sidecar; the committed manifest, schema and reports are not touched

**Context.** `stage` and `cell_key` are read in 12+ places (discovery §Q1.3) and `stage` has a JSON-schema enum (`docs/RSA-Documents/corpus-schema.json:14-17`). The manifest is the committed record of the corpus.

**Decision.** `docs/research/stage-rules/ambiguous-v2.jsonl` — one row per manifest row (33), carrying `stage_v1`, `cell_key_v1`, the v2 `kind`, the ordered `candidates` with confidences and rule ids, `primary`, `cell_key_v2`, `body_available`, `text_chars_scanned`. **Not modified:** `docs/RSA-Documents/**` (manifest, `corpus-schema.json`, `corpus-schema.md`, both reports, `track-a-coverage.md`, `track-a-split.json`, `canadian-download-log.tsv`), `policies/canada/pack.json`, `src/domain/**`, `state/odd-coverage.json`, `scripts/harvest-track-a.ts`, `package.json`.

**Alternatives rejected.**
- *Add `stage_v2` / `candidates` columns to the manifest* — mutates the committed corpus of record and invalidates its schema; forbidden by the ticket.
- *Regenerate the manifest under v2* — destroys the v1 baseline the comparison is against.

**Evidence.** `docs/RSA-Documents/corpus-schema.json:14-17`; `docs/RSA-Documents/corpus-schema.md:10`; `scripts/harvest-track-a.ts:190-217,1008-1030`; `scripts/discovery-coverage.ts:21,50` (`state/odd-coverage.json` comes from the discovery ledger, not the manifest); discovery §Q1.3, §Q5.2, §Q5.4.

**Consequence.** The v1 record stays byte-identical, so the earlier before/after comparisons stay valid — which is the ticket's stated reason for versioning.

---

## D8 — The re-run is a new CLI, `scripts/harvest-stage-rules-v2.ts`, with `fetch` and `compare`; `compare` never touches the network

**Context.** The corpus of record holds metadata only — the 33 manifest rows have no body text (verified: `Object.keys(rows[0])` has no text field). The bodies are re-fetchable (30/33 URLs HTTP 200 with content-length == committed `bytes`; the 9 T3 rows re-download to byte-identical sha256) but must not enter git (`.gitignore:75` "no bulk text to git"). The existing harvester has no classify-only mode: `fetch` writes into the gitignored shelf and `intake` **appends to the committed manifest** (`scripts/harvest-track-a.ts:1249-1251`), which would invalidate the v1 record.

**Decision.** New script with two subcommands:
- `fetch --manifest … --cache docs/RSA-Documents/canada/track-a/t62/` — robots-checked, host-budgeted, sha256-verified; per-row failure tolerated.
- `compare --rules <v2> --compare <v1> --manifest … --cache … --out … --json-out … --ambiguous-out …` — classifies every row under **both** rule sets in one run and writes the table, the JSON companion and the sidecar. A missing body ⇒ the row is classified from its **title** only and marked `body_available: false`.

`--rules` defaults to v2; `--compare` defaults to the frozen v1.

**Alternatives rejected.**
- *Add a `classify` mode to `scripts/harvest-track-a.ts`* — the harvester's `intake` writes the committed manifest; a mode there risks the v1 record for no benefit.
- *Re-run the whole harvest* — the harvest did not change; only the labelling did. Discovery §Q7.1.2 makes the same point: the honest operation is a re-classification of the same 33 documents.
- *Run it on the production box* — `oc-box` can push only `src/`, `tools/`, `tests/` and has no corpus access; the classifier is a `scripts/` artifact and `scripts/` is outside the pushable set. Discovery §Q3.d: local re-fetch is strictly simpler.

**Evidence.** `scripts/harvest-track-a.ts:9-11` (the harvest constraints), `:20-21` (robots + host-budget imports), `:762-788` (robots → crawl delay → fetch order), `:920-925` (`unpdf` extraction), `:1249-1251` (`intake` appends to the manifest); `src/discovery/ratelimit.ts:1-6,29-47` (1 req/s, 2 concurrent per host); `src/discovery/robots.ts`; `.gitignore:75-79`; `package.json:31` (`unpdf` already a dependency); discovery §Q3.b–Q3.d.

**Consequence.** No new dependency, no new framework, no app change. The pipeline is fully re-runnable offline from the cache; the committed artefacts carry the sha256 of the rule files and of the manifest so a reviewer can prove which inputs produced them.

---

## D9 — Determinism is enforced by sorting, by a pure renderer, and by having the JSON companion be the renderer's input

**Context.** The repo's precedent is a report that "carries no timestamp" and "regenerates byte-identically from the committed inputs" (`scripts/harvest-track-a-report.ts:357`, `tests/discovery/harvest-track-a-round2-report.test.ts:99,103`).

**Decision.** Manifest rows sorted by `sha256`; `candidates` sorted by `(-confidence, -hits, rule order, stage ASCII)`; the JSON companion is the **input** to `renderCoverageTable`, so the markdown and the JSON cannot disagree; no timestamps, no absolute paths, no hostnames in any output.

**Alternatives rejected.**
- *Render the markdown from the corpus directly* — then the markdown and the JSON are two independent renders and can drift; the byte-stability test would then need the network.
- *Include a generation timestamp* — breaks byte-stability, as the existing tests forbid.

**Evidence.** `scripts/harvest-track-a-report.ts:357`; `tests/discovery/harvest-track-a-round2-report.test.ts:99,103`; `tests/discovery/harvest-track-a-report.test.ts:251,255`; discovery §Q4.3.

**Consequence.** The "table is byte-stable and its counts match the companion" test (A6/iii) runs **offline** against the committed pair, and only the optional regeneration-from-cache check needs the network.

---

## D10 — One new test file; the three existing harvest test files are not edited

**Context.** The AC is "a test per new rule using real titles from the corpus". The existing suite already pins v1's behaviour (`tests/discovery/harvest-track-a.test.ts:68-89`, `tests/discovery/harvest-track-a-round2-report.test.ts:108-121`) and both frozen reports (`:251`, `:99`).

**Decision.** New file `tests/discovery/harvest-stage-rules-v2.test.ts` holding: one `it` per v2 rule id (the id is read from `stage-rules.v2.json`, so the AC is mechanically checkable); the frozen-v1 regression lock; the coverage-table byte-stability + companion-consistency test; the ambiguity test. The three existing files stay untouched.

**Alternatives rejected.**
- *Extend `tests/discovery/harvest-track-a.test.ts`* — the file that holds v1's contract would also hold v2's, and the v1/v2 vocabularies would be imported into one suite (discovery §Q6.2.2).
- *Edit the report tests to accommodate v2* — they are the guard that v1 did not move; weakening them is exactly the wrong direction.

**Ownership check.** `git log --format='%h %ad %an %s' -- tests/discovery/harvest-track-a*.test.ts scripts/harvest-track-a*.ts` returns only `5dcaddb` (Ahmed Kamel, #61) and `3bd03d5` (Ahmed Kamel, #58); `git branch -a` shows no other branch touching them. ⇒ low collision risk, and no reason to edit files a just-merged lane wrote.

**Evidence.** `tests/discovery/harvest-track-a.test.ts:14,68-89`; `tests/discovery/harvest-track-a-round2-report.test.ts:14,99,103,108-121`; `tests/discovery/harvest-track-a-report.test.ts:112-143,251,255,267`; discovery §Q6.1–Q6.3.

**Consequence.** #62 adds no risk to the v1 lane. `npm run test` must stay green with the new file included.

---

## D11 — The per-rule fixtures are the committed manifest titles plus the rule file's own cited evidence phrase; no corpus text is committed

**Context.** The AC says "a test per new rule using **real titles from the corpus**". The corpus binaries and text are git-ignored by doctrine (`.gitignore:75` "no bulk text to git"; `:79` `docs/RSA-Documents/**/*.pdf`). The committed Canadian **reference** PDFs (`docs/references/CA/*.pdf`, sha256 in `docs/references/CA/MANIFEST.md:11-17`) are *not* ignored and are the source of the vocabulary evidence.

**Decision.** Each per-rule test uses: (a) a **real committed corpus title** — the test reads `docs/RSA-Documents/canada-intake-manifest.jsonl` and asserts the title it used is in there; and (b) the **verbatim phrase the rule's own `evidence[0]` entry cites**, plus an assertion that the cited `source` file exists and the cited `page` is within that PDF's page count (`getDocumentProxy`, `scripts/harvest-track-a.ts:19` — page count only, no text extraction, so the test is fast). The corpus-text-dependent part of the v1 lock is asserted through the committed `coverage-v2-vs-v1.json.v1_reproduced` field instead of a committed text fixture.

**Alternatives rejected.**
- *Commit extracted text fixtures for the 9 T3 documents (~370 KB of body text)* — directly violates the repo's "no bulk text to git" doctrine.
- *Test the rules only against the CA reference PDFs* — those are not corpus members and cannot satisfy "real titles from the corpus".

**Corpus titles used (all verified present in the committed manifest):** row 1 "PLANNING STAGE" · row 9 "WAITEMATA GREENWAYS PRE-OPENING" · row 13 "CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project" · row 18 "Bessborough Housing Development Road Safety Audit – Stage 1" · row 19 "Stage 1 Road Safety Audit" · row 21 "ROAD SAFETY AUDIT STAGE 1: SPRINT SCHEME" · row 29 "Road Safety Audit Stage 1 -" · row 33 "COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS' RESPONSE" (the two-candidate case).

**Evidence.** `.gitignore:75,79`; `docs/references/CA/MANIFEST.md:11-17`; `scripts/harvest-track-a.ts:19`; `docs/RSA-Documents/canada-intake-manifest.jsonl` (33 rows, titles verified); discovery §Q6.2.

**Consequence.** The rule set is auditable offline: a reviewer can open `stage-rules.v2.json`, read the phrase and the page, open the PDF, and see the rule fire.

---

## D12 — The three contested mappings ship as two-candidate rules, and the ODD-matrix gap is a separate ticket

**Context.** Three stage mappings are unsettled by any committed source: "Functional Plan" (v1 → `FEASIBILITY_CONCEPT` at `scripts/harvest-track-a.ts:520`; `policies/canada/pack.json:43` → `PRELIMINARY_DESIGN`; pinned by `tests/discovery/harvest-track-a.test.ts:70`), "Concept design" (Good Roads p12/p43), and "avant-projet préliminaire" (QC p10/p12). Separately, 22 of the 30 Canadian T3/T4 documents on the operator's inventory are `existing` audits and there is **no** canonical cell for `existing` or `construction` (`policies/canada/pack.json:75-89`).

**Decision.** Ship the contested mappings as rules with `contested: true` and **two** `candidates` (`CA-AMBIG-FUNC`, `CA-AMBIG-CONCEPT`, `CA-AMBIG-AVP` in discovery §Q2.5, plus `CA-STAGE-PAIR` for "STAGE 1 AND 2"). Do **not** touch `policies/canada/pack.json`. File a separate ticket for the ODD-matrix gap and for the three human rulings.

**Alternatives rejected.**
- *Pick a side on "Functional Plan" now* — the repo contradicts itself and a test pins the current behaviour; picking a side is a policy ruling, not an engineering one.
- *Add `EXISTING`/`CONSTRUCTION` cells to the pack as part of #62* — the ticket explicitly excludes `policies/`; a pack change alters `src/domain/odd.ts:74-90` behaviour and every cell-scoped app surface.

**Evidence.** `scripts/harvest-track-a.ts:520`; `policies/canada/pack.json:43,61,75-89,96-97`; `tests/discovery/harvest-track-a.test.ts:70`; `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` (30 T3/T4 rows: `existing` 22, `unknown` 5, `detailed` 2, `pre-opening` 1); discovery §Q2.3, §Q7.1.3, §Q7.4.

**Consequence.** #62 delivers a *measured* classifier with an explicit ambiguity list; the actual coverage bottleneck (no cell for in-service audits) is surfaced, not silently absorbed. The two-candidate mechanism is exactly the ticket's "never force a single stage", so the un-ruled cases are shippable today.

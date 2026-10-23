# M1 fix round — ticket #62 (review CHANGES_REQUIRED)

- **Module:** M1 (`docs/research/stage-rules/stage-rules.v2.json`) — FIX round after `.autoforge/reviews/M1-t62.md`.
- **Scope touched:** `docs/research/stage-rules/stage-rules.v2.json`, `.autoforge/plans/plan-t62.md` (Amendment A appended), `tests/discovery/stage-rules.test.ts` (expectations only), this brief.
- **Not touched:** `stage-rules.v1.json` (frozen), `scripts/stage-rules.ts` (FIX 4 — no code change), `scripts/harvest-track-a.ts`, `docs/RSA-Documents/**`, `policies/**`, `src/**`, `state/**`, any other test file.
- **No network.** All PDF measurement used the committed `docs/references/CA/*.pdf` with `unpdf` 1.8.1 from throwaway scripts under `/tmp/m1fix/` (nothing extracted is committed).

## FIX-by-FIX

### FIX 1 — MAJOR-3, `CA-EXISTING` spaced spelling (APPLIED)
- Pattern changed: `in-?service` → `in[\s-]?service`, `post-?opening` → `post[\s-]?opening`. The **audit-noun alternation is kept** (`road|highway|corridor|facilit|review|audit`), so the negative trap *"leave the current end treatment in-service"* still yields no `EXISTING`.
- New attested evidence entry: **`post opening`** (UNB guidelines — measured: `3.4.5.4 post opening and in service (stage 5)`); it is matched by the widened alternative.
- Measured truth about the spaced form: the string `in service` occurs in the AB implementation plan ("once the roadway is in service"), the ON guideline ("this is an audit of a road already in service") and the UNB guidelines; the spaced **+ audit noun** form (`in service road`) has **0 occurrences** in the 7 committed PDFs (only the hyphenated `in-service road safety audits` is attested). Consequence, by design (the noun requirement the trap depends on): the bare two-word string `in service` on its own does **not** match; `in service road safety audit` does.

### FIX 2 — MAJOR-2, `CA-PRELIM-FR` / `CA-AMBIG-AVP` disjoint (APPLIED)
- `CA-PRELIM-FR` (tier 1) keeps the **named** forms `avant-projet pr[ée]liminaire` and `plans et devis pr[ée]liminaires`.
- `CA-AMBIG-AVP` (tier 2, pair `{FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN}`) now fires on the **bare** `avant-projet`: `avant-projet(?!\s+(?:pr[ée]liminaire|d[ée]finitif))` — a negative lookahead, so the two rules can never match the same phrase.
- `CA-AMBIG-AVP`'s evidence is now the bare form with **`attested:false`**: the unqualified form has **0 occurrences in all 7 committed reference PDFs** (measured 2026-10-22, `unpdf`); the 8 occurrences of the string `avant-projet` in the QC guide are all qualified (`avant-projet préliminaire` / `avant-projet définitif`). Honest flag kept, never a claimed attestation.
- Verified: `avant-projet` → `MULTI_STAGE`, `rule_ids=[CA-AMBIG-AVP]`, `inferred`, no cell; `avant-projet préliminaire` → tier-1 `CA-PRELIM-FR`, `canada:PRELIMINARY_DESIGN`, not ambiguous; `avant-projet définitif` → tier-1 `CA-DETAIL-FR`, `canada:DETAILED_DESIGN`, not ambiguous.

### FIX 3 — MAJOR-1 + the `CA-DETAIL-FR` leftover, v1-parity bare forms (APPLIED as decided)
- **Kept**: `pr[ée]liminaire` in `CA-PRELIM-FR` and `d[ée]taill[ée]e?\b` in `CA-DETAIL-FR` (v1's own literals, `scripts/harvest-track-a.ts:518-519`) — removing them would let a document **leave** a canonical cell (a v1→v2 coverage regression).
- **Sanctioned**: plan Amendment A §A.3 states the v1-parity rationale, the deliberate false-positive trade, and that `CA-PRELIM-TICKET` / `CA-DETAIL-TICKET` match their own strings (`conception préliminaire` / `conception détaillée`), still fire, and still have their rule ids recorded.
- **Evidenced** (measured with `unpdf`, 2026-10-22):
  - `CA-PRELIM-FR` → new entry `préliminaire`, QC guide, **attested:true** — the standalone word occurs 8× in the QC guide (7 inside `avant-projet préliminaire`, 1 standalone: `préliminaire de l'ordre de déplacement`).
  - `CA-DETAIL-FR` → new entry `analyse détaillée`, QC guide, **attested:true** — the only occurrence of `détaillée` in the 7 committed PDFs, in the QC guide's **negative disclaimer** (`l'audit n'est pas une analyse détaillée d'accidents`). The quote is attested; its context is a disclaimer, not a stage label — disclosed in the entry's note.

### FIX 4 — NO CLASSIFIER CHANGE (APPLIED as a plan line)
`scripts/stage-rules.ts` is **not** touched. Amendment A §A.1 records that the bare stage-ordinal refinement is the classifier's hard-coded `BARE_STAGE_ORDINAL` — part of the confidence doctrine (D1 / ADR-0002), not a rule — so the rule set stays a pure stage-vocabulary artefact (covered by M2's tests 2 and 5).

### FIX 5 — MINOR-2, `CA-AMBIG-PCT` caption (APPLIED)
The evidence entry's note now says the attested occurrence of `75% design` is a **UNB figure caption** (`… Photo 24. Pole in pedestrian path … 75% DESIGN STAGE -NEW FACILITY ROUTE 20 HIGH SPEED CONNECTOR …`), not prose, and that the plan's 17-word AB sentence is **not** claimed as attested. Amendment A §A.4 carries the same correction.

### FIX 6 — NIT-1, `CA-PCT-DETAIL` re-check (VERIFIED, no change)
Pattern: `(?:9\d|100)\s*%[\s\S]{0,60}?(?:design|de[ée]tail|d[ée]taill|plan)` — the design noun must **follow** the percentage inside the 60-char window. Measured: `90 % of the design` → **true**; `design 95%` → **false** (noun before the number does not count); `50 % of the daily bus volume at 60 km/h` → **false** for both `CA-PCT-DETAIL` and `CA-AMBIG-PCT`; `60 km/h` alone → no candidate.

### FIX 7 — M2 test expectations (APPLIED, count still 28)
Only the expectations the rule changes genuinely invalidate were touched; every change **strengthens** a test:
- `CA-AMBIG-AVP` — re-pointed at the rule's new trigger: bare `avant-projet` → contested pair, `rule_ids == ["CA-AMBIG-AVP"]`, `inferred`, no cell; the evidence entry is asserted **`attested:false`** (honesty flag, never an attestation); added: the two qualified forms are tier-1 and never reach the tier-2 rule. The QC-guide assertion for `avant-projet préliminaire` is kept.
- `CA-EXISTING` — added: `in service road safety audit` and `post opening` → `EXISTING`.
- `CA-PRELIM-FR` / `CA-DETAIL-FR` — added: the retained v1-parity bare forms still land in `canada:PRELIMINARY_DESIGN` / `canada:DETAILED_DESIGN`.
- No test deleted or weakened; the v1-freeze, v1-behavioural, determinism, classifier-unit and all four negative-trap tests are untouched.

### FIX 8 — Plan amendment (APPLIED)
`.autoforge/plans/plan-t62.md` §9 "Amendment A — M1 review fix round (CHANGES_REQUIRED, resolved)": FIX 1–6 table, the five amended rule-table rows (CA-EXISTING, CA-PRELIM-FR, CA-DETAIL-FR, CA-AMBIG-AVP, CA-AMBIG-PCT), the French-split line, the v1-parity rationale, the corrected percentage-ladder paragraph, and the test-expectation table. Nothing above §9 was rewritten.

## Real command output

### 1. `npx vitest run tests/discovery/stage-rules.test.ts`

```
 RUN  v3.2.7 /home/oc/.opencode-runs/Akamel01-AuditorAI/62/worktree

stderr | tests/discovery/stage-rules.test.ts > stage rules — one test per v2 rule id (ticket #62 M2.3, group 1) > CA-FEAS — the corpus title row 1 and the AB guidelines attest 'planning stage'
Warning: UnknownErrorException: Ensure that the `standardFontDataUrl` API parameter is provided.

 ✓ tests/discovery/stage-rules.test.ts (28 tests) 1602ms

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Start at  08:19:06
   Duration  2.07s (transform 182ms, setup 87ms, collect 158ms, tests 1.60s, environment 0ms, prepare 56ms)
```

### 2. `npm run lint` and `npm run typecheck`

```
> auditorai@0.1.0 lint
> eslint .

=== LINT EXIT: 0 ===

> auditorai@0.1.0 typecheck
> tsc --noEmit

=== TYPECHECK EXIT: 0 ===
```

### 3. Re-attestation sweep over all evidence entries (57 — 54 before this round + 3 added)

```
--- counts ---
evidence entries total = 57
reference-doc attested=true: 46 | found in doc: 46 | missing: 0
reference-doc attested=false: 1 | NOT found (or bare-form absent): 1 | false-attestation risk: 0
corpus entries: 7 | sha present in manifest: 7 | attested=true with title hit: 5 | attested=false (fetch-time): 2
ticket-declared entries: 3 | attested=false: 3 | attested=true (must be 0): 0
evidence phrase matched by its own rule's pattern: 57 | not matched: 0
```

The one `attested:false` reference-doc entry is `CA-AMBIG-AVP` / `avant-projet`: the **bare** (unqualified) form was measured at 0 occurrences in all 7 PDFs (`bareHits=0`), so the flag is honest; the 3 ticket-declared entries stay `attested:false`; the 2 `attested:false` corpus entries are the fetch-time (M4) bodies.

### 4. Trap / behaviour probes (classifier, v2)

```
mise en service                                      => stage=UNSTAGED candidates=[] cell=""
in service road safety audit (SPACED)                => stage=EXISTING candidates=[CA-EXISTING] cell=""
in-service road safety audit (hyphen)                => stage=EXISTING candidates=[CA-EXISTING] cell=""
post opening (SPACED)                                => stage=EXISTING candidates=[CA-EXISTING] cell=""
post-opening (hyphen)                                => stage=EXISTING candidates=[CA-EXISTING] cell=""
already in service (ON attested)                     => stage=EXISTING candidates=[CA-EXISTING] cell=""
TRAP: leave the current end treatment in-service     => stage=UNSTAGED candidates=[] cell=""
TRAP: bare 'in service' (no audit noun)              => stage=UNSTAGED candidates=[] cell=""
TRAP: 50 % bus volume + 60 km/h                      => stage=UNSTAGED candidates=[] cell=""
TRAP: 50 % alone                                     => stage=UNSTAGED candidates=[] cell=""
TRAP: 60 km/h alone                                  => stage=UNSTAGED candidates=[] cell=""
TRAP: final design                                   => stage=UNSTAGED candidates=[] cell=""
avant-projet (BARE)                                  => stage=MULTI_STAGE candidates=[CA-AMBIG-AVP,CA-AMBIG-AVP] cell=""
avant-projet préliminaire (qualified)                => stage=PRELIMINARY_DESIGN candidates=[CA-PRELIM-FR] cell="canada:PRELIMINARY_DESIGN"
avant-projet définitif (qualified)                   => stage=DETAILED_DESIGN candidates=[CA-DETAIL-FR] cell="canada:DETAILED_DESIGN"
rapport préliminaire (v1-parity bare)                => stage=PRELIMINARY_DESIGN candidates=[CA-PRELIM-FR] cell="canada:PRELIMINARY_DESIGN"
analyse détaillée (v1-parity bare)                   => stage=DETAILED_DESIGN candidates=[CA-DETAIL-FR] cell="canada:DETAILED_DESIGN"

--- per-rule regex probe (direct) ---
CA-EXISTING  "in service"           -> false
CA-EXISTING  "in service road"      -> true
CA-EXISTING  trap "in-service" end   -> false
CA-PCT-DETAIL "50 % of bus volume"   -> false
CA-AMBIG-PCT  "50 % bus volume"      -> false
CA-PCT-DETAIL "90 % of the design"   -> true
CA-PCT-DETAIL "design 95%"           -> false
```

### 5. `git status --porcelain` and `git diff --stat`

```
$ git status --porcelain
?? docs/research/stage-rules/
?? scripts/stage-rules.ts
?? tests/discovery/stage-rules.test.ts

$ git diff --stat
(empty - no tracked file was modified)
```

- The three `??` paths are the **untracked artefacts of the M1/M2 rounds**; this round edited the v2 JSON and the test file *inside* those untracked paths, so they still show as one untracked directory/file each.
- This round's other two files — `.autoforge/plans/plan-t62.md` (Amendment A) and `.autoforge/execution/M1-fix-t62.md` (this brief) — do **not** appear in `git status` because the whole `.autoforge/` tree is excluded in this worktree (`git check-ignore -v` → `/home/oc/repos/AuditorAI/.git/info/exclude:7:.autoforge/`, reinforced by `.gitignore:57` `.autoforge/*`; every other `t62` artefact — `M1-t62.md`, `M2-t62.md`, `work-order-t62.json` — is in the same state). They are written and complete; they are the curated `plans/` + `execution/` artefacts of `.autoforge/AGENTS.md`, landed by the ticket's commit lane, not by this round (this round runs no `git add` / `commit` / `push`).
- `git diff --stat` empty ⇒ **no tracked file was modified by this round**: `scripts/stage-rules.ts`, `docs/research/stage-rules/stage-rules.v1.json`, `scripts/harvest-track-a.ts`, `docs/RSA-Documents/**`, `policies/**`, `src/**`, `state/**` and every other test file are byte-identical.

## Not done / caveats

1. **The bare `avant-projet` is not attested anywhere** (0 hits in all 7 committed reference PDFs, measured 2026-10-22) → `CA-AMBIG-AVP` ships `attested:false` as instructed, with the measurement in the entry's note. It cannot be attested without the corpus fetch (M4).
2. **The spaced `in service` needs the audit noun.** The instruction kept the noun requirement (it is what makes the negative trap hold), so the two-word string `in service` alone does not match; `in service <road|highway|corridor|facilit|review|audit>` does, and the attested spaced instance of the reference set is covered by the `already in service` alternative. The spaced+`road` combination itself has 0 occurrences in the committed PDFs — reported, not claimed.
3. **The `analyse détaillée` attestation is a negative-context quote** ("the audit is not a detailed accident analysis"). The quote is attested; the note says so, and the plan says so. No stage-label claim is made for it.
4. **The v1-parity bare forms keep the false-positive family the review named** (`rapport préliminaire`, `phase préliminaire`, `analyse détaillée` → tier-1 stages). This is the decided trade-off (coverage over precision); it is sanctioned in Amendment A §A.3 and disclosed in each rule's note.
5. **`CA-PRELIM-TICKET` / `CA-DETAIL-TICKET`**: they still fire on their own strings and their rule ids are still recorded, but the retained bare v1-parity forms also match those strings, so they are no longer the *only* rule firing there. Recorded in Amendment A §A.3 rather than the plan's shorthand "not shadowed".
6. **`scripts/stage-rules.ts` untouched** (FIX 4) — the `BARE_STAGE_ORDINAL` refinement stays in the classifier.

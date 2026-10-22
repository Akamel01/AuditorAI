# M7b — honesty fixes to the Track A harvest report (ticket #40, branch `oc/40`)

Role: autoforge-worker. Binding contract: `.autoforge/execution/loop6-m7b-contract.md` (fixes F1-F7).
Findings applied: `.autoforge/validation/loop6-investigation.md` (M1-M8) and `.autoforge/reviews/M7.md`
(note 3, note 5). Deterministic and offline: no network, no model/LLM call, no fetch, no intake.
M6a / M6b / M7 / M7-fixes were **not** redone — only the files the contract allows were touched.

Commit: `af4489f` — `fix(harvest): honesty fixes M7b (F1-F7) to the Track A harvest report (#40)`
(local only; **not** pushed, no PR).

## What changed, per fix

### F1 (M1) — the licence dimension of a coverage candidate

- `scripts/harvest-track-a-report.ts` reads `docs/RSA-Documents/LICENSE-REGISTER.md` and parses it
  into a directory -> verdict map (`parseLicenceRegister`, new export). A candidate's licence state is
  the manifest's `licence_verdict` for a fetched document, else the register's verdict for the
  directory the file sits in (`licenceForPath`, new export). A directory the register does not list
  is **`unknown`** — never CLEAR.
- The section-1 table gained the column **`Have (usable, CLEAR only)`** and every candidate line
  carries `licence \`…\``, its directory and whether it is under the corpus root.
- The rules block and a new paragraph after the table state that a candidate whose licence is not
  CLEAR is **not usable for train or test until the owner signs off**, and that such candidates are
  **counted, not dropped** (the corpus's `canada/` shelf is RESTRICTED pending sign-off, so dropping
  them would zero every cell).
- Result for the two candidates: `a24707c6…` (on-disk, `docs/RSA-Documents/canada/canadian/`) is
  **RESTRICTED** -> usable 0; `0af7ea58…` (fetched, ab-open) is **CLEAR** -> usable 1. The
  `Have (documents)` counts are **unchanged** (1 / 0 / 1) — the licence is disclosed, not applied as
  a filter.

### F2 (M4 + M2) — label provenance and the corpus root

- The rules block now states that every inventory label is machine-derived and not audited
  (**anchor 4, needs_review 134, rule 166 of 304** rows) and that the coverage counts inherit that.
- The section-1 table gained the column **`Candidate labels`** — the per-cell breakdown of the
  candidates' label confidence (`needs_review 1` / `none` / `anchor 1`).
- The row sets are split by corpus membership: **|A| = 305 = 203 under the corpus root + 102
  outside it**; **|B| = 147 = 128 under + 19 outside**; the 102 outside rows are
  `docs/references` (22), `tests/fixtures` (77), `tmp/harvest` (3) and the corpus root holds the
  other 202 inventory rows.
- The candidate that is a **test fixture** is named explicitly, with the ingested copy it is
  byte-identical to: `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf` is
  byte-identical to `docs/RSA-Documents/canada/track-a/ab-open/neahdappendixc.pdf` — that is why the
  cell reads `On disk 0 | Fetched 1`.
- A new "Population sensitivity" line reports the corpus-root cut of the in-scope share
  (**1 of 128 = 0.8 %**).

### F3 (M3) — a manifest-only row is not always a sample

- `manifestClass(tier)` (new export) classifies a manifest-only row from the fields the manifest
  actually carries: **T3/T4 -> `rsa-sample`, T1 -> `methodology`, T0 -> `unusable`**. The builder no
  longer hard-codes `klass: "rsa-sample"` for a manifest-only row.
- Effect: the manifest-only row `84a70638…` (`t02-04b.pdf`, `tier: T1`, `doc_type: guide`,
  `stage: UNSTAGED`) is now **methodology**, not `rsa-sample` — the two halves of the BC technical
  circular are counted in the same class again. The **inventory classification rules are untouched**.

### F4 (M5) — where a fetched label came from

- The section-4 table gained the columns **`stage from`** and **`tier from`** (`hint` / `rule`).
  `hint` = the value equals the source's fallback: the stage equals the source's `stage_hint`, or
  the tier is T3 under a source with `doc_type_hint: complete-RSA` (which forces T3,
  `scripts/harvest-track-a.ts:478`).
- The counts are stated: **3 of 3** fetched rows carry their source's `stage_hint` verbatim and
  **1 of 3** carry tier T3 from the `complete-RSA` hint. The report says plainly that the manifest
  does not record which path was taken, so `hint` marks a *possible* fallback, not a proven one.
- The coverage counts are **unchanged** — F4 is disclosure, not exclusion.

### F5 (M6) — "never re-downloaded" was false

- `.autoforge/execution/M6b.md` now says **never re-ingested** and gives the numbers: the hash gate
  runs after the bytes arrive, so **3 documents were downloaded in full and discarded in the M6b
  round**, and the committed outcome blocks record **10** such downloads in total
  (ab-open 1, ab-publications 2, ab-publications-listing 3, bc-moti 4).
- The four `outcome.note` blocks in `docs/RSA-Documents/track-a-sources.json` that record a
  `hash-already-present` skip (ab-open, ab-publications, ab-publications-listing, bc-moti) now say
  the same thing with their own count. Only the note wording was touched; no counter, no source
  entry and no other block was changed.

### F6 (M7) — the duplicates register is partial

- The fetched-only section (section 4) now says that
  `docs/RSA-Documents/track-a-duplicates.json` holds only the **2** rows staged before the hash skip
  moved ahead of staging, that the register is **partial**, and that the committed outcome blocks
  record **10** fetch-time `hash-already-present` skips that never reached it.

### F7 (M8) — the two coverage artefacts must not contradict each other

- The report names both files and the difference: `docs/RSA-Documents/track-a-coverage.md` is the
  **fetched-only** view, `docs/RSA-Documents/track-a-harvest-report.md` is the **inventory-first**
  view, and for `canada:DETAILED_DESIGN` the first reads 0 while this one reads 1 because the one
  candidate is an on-disk document the fetched-only view cannot see.
- `.autoforge/execution/M6b.md:51-53` no longer states a bare "`canada:DETAILED_DESIGN` 0 / 41": the
  line is now explicitly the fetched-only view and names the inventory-first number next to it.

### Review notes applied while in there

- **M7 note 3** — section 4 now carries the aggregate licence breakdown of the manifest rows
  (`CLEAR 1, RESTRICTED 2`).
- **M7 note 5** — the committed have-counts are now pinned by literal assertions
  (`canada:FEASIBILITY_CONCEPT` 1/1/0/1, `canada:DETAILED_DESIGN` 1/0/1/0,
  `canada:PRELIMINARY_DESIGN` 0, gap 41), and a manifest-only candidate has a positive test.
- **M7 note 7 (latent)** — candidates are counted over a sha256 set, so a sha repeated in several
  inventory rows can no longer be counted twice in a cell. No number changes today (the check in the
  M7 review stands: no sha has two candidate rows).

## Every number that changed — old -> new

Nothing changed silently. Numbers that exist in both the old and the new report and are **identical**
are not listed (|A| = 305, |B| = 147, Have 1 / 0 / 1, On disk 0 / 0 / 1, Fetched 1 / 0 / 0, Gap
12 / 41 / 40, in-scope share "2 of 147 (1.4 %)", the tier cross-tab T0 89 / T1 28 / T3 23 / T4 7,
the section-2 stage counts, the section-7 cross-check, 13 unfillable families, the split
disjointness check PASS 3/0).

### Changed (the counting rule changed — F3)

| number | old | new | why |
|---|---:|---:|---|
| 3a class `methodology` | 27 (8.9 %) | **28 (9.2 %)** | F3: the manifest-only T1 row `84a70638…` moves from `rsa-sample` to `methodology` |
| 3a class `rsa-sample` | 60 (19.7 %) | **59 (19.3 %)** | F3, same row |
| 3b class `methodology` | 24 (16.3 %) | **25 (17.0 %)** | F3, same row |
| 3b class `rsa-sample` | 55 (37.4 %) | **54 (36.7 %)** | F3, same row |

### New numbers (no old value — the report gained a column or a block)

| number | value | where |
|---|---:|---|
| `Have (usable, CLEAR only)` per cell | FEASIBILITY **1**, PRELIMINARY **0**, DETAILED **0** | section 1 table (F1) |
| `Candidate labels` per cell | `needs_review 1` / `none` / `anchor 1` | section 1 table (F2) |
| inventory corpus split | **202** under the corpus root / **102** outside | inputs block (F2) |
| outside-corpus groups | `docs/references` **22**, `tests/fixtures` **77**, `tmp/harvest` **3** | rules block (F2) |
| \|A\| corpus split | **203** under / **102** outside | row sets (F2) |
| \|B\| corpus split | **128** under / **19** outside | row sets (F2) |
| label confidence | `anchor` **4**, `needs_review` **134**, `rule` **166** of **304** | rules block (F2) |
| population sensitivity | **1** of **128** corpus-root rows (**0.8 %**) | section 3 (F2) |
| manifest licence breakdown | `CLEAR` **1**, `RESTRICTED` **2** | section 4 (F1 / note 3) |
| stage provenance | **3 of 3** stage `hint`; **1 of 3** tier `hint` | section 4 (F4) |
| duplicates register rows | **2** | section 4 (F6) |
| fetch-time hash skips | **10** | section 4 (F6) |

### Numbers in the briefs (M6b.md)

| number | old | new |
|---|---:|---:|
| documents downloaded and discarded, M6b round | (not stated; implied 0 transfers) | **3** |
| documents downloaded and discarded, all committed outcome blocks | (not stated) | **10** |
| `canada:DETAILED_DESIGN` in the M6b brief | `0 / 41` (no cross-reference) | fetched-only view `0 / 41` **and** inventory-first view `1` (on-disk candidate, RESTRICTED -> not usable until sign-off) |

## Verify (all green, offline)

```
$ npx vitest run tests/discovery/harvest-track-a-report.test.ts
 ✓ tests/discovery/harvest-track-a-report.test.ts (39 tests) 14ms
 Test Files  1 passed (1)
      Tests  39 passed (39)

$ npx tsx scripts/harvest-track-a-report.ts
wrote docs/RSA-Documents/track-a-harvest-report.md (17007 bytes)

$ git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md
(no output — exit 0, the committed report is byte-reproducible and carries no timestamp)

$ npm run typecheck
> tsc --noEmit
(clean)

$ npm run lint
> eslint .
(clean)

$ npm test
 Test Files  70 passed (70)
      Tests  735 passed | 2 skipped (737)
```

The report is 17007 bytes (was 11267) and still carries no timestamp
(`fresh` is asserted not to match /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).

`node scripts/vault-sync.mjs --check` cannot run in this container — the script creates a temporary
`git worktree` and `git-lfs` is not installed here (same limitation as M6b / M7). This lane stages
no `vault/` file and no `state/vault-notes.json`; the pre-commit hook's vault step passed.

## Files

- `scripts/harvest-track-a-report.ts` — the builder: licence register, label confidence, corpus
  membership, manifest-only classification, stage/tier provenance, the two new table columns.
  `buildReport(inventory, manifest, coverage, context)` now takes a `ReportContext`
  (`{ sources, unfillable, licence, duplicates }`) instead of the bare unfillable array.
- `tests/discovery/harvest-track-a-report.test.ts` — 39 tests (was 23): the new rules, the pinned
  have-counts, the licence register parsing, the manifest-only classification, F1/F2/F4/F6/F7
  assertions.
- `docs/RSA-Documents/track-a-harvest-report.md` — regenerated, byte-reproducible, no timestamp.
- `docs/RSA-Documents/track-a-sources.json` — outcome-block wording only (4 `outcome.note` strings).
- `.autoforge/execution/M6b.md` — the F5 and F7 corrections.
- `.autoforge/execution/M7b.md` — this brief.

## Not done / out of scope (disclosed, not built)

- **`.autoforge/plans/plan-loop6.md`** — the PR-body skeleton still says "no hash re-downloaded".
  The file is not in the contract's allowed list, so the claim is corrected in the M6b brief and in
  the outcome blocks only; the orchestrator must fix the skeleton before the PR is opened.
- **Excluding hint-derived rows from coverage** (the investigator's M5 wording) is not done: the
  contract's F4 asks for disclosure and the counts to stay, so `have` keeps counting the
  hint-derived rows and section 4 says how many there are.
- **A committed round log of the fetch-time hash skips** (the investigator's M7 fix option, and the
  M6 review's N2) is not built: it needs a new register and a change in
  `scripts/harvest-track-a.ts` (the fetch path), which the contract forbids. The report and the
  briefs carry the counts instead.
- **The `anchor` label's own provenance** — `a24707c6…` is the only `anchor` row and its
  `anchor:HARVESTING_PLAN.md#s1` citation points at a file that is absent from this repo, so the
  anchor cannot be re-derived here. The report shows the label confidence (`anchor 1`) but does not
  claim the anchor is verified.
- **M7 notes 6, 8, 9 and 10** (derive the stage maps from `pack.json`; resolve the repo root from
  the module path; the stale citation in `.autoforge/execution/M7.md`; the 3b heading) are optional
  and were left alone — note 9's file is not in the allowed list.
- The investigation's minor findings **m1** (the `pack.json` citation is partial) and **m2**
  (province detection is a first-mention guess) are not addressed here: they need
  `scripts/harvest-track-a.ts` or the manifest schema, which the contract forbids.

## Staging

`git add` with explicit paths only. `state/production-harvest-proof.json` and
`.autoforge/state.json` are **foreign-lane** modifications and were **not** staged. No `vault/`
file, no `state/vault-notes.json`, no binary, no push, no PR.

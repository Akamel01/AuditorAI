# M7b re-review — honesty fixes F1-F7 (investigator findings M1-M8)

**VERDICT: APPROVED_WITH_NOTES**

Scope reviewed: `oc/40`, commits `af4489f` (fix) and `a89efcf` (brief). Contract:
`.autoforge/execution/loop6-m7b-review-contract.md`; fixes requested in
`.autoforge/execution/loop6-m7b-contract.md`; findings answered in
`.autoforge/validation/loop6-investigation.md`.

Method (read-only; the only file written is this review): I re-derived every number in the report from
the committed inputs with an independent python recompute (`/tmp/m7b/recompute.py`, no repo code), I
re-generated the **old** report from the pre-fix script in an isolated `/tmp` tree to prove which numbers
moved, and I ran the gates. No network, no model call, no commit, no push.

Commands I ran (all offline): `npx vitest run tests/discovery/harvest-track-a-report.test.ts` (39/39 pass);
`npx tsx scripts/harvest-track-a-report.ts` + `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md`
(clean, byte-identical); `npm run typecheck` (clean); `npm run lint` (clean); `npm test` (70 files, 735
passed / 2 skipped — matches `.autoforge/execution/M7b.md:171-172`). The generator writes only the report
(`scripts/harvest-track-a-report.ts:657`) and reads only committed files (`:634-649`).

---

## F1-F7 — each fix is present, correct and independently reproduced

| Fix | Where | Evidence | Result |
|---|---|---|---|
| **F1** licence dimension | `scripts/harvest-track-a-report.ts:169-196` (register parse + path->verdict), `:253`, `:394`, `:411`; report `:20`, `:31-35`, `:41`, `:48-49` | candidate `a24707c6…` -> `RESTRICTED` (register row `docs/RSA-Documents/LICENSE-REGISTER.md:10` `canadian` -> RESTRICTED); candidate `0af7ea58…` -> `CLEAR` (manifest verdict, = register row `canada/track-a/ab-open` CLEAR, `LICENSE-REGISTER.md:24`) | **met.** New column `Have (usable, CLEAR only)` = 1 / 0 / 0; `Have (documents)` = **1 / 0 / 1 — not zeroed**; unlisted dir -> `unknown` (unit test `tests/discovery/harvest-track-a-report.test.ts:211-214`); "not usable for train or test until the owner signs off" stated twice (report `:20`, `:41`) |
| **F2** labels + corpus root | report `:21`, `:22`, `:26-27`, `:43`, `:48-50`, `:98`; script `:324-330`, `:365-372`, `:376-379`, `:511` | `anchor 4, needs_review 134, rule 166 of 304` (my tally over the 304 inventory rows); \|A\| 305 = 203 under / 102 outside; \|B\| 147 = 128 under / 19 outside; outside groups `docs/references 22, tests/fixtures 77, tmp/harvest 3`; fixture `0af7ea58…` named at `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf` with the byte-identical ingested copy `docs/RSA-Documents/canada/track-a/ab-open/neahdappendixc.pdf` (same sha256 in inventory **and** manifest) | **met** (see non-blocking #3 for the class-table cut) |
| **F3** manifest-only classification | `scripts/harvest-track-a-report.ts:203-207`, `:264`; report `:16` | `manifestClass(tier)`: T3/T4 -> `rsa-sample`, T1 -> `methodology`, T0 -> `unusable`. The one manifest-only row `84a70638…` (`t02-04b.pdf`, tier T1, `doc_type: guide`) is now `methodology` | **met.** The four changed numbers are exactly the consequence (see below) and nothing else |
| **F4** label provenance | report `:23`, `:113-117`, `:123`; script `:308-318`, `:552-556` | `stage from` / `tier from` columns present; **3 of 3** stage == source `stage_hint` (ab-open FEASIBILITY_CONCEPT, bc-moti UNSTAGED x2); **1 of 3** tier T3 under `doc_type_hint: complete-RSA` (`scripts/harvest-track-a.ts:478` is the cited rule, exact). The report states that `hint` is a *possible* fallback, not a proven one | **met** |
| **F5** "never re-downloaded" | `.autoforge/execution/M6b.md:34-41`; `docs/RSA-Documents/track-a-sources.json:61, 91, 124, 158`; report `:125` | wording is now "never re-ingested, never written to disk" in all four outcome notes + M6b.md + the report; counts: **3** in the M6b round (`M6b.md:37`) and **10** total (my sum of `m6_skipped_hash_already_present` = 1+2+3+4). I confirmed the mechanism: `scripts/harvest-track-a.ts:539-541` fetches, `:561` hashes, `:562-566` skips — the bytes arrive first, so the transfer really happened | **met** (see non-blocking #1, #2) |
| **F6** duplicates register partial | report `:125` | "holds only the **2** rows staged before the hash skip moved ahead of staging … The register is **partial** — it does not mean 'only 2 duplicates ever existed'"; the 10 fetch-time skips are named. Register row count verified: `track-a-duplicates.json` = 2 | **met** |
| **F7** the two coverage artefacts | report `:45`; `.autoforge/execution/M6b.md:57-66` | the report names `track-a-coverage.md` as the **fetched-only** view and itself as the **inventory-first** view and explains the `canada:DETAILED_DESIGN` 0-vs-1 delta; `track-a-coverage.md:13` does read `canada:DETAILED_DESIGN | 41 | 0 | 0 | 3`, and M6b.md:61-66 now gives both numbers | **met** |

---

## Numbers — independently recomputed, every figure reproduces

Recompute from `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` (304 rows),
`docs/RSA-Documents/canada-intake-manifest.jsonl` (3 rows), `state/odd-coverage.json`,
`docs/RSA-Documents/track-a-sources.json`, `docs/RSA-Documents/LICENSE-REGISTER.md`,
`docs/RSA-Documents/track-a-duplicates.json` (my python re-implementation of the merge/class rules,
not the repo code):

| Report figure | Report line | My recompute |
|---|---|---|
| \|A\| = 305 (203 corpus / 102 outside) | `:26` | 305 = 203 + 102 ✔ |
| \|B\| = 147 (128 corpus / 19 outside) | `:27` | 147 = 128 + 19 ✔ |
| label confidence `anchor 4, needs_review 134, rule 166` of 304 | `:21` | ✔ |
| outside groups 22 / 77 / 3 | `:22` | ✔ |
| 3a `duplicate 36, methodology 28, out-of-scope 125, rsa-sample 59, unusable 57` | `:79-83` | ✔ (shares 11.8 / 9.2 / 41.0 / 19.3 / 18.7 %) |
| 3b `duplicate 11, methodology 25, rsa-sample 54, unusable 57` | `:89-92` | ✔ (7.5 / 17.0 / 36.7 / 38.8 %) |
| coverage `FEASIBILITY 1 (usable 1, on-disk 0, fetched 1, gap 12)`, `PRELIMINARY 0 (gap 41)`, `DETAILED 1 (usable 0, on-disk 1, gap 40)` | `:33-35` | ✔ (targets 13 / 41 / 41, priorities 0.9231 / 3 / 3 from `state/odd-coverage.json`) |
| candidate labels `needs_review 1` / `none` / `anchor 1` | `:33-35` | ✔ |
| unmapped stages `existing 78/59, pre-opening 5/4, unknown 175/56, UNSTAGED 2/2` | `:60-65` | ✔ |
| tier cut of B `T0 89, T1 28, T3 23, T4 7` | `:104-107` | ✔ |
| in-scope `2 of 147 (1.4 %)`; corpus-root cut `1 of 128 (0.8 %)` | `:96`, `:98` | ✔ |
| section 7 cross-check `146 rows; class 11/24/54/57; stage 15/59/3/4/8/57; tier 91/26/22/7` | `:165-168` | ✔ and identical to `docs/RSA-Documents/track-a-ondisk-summary.json` (also asserted by the test at `tests/discovery/harvest-track-a-report.test.ts:416-436`) |
| manifest: stage provenance 3/3 hint, tier 1/3 hint, licence CLEAR 1 / RESTRICTED 2, split check PASS 3/0 | `:119-123` | ✔ |
| duplicates register 2 rows; fetch-time hash skips 10 | `:125` | ✔ |

**The four changed class numbers are the only numbers that moved.** I re-generated the *pre-fix* report
from the old script (`git show cc0fcd6:scripts/harvest-track-a-report.ts`) in an isolated `/tmp` tree
(`/tmp/m7b/oldrun`, `tsx` from the repo's `node_modules`) and diffed it against the committed report:
the only changed digits are 3a `methodology 27 -> 28`, 3a `rsa-sample 60 -> 59`, 3b `methodology 24 -> 25`,
3b `rsa-sample 55 -> 54` — exactly the F3 consequence (the manifest-only T1 row moves out of `rsa-sample`).
Everything else in the diff is additive disclosure or a new column. The old file is 11 267 code units
(11 339 bytes) and the new one 17 007 code units (17 115 bytes) — the brief's "was 11267 / is 17007" is
right in characters.

**Reproducibility**: `npx tsx scripts/harvest-track-a-report.ts` -> `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md`
is clean; the regenerated file is byte-identical to the committed one; the report contains no
date/time string at all (grep for `[0-9]{4}-[0-9]{2}-[0-9]{2}` -> no match; the test also asserts
`not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)`, `tests/discovery/harvest-track-a-report.test.ts:255-257`).

**Containment**: `git diff --name-only cc0fcd6..af4489f` = 5 files, all inside the contract's allowed list
(`scripts/harvest-track-a-report.ts`, `tests/discovery/harvest-track-a-report.test.ts`,
`docs/RSA-Documents/track-a-harvest-report.md`, `docs/RSA-Documents/track-a-sources.json`,
`.autoforge/execution/M6b.md`); `a89efcf` adds only `.autoforge/execution/M7b.md`. `git diff --stat
913b4ba..a89efcf -- state/ docs/RSA-Documents/track-a-ondisk-inventory.jsonl docs/RSA-Documents/track-a-ondisk-summary.json`
is **empty** -> the inventory, the summary, `state/odd-coverage.json` and every `state/` file are untouched;
`state/production-harvest-proof.json` and `.autoforge/state.json` are dirty in the worktree but are
**not** in either commit and their mtimes (2026-10-21 23:59:31 / 22:06:02) predate the M7b commits
(00:00:00 / 00:01:11) -> foreign lane, as the brief states. The `track-a-sources.json` diff is four
`outcome.note` strings only; no counter, source entry or other block changed.

**Tests**: 39 tests (23 before + 16 new: 4 licence, 3 manifest-only, 1 pinned coverage counts, 8 in the
F1-F7 block). They are offline (`node:fs` only) and non-vacuous: every new test asserts a literal that
only exists in the fixed report, so reverting F1-F7 breaks them — the F3 test pins `28 / 59 / 25 / 54`
(`tests/discovery/harvest-track-a-report.test.ts:387-392`), which is exactly the pre-fix 27/60/24/55.

---

## Blocking

None. F1-F7 are implemented, every number reproduces from the committed inputs, the report is
byte-reproducible and timestamp-free, the commits stay inside the allowed file set, and the gates are green.

---

## Non-blocking (ranked)

1. **The M7b brief's "not done" note about the PR-body skeleton is now stale, and the corrected wording
   is not in the branch.** `.autoforge/execution/M7b.md:198-200` says "`.autoforge/plans/plan-loop6.md` —
   the PR-body skeleton still says 'no hash re-downloaded'". As of this review the file no longer says that:
   `.autoforge/plans/plan-loop6.md:473-475` now reads "no known hash re-ingested (the hash gate runs after
   the bytes arrive, so a known document is downloaded and discarded — 10 such downloads in total, 3 in the
   M6b round)". The file's mtime is 2026-10-22 00:01:56, i.e. **after** the brief was written (00:00:56) and
   after both commits — so the edit is not in `af4489f`/`a89efcf`. Worse, `.autoforge/plans/plan-loop6.md` is
   **untracked** (`git ls-files --error-unmatch` -> no match; `.git/info/exclude:7` excludes `.autoforge/`
   except the curated files). The corrected PR wording therefore lives only in an ephemeral local file and
   would not survive a fresh clone. *Fix*: fold the corrected wording into a tracked artefact (the PR body
   the orchestrator publishes) and correct M7b.md:198-200 so the brief matches the tree.

2. **The false claim survives in three untracked local artefacts the brief does not mention.** `.autoforge/execution/loop6-validation-contract.md:48`
   ("no hash re-downloaded") and `.autoforge/validation/loop6-report.md:25` — which publishes it as
   "**PROVEN** (with a disclosed caveat) … In the loop-6 round they were **skipped, not re-downloaded**" —
   and `.autoforge/execution/work-order-loop6.json:5` / `.autoforge/execution/loop6-brief.md:26`. All four
   are untracked, so nothing false ships in the branch (the tracked surface — report, outcome blocks, M6b.md,
   M7b.md — is clean), but the orchestrator reads these to write the PR body and the validation report
   already asserts the disproved claim as PROVEN. *Fix*: correct or supersede the validation report's OP3
   row before the PR is opened, and state in M7b.md that the surviving copies are untracked.

3. **The precision tables are not cut by corpus membership (investigator m3 only half-answered).** F2 split
   the *row sets* (|A| 203/102, |B| 128/19) and gave a population-sensitivity line for the in-scope share
   (report `:98`), but the 3a/3b class tables themselves still mix the 102 non-corpus rows, and 24 of the 36
   "duplicate" rows are fixture mirrors. My corpus-root-only cut (same recompute): |B| corpus-root
   `duplicate 4, methodology 22, rsa-sample 47, unusable 55` of 128 vs outside `7 / 3 / 7 / 2` of 19 — i.e.
   the corpus holds **47** rsa-sample rows (36.7 % of the 147 figure becomes 36.7 % of a different
   denominator), and the outside cut carries 7 of them. *Fix (one line):* add the corpus-root cut of the 3b
   class table next to the population-sensitivity line.

4. **The licence rule is hybrid and the register row behind a fetched verdict is not named.** Report `:20`
   says the licence is "the manifest's `licence_verdict` for a fetched document, else the verdict for its
   directory in `docs/RSA-Documents/LICENSE-REGISTER.md`". The contract (F1) asked for the register per
   directory. The two agree for every committed row (the manifest's verdict is written from the same
   `source.licence_default` at `scripts/harvest-track-a.ts:590, 612` and the register row is generated from
   it at `:764-765`), so no committed number is affected — but a reader who checks the register against the
   candidate's path (`tests/fixtures/samples/CA/...`, not listed) finds nothing and cannot see that the
   CLEAR comes from `canada/track-a/ab-open` (`LICENSE-REGISTER.md:24`). It also goes stale if the register
   changes and the manifest does not. *Fix:* say "the fetched document's verdict (the register row for its
   fetched directory `canada/track-a/ab-open` -> CLEAR)".

5. **The "corpus root" cut mixes two populations.** `docs/RSA-Documents/canada/track-a/ab-open/neahdappendixc.pdf`
   is a corpus-root path but is a container-only binary the inventory does not hold, and the fixture row that
   stands in for it is counted as *outside* the corpus root; conversely the manifest-only row
   `84a70638…` (`canada/track-a/bc-moti/t02-04b.pdf`) is counted *inside* it although it is equally
   container-only. So the "corpus-root cut of |B| (128 rows)" mixes 127 operator-checkout rows with 1 fetched
   row, and the 1 candidate in that cut excludes the ingested FEASIBILITY copy that physically lives under
   the corpus root. The report discloses the fixture half of this (`:50`, `:98`) but not the mixing. *Fix:*
   one sentence naming what "corpus root" means for a fetched row (path-based, container-only).

6. **Test gaps.** (a) Nothing pins the F5 wording: no assertion that the outcome notes / `M6b.md` say
   "never re-ingested" and carry 3 and 10 — the F5 fix can regress silently. (b) The test "uses the manifest
   verdict for a fetched document and the register's for an on-disk one"
   (`tests/discovery/harvest-track-a-report.test.ts:216-224`) uses RESTRICTED on both sides, so it cannot
   discriminate the *sha in both sources* case (where the code prefers the manifest verdict) — a CLEAR
   directory on the inventory side would pin it.

7. **`M7b.md:215-217` mis-states why the investigator's m1 was skipped.** It says m1 ("the `pack.json`
   citation is partial") "needs `scripts/harvest-track-a.ts` or the manifest schema, which the contract
   forbids" — it does not: m1 is a citation in the report's own text, emitted at
   `scripts/harvest-track-a-report.ts:462`. The citation is indeed still partial
   (`policies/canada/pack.json` defines four native stages at `:22, :40, :58, :76`; only `pre-opening` has an
   empty `canonical_stages` at `:80`; `existing` and `unknown` are inventory vocabulary with no entry), so
   the claim stands — but the reason for not fixing it is wrong, and it was in the report builder's scope.

8. **Trivial**: `.autoforge/execution/M7b.md:175` calls 17007 "bytes"; it is the UTF-16 code-unit length —
   the file is 17 115 bytes (`wc -c`). The generator prints `report.length`, not the byte count
   (`scripts/harvest-track-a-report.ts:658`).

---

## Residual risks

- **The M6b round's "3" is not verifiable in this repo.** The 10-total *is* (committed outcome counters);
  the per-round 3 rests on the container-local `/tmp/m6b-fetch.log` (`M6b.md:43`), which is not committed.
  The M6b.md wording now states both numbers and attributes them correctly, so the risk is that the 3 is
  itself wrong, not that it is hidden.
- **No committed round log for the fetch-time hash skips** (investigator M7's fix option / the M6 review's
  N2). The counts live only in four `outcome.note` strings and in the report text; the 10 skips are
  unverifiable per document. Contract-scoped: building it needs `scripts/harvest-track-a.ts`.
- **The only `anchor` label is not re-derivable.** `a24707c6…` is the single anchor row and its
  `anchor:HARVESTING_PLAN.md#s1` citation points at a file absent from the repo. The report shows
  `anchor 1` and does not claim the anchor is verified; the DETAILED cell's "Have 1" therefore rests on an
  unverifiable label plus a RESTRICTED licence -> **0 usable** until the owner signs off.
- **Hint-derived labels still count as coverage.** F4 discloses; it does not exclude (the contract asked for
  disclosure). "3 of 3" is an upper bound: the two BC rows are *provably* fallback (`UNSTAGED` is not
  producible by `STAGE_RULES`, `scripts/harvest-track-a.ts:393-397`), the ab-open row is only *possibly* one
  (`FEASIBILITY_CONCEPT` can also come from the `/planning stage/` rule). The report says "possible
  fallback, not a proven one" — correct but conservative; it does not point out that 2 of 3 are provable.
- **`Have (documents)` still counts a document that cannot enter the pipeline** (`canada:DETAILED_DESIGN` 1,
  usable 0, licence RESTRICTED, split `restricted`). That is the contract's explicit instruction (keep the
  count, disclose the licence) and the report states it in three places, so it is disclosed, not hidden —
  but any consumer reading only the `Have (documents)` column would still over-count by 1.
- **The untracked artefacts are ephemeral.** The plan skeleton, the validation contract, the validation
  report, the work order and the investigation itself are all excluded by `.git/info/exclude` and are not in
  the branch. Any claim the PR body makes must be sourced from a tracked file; the F5 correction currently
  exists in tracked form only in `M6b.md`, the outcome notes and the report.
- **Not re-checked here (environmental / out of scope):** `node scripts/vault-sync.mjs --check` cannot run
  in this container (no `git-lfs`); no `vault/` or `state/vault-notes.json` change is part of the two commits,
  so CI is the judge. The operator's ~300 documents and `docs/RSA-Documents/scripts/build-ondisk-inventory.py`
  cannot be re-run here, so the 304 rows / 134 `needs_review` labels / 4-row anchor table are inspected,
  not re-derived. No network check was possible (robots posture, the 12 M6b candidate URLs, the unfillable
  list's DNS/403 claims).

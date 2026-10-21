# M6a — the H1 split-map fix + regression test (offline)

Binding contract: `.autoforge/execution/loop6-m6-split.md` § "M6a". Hazard: `.autoforge/execution/loop6-brief.md` § Hazards (H1).
Scope: `scripts/harvest-track-a.ts`, `tests/discovery/harvest-track-a.test.ts`. No network, no fetch, no output refresh.

## The defect (H1)

`runIntake()` built the split map (`by_province`) from the **fresh batch only**, so an intake run whose
staging held only duplicates overwrote `docs/RSA-Documents/track-a-split.json` with empty/partial
content. The same run also appended a bare newline to `canadian-download-log.tsv` and
`canada-intake-manifest.jsonl` (the `logLines.join("\n")` / `manifestLines` writes were unconditional),
so both files were no longer byte-identical.

## The fix (`scripts/harvest-track-a.ts`)

1. **New exported pure helper `splitByProvince(records)`** (`scripts/harvest-track-a.ts:344-368`):
   province -> `{ split, docs }`, with the split computed by `splitFor(province, licence_verdict)`
   (`scripts/harvest-track-a.ts:338-341`), so a non-CLEAR document can never land under `train`/`test`.
   A province that mixes verdicts keeps the most restrictive label. Testable without touching disk.
2. **The split map is derived from the FULL intake manifest** (`scripts/harvest-track-a.ts:695-700`):
   `splitByProvince([...existingRecords, ...fresh])`, where `existingRecords = readIntakeManifest()`
   (`scripts/harvest-track-a.ts:620-627`) is read *before* the fresh rows are appended. The committed
   rows therefore survive every intake run.
3. **Empty-batch safety (RC-3)**: the download log (`scripts/harvest-track-a.ts:679-689`) and the
   intake manifest (`scripts/harvest-track-a.ts:691-700`) are written only when `fresh.length > 0`,
   so a run that ingests nothing leaves both files byte-identical. `track-a-duplicates.json` is still
   refreshed with the duplicate rows the run found. The "no staged records at all" early return
   (`scripts/harvest-track-a.ts:629-633`) is unchanged — it must stay, because it is what keeps the
   committed duplicates register from being wiped by an empty staging file.
4. `runReport()` and `selftest()` now reuse `readIntakeManifest()` instead of repeating the read.

## The regression test (`tests/discovery/harvest-track-a.test.ts`)

* `splitByProvince` over a multi-province record list: `QC`/`AB` -> `test`, `BC`/`ON` -> `train`,
  `MB` (RESTRICTED) -> `restricted`, `SK` (BLOCKED) -> `quarantine`; agreement with `splitFor` for
  every province x verdict; a non-CLEAR document never under `train`/`test`.
* The RC-3 precondition: the corpus is copied into a scratch root, the staging file
  `docs/RSA-Documents/.track-a/fetched.jsonl` is filled with the **three committed manifest rows**
  (their sha256 are already in `dedupe-index.json`, so the fresh batch is empty), and the real CLI
  runs `intake` there. Asserts that `canadian-download-log.tsv`, `canada-intake-manifest.jsonl` and
  `track-a-split.json` are byte-identical to the committed files, and that
  `track-a-duplicates.json` now lists the three duplicate rows.

Red before the fix (the log gained a trailing newline, the split map lost both provinces,
`splitByProvince` did not exist); green after.

## Verify (all commands run in this worktree)

`npx vitest run tests/discovery/harvest-track-a.test.ts` — exit 0

```
 RUN  v3.2.7 /home/oc/.opencode-runs/Akamel01-AuditorAI/40/worktree

 ✓ tests/discovery/harvest-track-a.test.ts (42 tests) 384ms

 Test Files  1 passed (1)
      Tests  42 passed (42)
   Start at  22:37:31
   Duration  812ms (transform 110ms, setup 103ms, collect 69ms, tests 384ms, environment 0ms, prepare 93ms)
```

`npm run typecheck` — exit 0

```
> auditorai@0.1.0 typecheck
> tsc --noEmit
```

`npm run lint` — exit 0

```
> auditorai@0.1.0 lint
> eslint .
```

`npm test` — exit 0

```
 Test Files  69 passed (69)
      Tests  688 passed | 2 skipped (690)
   Start at  22:37:40
   Duration  5.98s (transform 1.91s, setup 5.18s, collect 10.34s, tests 6.89s, environment 15ms, prepare 6.46s)
```

Extra checks:

* `npx tsx scripts/harvest-track-a.ts selftest` — "selftest passed" (16 checks, offline).
* `node scripts/vault-sync.mjs --check` — "[vault-sync] committed vault state matches HEAD compilation".
  The command needs `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null`
  in this container: `git-lfs` is not installed, so the repo's LFS `post-checkout` hook fails the
  temporary `git worktree add` the script performs. Environmental, not caused by this change; the
  pre-commit hook's vault step is skipped anyway because no `vault/` or `state/vault-notes.json`
  file is staged or modified here.
* `git status --porcelain` — no binary path, no `docs/RSA-Documents/**` output touched.

## Scope discipline

* Files changed: `scripts/harvest-track-a.ts`, `tests/discovery/harvest-track-a.test.ts`,
  `.autoforge/execution/M6a.md`. Nothing else staged.
* `state/production-harvest-proof.json` and `.autoforge/state.json` were already modified in the
  worktree by a foreign lane — not staged, not committed, not reverted.
* No network, no model/LLM call, no fetch, no output refresh: `docs/RSA-Documents/**` is unchanged
  (`git status --porcelain` shows no such path).

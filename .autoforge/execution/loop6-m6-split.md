# Loop-6 M6 split into two worker tasks

The plan critic's M6 contract stays binding. The orchestrator splits M6 into two sequential worker
tasks because the review agent's runs were interrupted repeatedly when the whole module (code fix +
live fetch round) was one task.

## M6a — the H1 split-map fix + regression test (no network)

Scope: `scripts/harvest-track-a.ts`, `tests/discovery/harvest-track-a.test.ts` only.

Defect H1 (`scripts/harvest-track-a.ts:664-678`): `runIntake()` builds the split map
(`by_province`) from the **fresh** batch only, so an intake run whose staging holds only duplicates
overwrites `docs/RSA-Documents/track-a-split.json` with empty/partial content and loses the rows
already committed.

Required behaviour:

1. The split map is derived from the **full intake manifest** (`canada-intake-manifest.jsonl`), not
   from the fresh batch — one exported pure helper, e.g. `splitByProvince(records)`, so it is
   testable without touching disk.
2. Empty-batch safety (critic RC-3): when the fresh batch is empty, `intake` must leave
   `canadian-download-log.tsv` and `canada-intake-manifest.jsonl` **byte-identical**, leave
   `track-a-split.json` intact, and still refresh `track-a-duplicates.json` (the duplicate rows it
   found). The current early return (`scripts/harvest-track-a.ts:596-600`) means the AC cannot
   fail on unfixed code — the regression test must set up a staging file **present** holding
   records whose sha256 values are already in `dedupe-index.json` (the three committed manifest
   rows qualify), then assert the three files above.
3. Regression test (offline, no network) in `tests/discovery/harvest-track-a.test.ts`:
   - `splitByProvince` over a multi-province record list yields the expected province -> split map,
     with `QC` and `AB` -> `test`, other provinces -> `train`, and a non-CLEAR licence verdict ->
     `restricted`/`quarantine` (never train/test) — matching `splitFor` (`scripts/harvest-track-a.ts:338-341`);
   - the committed `docs/RSA-Documents/track-a-split.json` content is preserved by an intake run
     whose staging holds only duplicate sha256 values (the RC-3 precondition).
4. Verify: `npx vitest run tests/discovery/harvest-track-a.test.ts`, `npm run typecheck`,
   `npm run lint`, `npm test`.

Commit: one local commit on `oc/40`, explicit paths only, no push. Write the brief to
`.autoforge/execution/M6a.md` with the verify command outputs pasted.

## M6b — one bounded live gap-filling fetch round + output refresh

Runs after M6a (it uses the fixed `intake`).

1. Read `docs/RSA-Documents/track-a-sources.json`. Add **at most one NEW** source entry (never
   mutate an existing entry's `known_document_urls` — `candidatesFor` returns only that field for
   the `known-document-url` strategy, `scripts/harvest-track-a.ts:245-246`); a partial or invalid
   entry must be rejected before it is written, never crash `runFetch`
   (`scripts/harvest-track-a.ts:539-541`,`:561`). The only candidate considered is a
   server-rendered listing that robots permits; the Alberta CKAN API is robots-disallowed.
2. Run the bounded fetch: `npx tsx scripts/harvest-track-a.ts fetch --live --max=<n>` with a total
   bound of about 30 minutes wall clock and no more than about 15 new documents. The CLI enforces
   robots.txt, the crawl delay (10 s on the CKAN hosts) and 1 request/second per host; do not
   bypass them. No LLM/model API calls.
3. Then `npx tsx scripts/harvest-track-a.ts intake` and
   `npx tsx scripts/harvest-track-a.ts report`.
4. The rule that decides the result is in `scripts/harvest-track-a.ts` (`knownHashes`,
   `hashSkipReason`): a sha256 already in the on-disk inventory, the corpus dedupe index or the
   corpus catalog is **never** written and never enters the manifest — it is recorded as a
   duplicate instead.
5. Refreshed outputs (all tracked, all git-safe): `canada-intake-manifest.jsonl`,
   `canadian-download-log.tsv`, `track-a-split.json`, `track-a-coverage.md`,
   `track-a-duplicates.json`, `dedupe-index.json` (append only — the 333 pre-existing rows are
   never rewritten), `LICENSE-REGISTER.md` (one `| dir | VERDICT | basis | date |` row per new
   source dir), `QUARANTINE.md` (one bullet per non-CLEAR document).
6. Binaries fetched here land in `docs/RSA-Documents/canada/track-a/**` (gitignored) **in this
   container**, not on the operator's Mac. Every such document must be reported as
   "fetched in the box-runner container, not in the operator's checkout". No binary, extracted text
   or PDF may enter git: `git status --porcelain` must show no binary path.
7. Commit: one or more local commits on `oc/40`, explicit paths only, no push. Write the brief to
   `.autoforge/execution/M6b.md` with, per source: candidates found, fetched, skipped with reasons,
   every new sha256, every duplicate skipped, and the exact verify command outputs.

Verify (both tasks): `npm run lint`, `npm run typecheck`, `npm test`,
`npx tsx scripts/harvest-track-a.ts selftest`,
`npx vitest run tests/discovery/robots.test.ts tests/discovery/harvest-track-a.test.ts`,
`git status --porcelain` (no binary path), `node scripts/vault-sync.mjs --check`.

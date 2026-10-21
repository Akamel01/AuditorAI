# Plan — Issue #40 "Harvest Track A: fetch the public Canadian RSA documents"

Branch `oc/40`. **Scope: this issue only.** The other 18 frontier tickets in `.autoforge/discovery/tracker-index.md` (ops-residual R1–R19 except this one, plus `v2-agentic-platform/F2`) belong to a different wayfinder map (`ops-residual`) and are **out of scope** — not planned here.

## Objective

Fetch public, no-login Canadian road-safety-assessment documents over an explicit five-host allowlist, behind a robots + politeness gate, and emit git-safe evidence: an intake manifest, a per-document download log, licence/quarantine/dedupe register rows, a train/test split file, and a per-ODD-cell coverage table. Binaries and text never enter git (R3); only manifests and register rows ship (D6). A human must verify from the PR body alone what was obtained, which cells moved, and which remain unfillable.

## Acceptance criteria → modules

| AC | Requirement (grilling.md) | Satisfied by |
|---|---|---|
| AC1 | Coverage table per CA ODD cell: fetched vs target, priority cells called out, per-doc `cell_key` ledger (R11) | M2 (`report`), M4 (`track-a-coverage.md`, manifest) |
| AC2 | Intake record per doc (9 protocol fields); accepted = sha256 + licence row + dedupe claim + cell assignment; download log; licence register; quarantine; dedupe claims (R4–R9) | M2 (`fetch`, `intake`), M4 (register rows) |
| AC3 | Split at intake: QC + one prairie province → test only, never train; other provinces → train (R10) | M2 (`splitFor`), M4 (`track-a-split.json`) |
| AC4 | Unfillable cells listed with reason + named source family (R12) | M3 (dropped families), M4 (`track-a-coverage.md` § unfillable) |

## Ordered implementation steps

**S1 — M3: source manifest.** Create `docs/RSA-Documents/track-a-sources.json`: the 5-host allowlist (grilling.md:34) + per-source strategy, licence default, stage/province hints. *Why first:* single source of truth for fetcher and report, fixed before any network call. Verify: `python3 -c "import json;json.load(open('docs/RSA-Documents/track-a-sources.json'))"` and `grep -c '"host"' docs/RSA-Documents/track-a-sources.json` → 5.

**S2 — M1: robots gate.** Create `src/discovery/robots.ts` (`parseRobots`, `isAllowed`, `crawlDelayMs`, `robotsFor`) + `tests/discovery/robots.test.ts`. *Why before S3:* the fetcher imports it; the gate must be provable offline before any live request (R1). Verify: `npx vitest run tests/discovery/robots.test.ts` (no network) and `npm run typecheck`.

**S3 — M2: Track-A CLI.** Create `scripts/harvest-track-a.ts` with subcommands `fetch` (network, only with `--live`), `intake`, `report`, `selftest`; export `projectId`, `splitFor`, `verifyPdf`, `dedupeClaim`, `coverage`. Add the off-git rules to `.gitignore` **here**, in the same commit: the module that creates binaries owns the ignore rules, and they must be committed before the first live fetch or `git status --porcelain` shows binary paths (R3). *Why after S1+S2:* consumes the manifest and the robots module; one script, one in-memory record set (architecture report §1). Verify: `npx vitest run tests/discovery/harvest-track-a.test.ts` (7 offline assertions) and `npx tsx scripts/harvest-track-a.ts selftest` → green.

**S4 — M2 live fetch + intake.** `npx tsx scripts/harvest-track-a.ts fetch --live --corpus-root docs/RSA-Documents` then `... intake`. Binaries land in `docs/RSA-Documents/canada/<dir>/` (CLEAR) or `.../quarantine/<dir>/` (non-CLEAR). *Why after S3:* ignore rules already committed, so binaries stay off-git. Verify: `npx tsx scripts/harvest-track-a.ts report` regenerates `track-a-coverage.md`; `shasum -a 256` spot-check on one file matches the log row.

**S5 — M4: outputs + split/coverage assertions.** Generate `canadian-download-log.tsv` (14 cols, no header), `canada-intake-manifest.jsonl`, `track-a-split.json`, `track-a-coverage.md`; append to `dedupe-index.json`, `LICENSE-REGISTER.md`, `QUARANTINE.md`. *Why after S4:* every artefact is derived from the intake manifest, never hand-edited. Verify: row count == manifest line count; `git status --porcelain` shows no binary path; `track-a-split.json` assertions block shows train∩test provinces empty, QC ∉ train, no `project_id` in both splits.

## Track A fetch order, expected yield, abort conditions

Fetch in this order (robots per-path allow first; 1 req/s/host, ≥10 s on CKAN hosts; neutral UA, no AI-agent token):

| # | Source | Strategy | Expected yield |
|---|---|---|---|
| 1 | `open.alberta.ca` | CKAN listing (pinned URL) | ~20–40 PDFs (423 hits listed) |
| 2 | `donnees.montreal.ca` | CKAN `/dataset/<slug>` + atom feed | ~5–15 PDFs |
| 3 | `www2.gov.bc.ca` | sitemap → doc pages → PDF paths | ~5–15 PDFs |
| 4 | `www.unb.ca` | known PDF (no listing) | ~1 |
| 5 | `www.toronto.ca` | sitemap only | ~0–2 |

Yield is a scale hint, never a floor (A5, D8): report actuals and deltas.

**Abort conditions** (each records a `skip_reason`; for a whole source, an unfillable row — never a crash, never a retry storm):
- **robots disallow** → skip the URL, log it, never fetch a variant path.
- **JS-only listing** (no server-rendered document links) → source unfillable; no browser.
- **403** (bot protection, e.g. Québec) → source unfillable; no UA spoofing, no retry.
- **DNS NXDOMAIN** (MB, SK, MRDC/MUNIAC) → unfillable row, family named.
- robots 404/410 → allow-all (logged); robots 401/403 → deny-all; robots 5xx/network → deny + `skip_reason`.
- HTML landing where a PDF is expected → reject as `html-not-pdf`, no binary written.

## Coverage table and the numbers in the PR body

`report` reads `canada-intake-manifest.jsonl` and emits `docs/RSA-Documents/track-a-coverage.md`: `fetched` = distinct `cell_key` in the manifest; `target` = `state/odd-coverage.json` → `cells[].target` (13 / 41 / 41). `have_total` is never reported as fetched (R11). Priority cells (0.9231, 3, 3) are flagged; the §3 descriptor is free-text `priority_cell_note` (A7 — no schema change).

Every PR number comes from exactly one file:
- fetched docs, per-cell fetched, unfillable cells → `track-a-coverage.md` (from the intake manifest)
- targets 13/41/41, priority 0.9231/3/3 → `state/odd-coverage.json`
- sha256 claims → `dedupe-index.json`; train/test counts → `track-a-split.json`
- licence verdicts per dir → `LICENSE-REGISTER.md`; quarantined count + reasons → `QUARANTINE.md`
- bytes/sha256 per doc → `canadian-download-log.tsv`

## PR body skeleton

```
Title: feat(harvest): Track A — public Canadian RSA documents (manifests only)

Closes #40

## Acceptance evidence
- AC1 coverage: track-a-coverage.md — <cell> fetched <n> / target <t>; cell_key ledger in canada-intake-manifest.jsonl
- AC2 intake: canada-intake-manifest.jsonl (n records, 9 protocol fields, no T2); log canadian-download-log.tsv (n rows); licence rows in LICENSE-REGISTER.md; dedupe claims in dedupe-index.json; quarantined in QUARANTINE.md
- AC3 split: track-a-split.json — QC+AB test-only, train∩test provinces = [], no project_id in both splits
- AC4 unfillable: track-a-coverage.md § "cells Track A cannot fill" (n cells, each with reason + source family)

## Coverage (fetched vs target)
| cell_key | fetched | target | priority |
|---|---|---|---|
| canada:FEASIBILITY_CONCEPT | n | 13 | 0.9231 |
| canada:PRELIMINARY_DESIGN | n | 41 | 3 |
| canada:DETAILED_DESIGN | n | 41 | 3 |

## Unfillable cells
| cell_key | reason | source family |
|---|---|---|

Built with opencode (opencode-go/minimax-m3.1-flash-free), orchestrated by Claude Code
```

## Verification sequence (worker)

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npx tsx scripts/harvest-track-a.ts selftest` — offline self-check (R1)
5. `npx vitest run tests/discovery/robots.test.ts tests/discovery/harvest-track-a.test.ts` — script-level self-checks
6. `git status --porcelain` → **no** `*.pdf`, `canada/`, `quarantine/` path (R3)
7. `node scripts/vault-sync.mjs --check` — **NOT required**: no `vault/` file and no `state/vault-notes.json` change. Run only if that changes.

## Commit plan

Small commits, one concern each. Explicit `git add <paths>` — **never** `git add -A`.

1. `feat(discovery): robots.txt gate for Track A fetch` → `src/discovery/robots.ts tests/discovery/robots.test.ts`
2. `feat(harvest): Track A source manifest` → `docs/RSA-Documents/track-a-sources.json`
3. `feat(harvest): Track A fetch/intake/report CLI + off-git rules` → `scripts/harvest-track-a.ts tests/discovery/harvest-track-a.test.ts .gitignore`
4. `docs(harvest): Track A intake artefacts and register rows` → the M4 output files (explicit list)

Never commit `.autoforge/`, `.env*`, or any corpus binary/PDF/text corpus. Stage only the paths listed above.

# Investigation — ticket #56 (daily age-encrypted pg_dump + restore drill)

Date: 2026-11-02 · Investigator: autoforge-investigator · Read-only except this file.

## Scope checked
Files from the ticket's M1–M3: both workflows, both scripts, drill seed, runbook, `.env.example`,
`.gitignore`, `tests/contract/backup-restore.test.ts`, plus migrations 0001–0005 and the four
reviews/plan/decision/validation inputs. No git/vault mutations; no vault scripts run.

## Findings (ranked)

### F1 — major — Static contract leaves a hole for a real endpoint in the drill workflow
`tests/contract/backup-restore.test.ts:88` asserts only `no secrets.` on `restore-drill.yml`;
there is no `supabase.co`/`pooler.supabase.com`/`/home/oc` assertion in the `C.` describe block
(the same check exists for `backup.yml` at `:42-46` and for `restore.sh` at `:128-132`). A real
production endpoint could be added to the drill workflow and this test would still pass. M3 review
B1 flagged exactly this; only the `restore.sh` half landed.
Fix: mirror the bad-host assertions into the `C.` block before push.

### F2 — major — `state/production-harvest-proof.json` is a test side effect, not a deliverable
`npm run test` rewrites it (digest + `capturedAt` + manifest job id). It is tracked and currently
modified in the worktree. Left staged, it would pollute the ticket commit and fail staging hygiene.
Fix: `git restore state/production-harvest-proof.json` (or `git checkout --`) before staging; exclude
from the ticket commit. Already noted in the validation report residual risk #6.

### F3 — major (pre-existing, not ticket-caused) — full `npm run test` is flaky
Two consecutive full runs failed only on `tests/domain/pipeline-latency.test.ts` (5 s timeout);
passes alone (787 ms) and with the contract test excluded. The ticket's "`npm run test` passes"
acceptance is therefore not cleanly demonstrable here. Not attributable to #56 (validation report
residual risk #2 / M3 note 6).
Fix: run `npx vitest run tests/contract/backup-restore.test.ts` plus the single latency test in CI
as the ticket's proof; do not block the ticket on the pre-existing flake.

### F4 — minor — `ENVELOPE="$(ls restore-work/*.tar.age | head -1)"` is layout-fragile
`restore-drill.yml` (Timed restore step) globs the download dir. With zero matches, `ls` exits 2
and `set -euo pipefail` aborts (acceptable, fail-closed). With the v4 artifact layout the file
lands at `restore-work/*.tar.age`, so it works today; a future artifact layout change breaks the
drill silently only if the glob still matches something else.
Fix: assert `[ -f "$ENVELOPE" ]` after the assignment, or use `find ... -name '*.tar.age' -print -quit`.

### F5 — minor — runbook empty-`public` preflight omits extension-owned filters
`docs/runbooks/restore.md` empty-DB query counts `pg_class`/`pg_proc`/`pg_type` without the
`pg_depend … deptype='e'` exclusion that `restore.sh:48-64` uses. On a fresh `createdb` both
return 0, so the documented manual path works; on a Supabase scratch project whose `public` schema
holds an extension's objects, the runbook can false-fail. Over-count only, never false-pass.
Fix: paste the filtered query from `restore.sh` into the runbook (optional; low value).

### F6 — minor — `backup.sh` arithmetic path on a missing `server_version`
`scripts/backup/backup.sh:55-56`: if preflight prints fewer than two rows, `server_major` is empty
and `(( server_major > 17 ))` exits 1 with a raw bash arithmetic error rather than `::error::`.
Fail-closed still holds; polish only (M1 note 5).

### F7 — minor — age identity file mode is not documented
`restore.sh` requires `BACKUP_AGE_IDENTITY` readable; `age -d` rejects world/group-readable identity
files in some versions. The runbook says "offline age private key" but not `chmod 600`. An operator
with a loose key file gets a confusing failure.
Fix: one line in `docs/runbooks/restore.md` prerequisites: `chmod 600 <identity-file>`.

### F8 — accepted residual risk — no automated backup-failure alerting
Expired artifact / missed daily run is documented ("Expired artifact -> dispatch a new backup and
record the RPO gap") but not automated. Acceptable for free tier; documented, not hidden.

### Items explicitly checked and found sound (not findings)
- `--network host` + published service port 5432 on ubuntu-latest: supported and used consistently.
- `docker run -e` propagation for `BACKUP_POSTGRES_URL`/`DRILL_URL`/`ADMIN_URL`: correct; URL is
  expanded inside the container, only `-e NAME` appears in host argv (critique C3).
- `age` apt package, `jq`, `stat -c`, `sha256sum`, `postgres:17` entrypoint with `sh -c`: standard
  on ubuntu-latest.
- `pg_restore --schema=public` filtering the standalone `CREATE SCHEMA public` TOC entry (critique
  B1) and the empty-`public` preflight extension filter: implemented as designed.
- Re-applying 0003→0005 on a `--no-privileges` dump: idempotent (`if not exists`,
  `add column if not exists`, `drop policy if exists`, `create table if not exists`); RLS catalog,
  role invariant, and behavioral probe all use `ON_ERROR_STOP=1`.
- Drill seed satisfies 0001–0005 constraints, FKs, unique indexes, RLS; probe expectation A=1/B=0
  holds for the seeded `projects`.
- `.env.example` names are empty and CI-only; app does not read them; no real endpoint/key/password;
  no `/home/oc` in functional paths.
- `backup-out/` is gitignored; YAML parses; shell syntax clean; fail-closed exits before any
  Docker/DB call.
- Ticket acceptance wording: secret name in both `.env.example` and runbook, 30-day retention,
  age recipient from repo variable, migrations 0001–0005, RPO 24 h / RTO 4 h, PITR paid-only,
  no real DB/accounts/secrets, no scope creep — all met. Measured restore time remains CI-ONLY
  (no pushed branch / no run id yet), as the validator recorded.

## Pre-push checks
1. `git restore state/production-harvest-proof.json` (F2).
2. Add bad-host assertions to the `C.` describe block (F1).
3. `node scripts/vault-sync.mjs --check` (per AGENTS.md; no vault scripts otherwise).
4. `npm run lint && npm run typecheck && npx vitest run tests/contract/backup-restore.test.ts`.
5. Push `oc/56`, watch `restore-drill`; record run id + `restore_drill_seconds` in the PR.
6. Stage only the ticket's files (explicit paths), never `git add -A`.

## Recommendation
**GO**, conditional on F2 hygiene before push and a green `restore-drill` run (F3 is pre-existing
and does not block). If the drill is red, re-enter M3 only; M1/M2 contracts are consistent. No
replan of M1/M2 is warranted.

## Orchestrator follow-up (2026-11-02)

- **F1 is stale.** The bad-host assertions were added to the `C. restore-drill.yml` block before this
  sweep: `tests/contract/backup-restore.test.ts:89-93` (current file). The artifact's F1 is retained
  as written for traceability but is not an open action.
- **F6 is stale.** The numeric `server_major` guard was folded in after the M1 review:
  `scripts/backup/backup.sh:55-58`.
- **F4 applied:** the drill now asserts `test -f "$ENVELOPE"` after the glob
  (`restore-drill.yml`, Timed restore step).
- **F7 applied:** the runbook prerequisites now say `chmod 600 <identity-file>`.
- **F2 will be handled at staging:** `git restore state/production-harvest-proof.json` before the
  ticket commit; it is a test side effect, not a deliverable.
- F3 (pre-existing full-suite flake) is reported, not hidden; the contract test and the single
  latency test are the ticket-local proof.
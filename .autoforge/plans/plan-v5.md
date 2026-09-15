# Plan v5 — edge tests + twin cleanup + PIARC GF-9 DIRECT (2026-09-14)

## Wave 0 — T4 twin cleanup (FIRST, unblocks T1-T3)
- R1/R2 fix FIRST (orchestrator, src/discovery/ledger.ts): under VITEST a
  non-absolute AUDITORAI_LEDGER_MIRROR must never resolve to the live path
  (skip FS mirror); move appendLedgerKV above the VITEST early-return so the
  KV path is still exercised. Narrow, safety-only.
- Diff route twin pairs (health, discovery, others) for .js-only drift; port or record none.
- Delete of 196 untracked src/tests .js (twin-paired, zero orphans).
- `.gitignore`: `src/**/*.js` + `tests/**/*.js` only; `git check-ignore` verify (must NOT hide next.config.js / playwright / scripts).
- R3 verify on filesystem (`find src tests -name '*.js'` 196→0), NOT git status
  (ignored files vanish from status). Record root config twin pairs as out-of-scope note.
- Gates: `rg 'from.*\.js'` zero relative hits; lint + typecheck + test + build green.
- Touches: deletions + `.gitignore` only. No source edits.

## Wave 1 — T1/T2/T3 edge tests (parallel after T4)
- T1 → tests/domain/brave-quota.test.ts: 402/429/body-only/throw + 2 refusal negatives.
- T2 → tests/domain/harvest-health.test.ts: listJobs-empty, empty-tail, fallback backfill, 2 lock-holder cases.
- T3 → tests/domain/discovery-dedupe.test.ts: put-throws falsification + KV-load-failure fallback.
- Contract (all): absolute mkdtemp mirror + mtime guard; reset degraded AND zeroHitCounters;
  extensionless @/ imports; explicit stores/tmp cwd; poll-not-sleep; restoreAllMocks.
- Touches: the three test files + src/discovery/health-state.ts (reset export only).

## Wave 2 — T5 PIARC GF-9 DIRECT (parallel with Wave 1)
- LICENSE-REGISTER.md: keep RESTRICTED + dated scoped-mining exception annotation (1-2 lines).
- Miner read-set gated on catalog path-prefix startswith intl/piarc-irf/ +
  assert zero paths under quarantine/ (R4); verify-quotes.py checks text only.
- PDF→/tmp ephemeral text; short substrings; verify-quotes.py proof; candidates as PROPOSED lines.
- Touches: docs/RSA-Documents/LICENSE-REGISTER.md, gf-quote-pack.md (append-only), /tmp only.
- HITL: use in C8/C9/scorecards stays blocked on OWNER_RATIFICATION.

## Ship
- Reviews per module (read-only), validator battery, PR → CI 9/9 → merge → prod health → close tickets.

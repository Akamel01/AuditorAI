# AGENTS.md

Working conventions for agent sessions in this repo. Read before committing.

## Vault determinism (the race)

`state/vault-notes.json` is compiled from `vault/` and CI checks it byte-for-byte
against the committed tree. Parallel sessions often hold uncommitted journal edits;
compiling vault state with those present poisons the commit and fails the
"vault compile determinism (V2)" check.

**Rule:** never run `scripts/vault-import.mjs` / `vault-export.mjs` bare before
committing. Use:

- `node scripts/vault-sync.mjs` — refreshes `state/vault-notes.json` from a HEAD
  worktree compilation (immune to foreign uncommitted edits), or
- `node scripts/vault-sync.mjs --check` — what CI effectively does; run before pushing.

If you stash foreign journal files as a workaround, stop — vault-sync replaces that.

## Staging hygiene

Parallel sessions own different lanes (`src/app/**`, UI configs, etc.). Stage only the
files your ticket touched: explicit `git add <paths>`, never blanket `git add -A`.

## Eval gates

- Thresholds and judge prompts are doctrine-frozen; see `docs/validation/eval-gates.md`.
- §2 trigger paths require a fresh Tier-1 archive.
- Judge transport flakes: prefer `--topup <runId>` over full re-runs.

## Secrets

Keychain services `auditorai/opencode`, `auditorai/kv-url`, `auditorai/kv-token`
(`security find-generic-password -a "$USER" -s <name> -w`). Never paste values.

## Guardrails (CI green)

- Hook: `git config core.hooksPath .githooks` (auto via `npm run prepare`). Pre-commit runs `lint` + `typecheck` + vault determinism + YAML parse. Block on fail: `npm run lint:fix`.
- Local CI: `npm run ci:local` mirrors `ci.yml` + `ci-gates.yml` (validate-state, evidence, vault, eval-gate, lint/typecheck/test/build, e2e).
- Lint ignore: `.next/` `.vercel/` are ignored in `eslint.config.mjs:4` — never lint build output.
- Vault: `node scripts/vault-sync.mjs --check` before push; hook also checks staged `vault/` changes.
- YAML: quote workflow `name:` with `:` (e.g. `"Gate: R13 & R17"`) — unquoted `Gate:` yields 0-job runs.
- Gates: `check-eval-gate-freshness.mjs` parses `docs/validation/eval-gates.md` `Freshness max age 7d`; refresh via `node scripts/tier1-archive.mjs --rebase --topup <runId>` + `touch state/eval-scorecards`. `check-evidence-head.mjs` allows ancestor commit within 24h; refresh via harvest or updating `.autoforge/validation/ops-loop-evidence.json`.
- Harvest verify: `node scripts/harvest-verify.mjs --mock` (no server) + `ADMIN_KEY=... node scripts/harvest-verify.mjs --api gap --cellKey usa:PRELIMINARY_DESIGN --live --monitor` (live 1.5s poll) + `--api harvest-stream --live --monitor` (2s poll) — wired into `ci:local` + `ci.yml quality` + `pre-commit` (HV8); Playwright `@harvest` (`tests/e2e/harvest-buttons.spec.ts`) runs post-deploy with `ADMIN_KEY` secret.

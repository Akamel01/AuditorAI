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

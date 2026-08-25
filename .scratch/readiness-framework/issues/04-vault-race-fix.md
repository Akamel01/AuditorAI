# 04 — Vault determinism race fix

Type: task · Status: resolved · Blocked by: —

## Question

The CI "vault compile determinism" check failed 3× today because parallel sessions hold
uncommitted journal edits while another session compiles/commits vault state. Fix the
process mechanically: e.g., a `scripts/vault-sync.mjs` that compiles from HEAD (worktree)
and fails loudly if the working tree's foreign files would diverge, plus a pre-push guard
documented in AGENTS.md so any session hitting the race self-heals instead of shipping
broken determinism.

Answer records: script/guard landed, AGENTS.md note, green CI on a commit made while
foreign edits exist.

## Answer


## Answer

RESOLVED 2026-08-25. `scripts/vault-sync.mjs` landed:
- **sync mode** (default): compiles vault state from a throwaway HEAD worktree and
  writes it to the working tree — immune to foreign uncommitted journal edits by
  construction (race-proven: foreign edit present during compile produced byte-identical
  HEAD output).
- **--check mode**: what CI effectively does — exits 1 with a fix instruction if the
  committed vault-notes.json diverges from HEAD compilation.
AGENTS.md now documents the rule (never bare import/export before commit; use vault-sync)
plus staging hygiene, eval-gate notes (--topup preference), and keychain secrets.

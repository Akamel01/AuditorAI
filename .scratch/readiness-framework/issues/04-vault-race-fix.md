# 04 — Vault determinism race fix

Type: task · Status: claimed · Blocked by: —

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


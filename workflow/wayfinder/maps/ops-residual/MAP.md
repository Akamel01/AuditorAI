---
map: ops-residual
label: wayfinder:map
created: 2026-08-30
---

## Destination

Loop 2 close-out leaves durable harvesting on `main` (`dce8f08`); Vercel auto-deploys on push. This map holds the residual work disclosed by the validator and investigator: cross-instance safety, regression coverage, evidence contracts, ops health, and small UX/code hygiene improvements. Each ticket is a brief, ready for an AFK agent.

## Notes

- Skills to consult: `verify-and-stop` for any new gate; `codebase-design` for the cross-instance/CAS proposal; `diagnosing-bugs` and `investigate-first` for anything flagged during validation.
- Ponytail ladder: reuse `DataStore` seam; no new deps; smallest correct change.
- Staging hygiene (`AGENTS.md`): explicit `git add <paths>` only; never `git add -A`.
- Vault determinism: always `node scripts/vault-sync.mjs` or `--check`; never bare import/export.
- Process-local harvest lock and best-effort KV mirror are **explicitly accepted ceilings** for the current close-out; the tickets in this map define the upgrade paths.

## Decisions so far

- [Loop 2 close-out merged to main (dce8f08)](workflow/wayfinder/maps/ops-seamless-verify/tickets/T2-operation-loop-proof.md): durable live harvest + UI debouncing; evidence copies reconciled and byte-identical; T2 marked `blocked` until production KV/daemon proof is supplied. Tickets in this map record the follow-up work.
- [Accept process-local harvest lock as ceiling](workflow/wayfinder/maps/ops-residual/tickets/R1-cross-instance-harvest-lock.md): Vercel has at most one concurrent in-process lock holder per lambda; this is acceptable for current Spot ordering and may be insufficient under burst scale. Track upgrade via `R1`.
- [Ledger append indexes only successful puts](workflow/wayfinder/maps/ops-residual/tickets/R2-ledger-improve-indexing.md): Fix landed; further hardening (`R2`) tracks KV tail trim policy and orphan-key recovery.
- [Deploy + CI green at 70a519c](https://github.com/Akamel01/AuditorAI/actions/runs/33431156838): lint fix + brave 402 graceful fallback; `HEAD==origin/main`, `vault-sync --check` pass, `cmp` evidence identical, 5 CI jobs green.
- [Triage residual 2026-08-31](workflow/wayfinder/maps/ops-residual/tickets/R16-brave-quota-degradation.md): harvest degraded (quota 5.0/5.0) but no longer hard-fails; `R16` tracks monitoring/fallback, `R17` tracks evidence HEAD anchoring staleness (`61c7475` vs `70a519c`).

## Not yet specified

- Cross-shard ledger tail merging if Vercel moves KV beyond region.
- Per-cell harvest locks (would replace single global lock once `R1` ships).
- Ledger archival/cold-store policy beyond 500-entry window.

## Out of scope

- Changing ODD matrix semantics, eval-gate thresholds, or eval-gate judge prompts (doctrine frozen).
- Marketplace acquisition without owner approval (ADR-0007 firewall).
- Rewriting `next.config.js` or claim generator behaviour.

## Tickets

- `R1` — Cross-instance harvest lock via Vercel KV atomic SET NX
- `R2` — Ledger KV ordering + orphan-key recovery
- `R3` — Regression tests for in-process lock + callback dedup
- `R4` — Production harvest proof bundle (Vercel KV + daemon)
- `R5` — Stop/Cancel server endpoint (server mark cancelled vs client-only Stop)
- `R6` — Pagination across large job index (cursor stability)
- `R7` — Refresh parity for parent reload on manual click
- `R8` — Health route exposes harvest-health sub-object
- `R9` — Discovery doctor JSON contract stable for CI
- `R10` — `state/dedupe-index.json` write authority (KV-truth vs file fallback)
- `R11` — Hardening: drop speculative source comments
- `R12` — AutoForge staging: exclude `.autoforge/` from committed tree
- `R13` — Eval gate §2 freshness automation: timestamp check
- `R14` — Tier-1 archive: keep helper script, de-skill its drift
- `R15` — README + CONTRIBUTING: refresh Production deploy section
- `R16` — Brave quota 402 graceful degradation + monitoring (triaged 2026-08-31)
- `R17` — Evidence bundle reconciliation + HEAD anchoring automation (triaged 2026-08-31)

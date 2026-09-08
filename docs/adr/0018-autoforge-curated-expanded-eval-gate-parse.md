# ADR-0018: AutoForge curated expanded with stages mirror; eval gate parses doctrine

Grilled R12-R14 (ops-residual) on 2026-09-04. `.autoforge/AGENTS.md` already documents curated vs ephemeral; we expand and sharpen the automation.

## Decision

- **R12 staging (expanded curated):** keep negation pattern `.autoforge/*` + `!.autoforge/AGENTS.md` + `!.autoforge/state.json` + `!.autoforge/discovery/**` + `!.autoforge/architecture/**` + `!.autoforge/plans/**` + `!.autoforge/requirements/**` + `!.autoforge/execution/**` + `!.autoforge/reviews/**` + `!.autoforge/validation/**`. **Expand** to include evidence twins: `stages/07_validate/output/` mirror of `.autoforge/validation/` (byte-identical evidence copies) and harvest mirror `state/discovery-ledger.json` (bot-owned truth, `.autoforge` copy if present is ephemeral mirror). Secrets remain never in `.autoforge` — explicitly noted in `AGENTS.md`.
- **R13 eval gate freshness (HITL, doctrine-authoritative):** script `scripts/check-eval-gate-freshness.mjs` parses `docs/validation/eval-gates.md` §2 for threshold (default 7d via regex `/max.*age.*?(\d+)\s*d/i` fallback to 7) and fails CI when `state/eval-scorecards/*` newest mtime exceeds threshold. GitHub Action `gate-freshness` runs `node scripts/check-eval-gate-freshness.mjs` and emits actionable message "Tier-1 archive stale (>7d) — run scripts/tier1-archive.mjs --topup <runId> or --rebase". Threshold lives outside script body per acceptance; parsing makes doctrine the source.
- **R14 Tier-1 housekeeping:** `scripts/tier1-archive.mjs` remains canonical script name; header trimmed to operational flags only (`--rebase`, `--topup <runId>` next to each other as cheaper flake path, `--help`), plus single line `Doctrine: docs/validation/eval-gates.md §2`.

## Considered Options

- **R12 keep as-is vs expand:** keep as-is would leave `stages/07_validate/output` untracked vs `.autoforge/validation` curated, breaking twin invariant noted in `proof-bundle` and `ops-loop-evidence`; expand fixes. Bare ignore + `git add -f` was rejected — negation pattern is already verified via `git check-ignore -v`.
- **R13 hard-coded 7d vs parse:** hard-coded with cite is ponytail minimal, but acceptance explicitly demands "Threshold lives outside script body and is sourced from docs/..." so parse wins despite extra fs read. Hard-code would be a one-line lie to doctrine.
- **R14 rename script:** would churn `AGENTS.md` eval gates block and CI; keeping name preserves docs.

## Consequences

- `git status` after AutoForge run shows no `??` for curated; ephemeral `tmp/*.log` stays ignored.
- CI `gate-freshness` fails with stale archive until `--topup`/`--rebase` refreshes `state/eval-scorecards/`; doctrine change (e.g., 7d → 14d) automatically flows via parse without code edit.
- Header drift is now gated by "reference doctrine via relative path only" rule; future edits that add narrative comments fail review.

## Status

Accepted 2026-09-04. Implementation touches `.autoforge/AGENTS.md` (add secrets note + expanded list), `.gitignore` (verifies negation), `scripts/check-eval-gate-freshness.mjs` (new, parses doctrine), `.github/workflows/ci.yml` (gate-freshness step), `scripts/tier1-archive.mjs` (header).

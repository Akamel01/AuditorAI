# .autoforge/AGENTS.md — R12 curated storage policy

**Policy: curated, not ignored**

`.autoforge/` is ephemeral staging, but `state.json`, `discovery/`, `architecture/`, `plans/`, `requirements/`, `execution/`, `reviews/`, `validation/` are curated and committed for traceability. Ephemeral worktrees, `tmp/`, and `*.log` remain ignored.

* Curated: `state.json`, `discovery/report.md`, `discovery/tracker-index.md`, `requirements/grilling*.md`, `architecture/report*.md`, `architecture/decisions*.md`, `plans/plan*.md`, `execution/work-order*.json`, `execution/M-*.md`, `reviews/*.md`, `validation/*.md`
* Ephemeral (ignored): `tmp/`, `*.log`, `.autoforge/explanation/` (local markdown), `state/discovery-ledger.json` harvest mirror (committed via `state/` not `.autoforge/`)

**Why:** `vault-sync --check` and CI need `state/vault-notes.json` determinism, but `.autoforge` traceability helps reviewers; curated keeps history without bloating with ephemeral `tmp/`.

**Staging:** explicit `git add .autoforge/state.json .autoforge/discovery/...` per `AGENTS.md:21-23`, never `git add -A` + `git add -f` only for curated.

**Verification:** `git check-ignore -v .autoforge/discovery/report.md` → not ignored (curated); `git check-ignore -v .autoforge/tmp/foo` → `.gitignore:49:.autoforge/` ignored.

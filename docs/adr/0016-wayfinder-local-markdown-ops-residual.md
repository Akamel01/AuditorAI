# ADR-0016: ops-residual stays local-markdown; v2 stays GitHub canonical

Grilled R19 (ops-residual) on 2026-09-04. `workflow/wayfinder/TRACKER.md` already declares the split; `src/wayfinder/tickets.ts:12-45` + `scripts/wayfinder-tickets.ts` + `src/app/api/dev/tickets/route.ts` + `src/app/dev/mission-control/_components/ticket-board.tsx` implement the compilation. We ratify keeping it.

## Decision

- **ops-residual + ops-seamless-verify:** local-markdown is canonical. Markdown front-matter (`status`, `assignee`, `blocked_by`) is source of truth; `npm run tickets` / `scripts/wayfinder-tickets.ts --json` and Mission Control Tickets board both read the same `TicketIndex` (counts: `total/frontier/ready_without_owner/hitl_frontier/blocked`). No GitHub Issue sync for these maps.
- **v2-agentic-platform:** GitHub Issues remain canonical (map issue #20, child #1-#19, labels `wayfinder:*`/`ready-for-agent`/`blocked`/`hitl`). Local `tickets/*.md` are mirrors only for that map.
- **Hygiene siblings:** R11 keeps only ceiling/contract comments in `src/discovery/harvest.ts` (e.g., `ponytail: global 120s per-cell if throughput matters`), deletes historical narrative referencing removed `getGitHead`/global hook. R15 rewrites README/CONTRIBUTING Production deploy to "main is production; Vercel auto-deploys on push; `discovery-harvest.yml` schedule refreshes state; manual `vercel deploy --prebuilt` only for hotfix". R18 verification is `git ls-files --others no .jsx shadow` + `npm run build` + `npm run lint 0` — no manual screenshot beyond CI.

## Considered Options

- **Mirror ops-residual to GitHub:** gives uniform `gh issue list` but doubles source of truth, requires sync script, and violates `TRACKER.md` "local-markdown only" which was chosen to keep `state/*.json` bot-owned and to avoid label-state drift. Rejected.
- **Drop local plumbing, use GitHub for all:** would require creating 19 GitHub issues, migrating front-matter, and adding `hitl` label handling for R4/R13 which are already HITL — heavier than keeping the proven local index.

## Consequences

- `npm run tickets --json` must emit `counts.total/frontier/ready_without_owner/hitl_frontier/blocked` + `tickets[] {key,status,hitl,ready_without_owner}` and stay in sync with the board — a front-matter edit (`assignee: alice`) must be visible in both without code change (R19 acceptance).
- `state/discovery-ledger.json` and `state/odd-coverage.json` remain bot-owned via `data(discovery): harvest [skip ci]` commits; Wayfinder tickets stay human-owned.
- Reverting to GitHub sync later means creating `workflow/wayfinder/maps/ops-residual` as GitHub issues and deleting `scripts/wayfinder-tickets.ts` — explicit, reversible, but changes `TRACKER.md` contract.

## Status

Accepted 2026-09-04. Plumbing already exists; ticket R19 will be closed by confirming CLI + board parity and no new GitHub sync.

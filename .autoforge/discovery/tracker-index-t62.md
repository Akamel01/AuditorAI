# Tracker index — Ticket #62 (stage-classifier surface)

Source for the open-ticket list: `gh issue list --state open --limit 100 --repo Akamel01/AuditorAI` (run in the `oc/62` worktree at `5dcaddb`, 2026-10-22). Nine open tickets; every line below is reproduced from that command's output plus `gh issue view <n>`.

**Legend** — `IN-SCOPE` = #62's work touches this ticket · `NEIGHBOUR` = related context, no work required · `PARENT` = the map that owns #62.

---

## Open tickets

| # | Title | Labels | Scope for #62 | Why (source) |
|---|---|---|---|---|
| **62** | Stage classifier: map real-world RSA titles to ODD stages, so T3 documents reach their cells | `ready-for-agent` | **IN-SCOPE (this ticket)** | `gh issue view 62`: parent `#41`; "the bottleneck for Canadian documents is **the stage vocabulary, not the search**"; ACs = a test per new rule using real corpus titles, a coverage table v2-vs-v1, ambiguous documents listed with both candidate stages. Body quoted in `.autoforge/discovery/report-t62.md` Q2/Q5. |
| **41** | Map: AuditorAI to enterprise production — Canada first | `wayfinder:map` | **PARENT / IN-SCOPE** | `gh issue view 41`: `sub-issues` list includes `Akamel01/AuditorAI#62` (and `#60`). Its "Notes" say "The training corpus comes from the harvesting plan … Track A is in progress" and "This hangs on the corpus coverage that Track A produces" — #62 is the corpus-coverage blocker for the map. |
| **46** | Schema validation at every trust boundary (G-6) | `ready-for-agent` | **NEIGHBOUR** | `gh issue view 46`. Touches #62 only if the manifest `stage` shape changes; the recommended sidecar design (report Q5.2/Q5.4) keeps `docs/RSA-Documents/corpus-schema.json:14-17` untouched, so #62 stays inside `docs/` + `scripts/` + `tests/`. |
| **47** | Inventoried, pinned and scanned runtime dependencies (G-7) | `ready-for-agent` | **NEIGHBOUR** | `gh issue view 47`. #62 adds no new dependency — the extraction tool is the repo's existing `unpdf` (`scripts/harvest-track-a.ts:19,924`, `src/lib/extract.ts:5`). |
| **48** | Health and readiness routes, structured logs and failure alerting (G-12) | `ready-for-agent` | **NEIGHBOUR** | `gh issue view 48`. No shared surface. |
| **49** | Per-stage latency with a recorded p50 and p95 (G-14) | `ready-for-agent` | **NEIGHBOUR** | `gh issue view 49`. "Per-stage" here is pipeline stage latency, not RSA design stage — no shared surface with #62. |
| **54** | Named-user accounts and seats with Supabase Auth; an actor id on every issuance (G-1, G-5) | `ready-for-agent` | **NEIGHBOUR** | `gh issue view 54`. No shared surface. |
| **55** | Append-only, hash-chained audit trail with a verify routine and a per-firm export (G-3) | `ready-for-agent` | **NEIGHBOUR** | `gh issue view 55`. If the v2 sidecar ever becomes the audit-trail subject, #55 is the consumer; for #62 as scoped it is a downstream neighbour only. |
| **56** | Daily backups with point-in-time recovery, RPO 24 h, RTO 4 h, and a rehearsed restore (G-4) | `ready-for-agent` | **NEIGHBOUR** | `gh issue view 56`. No shared surface. |

---

## Closed / merged neighbours (context for #62, not open work)

| # | Title | State | Relation to #62 |
|---|---|---|---|
| **59** | Supabase Postgres in ca-central-1 as the tenant store, with row-level security (G-2, G-8) | MERGED (`gh issue view 59`; merged in `c7c449e`) | Neighbour: the tenant store that would host a stage-labelled manifest row if the corpus ever leaves git. Not a #62 dependency. |
| **60** | Harvest round 2: free, wide search for public Canadian RSAs | CLOSED (issue) / MERGED (PR) — `gh issue view 60`; merged in `5dcaddb` | **Direct predecessor.** Supplies the round-2 corpus (30 of the 33 manifest rows) and the two stuck T3 documents named in `docs/RSA-Documents/track-a-round2-harvest-report.md` §1 ("Near misses"): *Transitway Station Design* (ON, `UNSTAGED`) and *Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference…* (NB, `PRE_OPENING`). |
| **61** | Harvest round 2: free, wide search for public Canadian RSAs | MERGED (PR) — `gh pr list`/`git log --all` | **Direct predecessor PR.** `5dcaddb` is the HEAD of this branch; it is the commit that created the round-2 report and the committed candidate log #62 re-reads. |
| **40** | Harvest Track A (round 1) | MERGED — `3bd03d5` | Predecessor: round-1 corpus (3 manifest rows) + `docs/RSA-Documents/track-a-harvest-report.md`. |
| **58** | Harvest Track A: fetch the public Canadian RSA documents named in the harvesting plan | MERGED — `3bd03d5` | Predecessor PR that authored `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts` and `tests/discovery/harvest-track-a.test.ts`. |

---

## Branch / worktree state (collision risk for the planner)

- Current worktree: `oc/62` at `5dcaddb`. `git branch -a` shows local `oc/40, oc/44, oc/46, oc/47, oc/49, oc/53, oc/54, oc/60, oc/62, pr59, pr59b` and remotes `origin/chore/loop3-closeout, chore/loop4-closeout, chore/loop5-closeout, chore/vault-journal-loop4, chore/vault-journal-loop6, chore/vault-journal-loop7, feat/corpus-ratify-migrate-promote`.
- `git log --format='%h %ad %an %s' -- scripts/harvest-track-a*.ts tests/discovery/harvest-track-a*.test.ts` → `5dcaddb` (Ahmed Kamel, #61) and `3bd03d5` (Ahmed Kamel, #58). **No other lane holds the harvest scripts or their tests** ⇒ a new `tests/discovery/harvest-stage-rules-v2.test.ts` and a new `scripts/harvest-stage-rules-v2.ts` are collision-free.
- ⚠️ `git check-ignore -v .autoforge/discovery/__tmp_probe.md` → `/home/oc/repos/AuditorAI/.git/info/exclude:7:.autoforge/`. **New files under `.autoforge/` are git-ignored in this checkout** (the `.gitignore` negation `!.autoforge/discovery/**` cannot re-include files under the excluded `.autoforge/` directory). The planner must `git add -f .autoforge/discovery/report-t62.md .autoforge/discovery/tracker-index-t62.md`. The v2 deliverables should live under `docs/research/stage-rules/` instead — `git check-ignore -v docs/research/stage-rules/x.md` returns **no match (exit 1)**.

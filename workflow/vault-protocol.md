# Vault Memory Protocol (V3)

Small on purpose. A protocol nobody follows is worse than none. If a rule here
costs more than it saves, propose an amendment in the session journal.

## Session types

- **BUILD** — implements a ticket (code, tests, docs).
- **DECIDE** — resolves a decision ticket (grilling, policy, thresholds).
- **RESEARCH** — investigates against external/primary sources.
- **ORCH** — orchestrates the map: triage, verification, merges, tracker ops.

## MUST-READ (session start, in this order)

| All sessions | Plus |
|---|---|
| `CONTEXT.md` (canonical vocabulary) | — |
| Map `MAP.md` (destination + decisions so far) | BUILD/DECIDE: your ticket's issue body + handoff file |
| `workflow/wayfinder/TRACKER.md` §Operations + §Triage | RESEARCH: `docs/research/*.md` front-matter for what already exists |
| Latest journal entry in `vault/journal/` (what happened last session) | ORCH: `state/validation-state.json` tail (open incidents) |

Never reconstruct context from chat history when a repo artifact carries it.

## MUST-WRITE (session end)

1. **Journal entry** `vault/journal/YYYY-MM-DD-<slug>.md` — append-only; what was
   done, what changed, what surprised you. Front-matter per charter (`type:
   journal`, `owner: agent` or `human`).
2. **Gotchas** — any environment/triage/tooling lesson that cost >5 minutes
   becomes or updates `vault/gotchas/<topic>.md` (one topic per file).
3. **Ticket mirror** — flip `status:` in the ticket's local mirror file;
   resolution text lives on the GitHub issue, one-line pointer in MAP.md
   Decisions-so-far (orchestrator commits).

## MAY-PROMOTE (graduation rules)

A journal entry graduates when it is true beyond today's task:

| Graduate to… | When… |
|---|---|
| `vault/gotchas/<topic>.md` | the lesson is operational and will recur (env quirks, API shapes, measured limits) |
| `vault/decisions/<slug>.md` | a choice with rationale that future sessions must not relitigate (link the ADR if one exists) |
| `docs/adr/NNNN` (via owner) | hard to reverse + surprising without context + real trade-off (ADR bar) |
| registry JSON via compile scripts | structured facts with schema (evidence, artifacts) |

Promotion is a *copy with attribution* (journal entry stays; graduate cites it).
Only the owner edits curated zones directly; agents stage proposals as new
journal entries tagged `proposal:` in the title.

## Explicitly out of scope

- Automated enforcement tooling (checklists over robots).
- Cross-repo memory; this protocol governs this repo only.

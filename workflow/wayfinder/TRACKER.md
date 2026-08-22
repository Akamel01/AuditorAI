# Wayfinding operations — this repo's tracker

No external tracker is configured, so Wayfinder uses a **local-markdown tracker**
committed to the repository. Git is part of shared state; any session can reconstruct
the frontier from these files alone.

## Layout

```text
workflow/wayfinder/
  TRACKER.md                  ← this file (conventions)
  maps/<slug>/
    MAP.md                    ← the map: Destination / Notes / Decisions so far /
                                Not yet specified / Out of scope
    tickets/<ID>-<slug>.md    ← one file per decision ticket
```

## Ticket file format

```markdown
---
id: R1
title: Short name used in narration
type: research | prototype | grilling | task
hitl: true | false          # HITL tickets resolve only with the human
status: open | claimed | closed | out-of-scope
assignee:                   # set on claim; an assigned open ticket is claimed
blocked_by: [R1, R2]
blocks: []
created: 2026-08-22
resolved:
---

## Question

<the decision or investigation this ticket resolves>

## Resolution

<appended on resolution; assets linked, not pasted>
```

## Operations

- **Frontier**: open + unassigned + every `blocked_by` closed. Work only frontier tickets.
- **Claim**: set `assignee` + `status: claimed` before any work.
- **Resolve**: append `## Resolution`, set `status: closed` (+ `resolved:` date), add one
  index line to the map's *Decisions so far* (name wraps gist; link to ticket).
- **Out of scope**: close with `status: out-of-scope` and one line in the map's
  *Out of scope* section. Never graduates back.
- **Fog**: un-ticketed future decisions live in *Not yet specified*; graduate into fresh
  tickets one at a time when they become sharply phraseable.
- **Never resolve more than one non-research ticket per session**; research tickets may be
  batched to parallel subagents.
- Researchers write **only their own** `docs/research/*.md`; the orchestrator commits and
  compiles registries. Subagents never mutate `state/*.json`.

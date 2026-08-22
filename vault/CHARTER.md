# AuditorAI Vault Charter

**Version:** 1.0-draft (awaiting owner blessing) · **Created:** 2026-08-22 · **Owner:** Akamel
**Status of this document:** the constitution for `vault/`. Nothing enters or changes in the
vault contrary to this charter. Changes to the charter itself are owner decisions recorded in
the decision log.

## Purpose

The vault is the project's **working memory in human-readable form**, edited daily by the
owner in Obsidian and read/written by agents during development sessions. It complements —
never replaces — the JSON-canonical registries in `state/`, which remain the machine truth.

## The three zones (hybrid fork, locked at scope-grilling)

| Zone | Path | Canonical form | Owner | Agents may |
|---|---|---|---|---|
| **Prose** | `vault/journal/`, `vault/decisions/`, `vault/research-notes/`, `vault/gotchas/` | Markdown prose with YAML front-matter | **Human-curated** (see conflict rules) | append journal entries; propose edits via PR-style suggestions; never overwrite curated notes silently |
| **Views** | `vault/views/` | Generated Markdown | **Machines** | regenerate freely from registries; humans must never hand-edit (edits are lost on next compile) |
| **Registries** | `state/*.json` (outside the vault) | JSON | **Machines + validated compiles** | written only through compile scripts with determinism checks |

## Directory skeleton

```
vault/
├── CHARTER.md            ← this file
├── journal/              ← dated session logs; APPEND-ONLY (one file per session)
│   └── 2026-08-22-v2-kickoff.md        (example naming: YYYY-MM-DD-slug.md)
├── decisions/            ← curated decision notes (ADR-adjacent context, not replacements)
├── research-notes/       ← curated reading notes linking out to docs/research/*
├── gotchas/              ← hard-won operational lessons (one topic per file)
└── views/                ← machine-generated only (compile scripts land with V2 #10)
```

Existing `docs/research/*` and `docs/adr/*` **stay where they are**; the vault links out to
them (`[[../docs/research/sample-drawing-corpus]]` style). Moving them is out of scope.

## Front-matter contract

Every prose file carries:

```yaml
---
title: <short title>
type: journal | decision | research-note | gotcha
date: YYYY-MM-DD
status: open | settled | superseded   # journals omit status (append-only)
owner: human | agent                  # who may edit the body
links:                                # optional, registry-resolvable references
  evidence_ids: [EV-UK-002]           # must resolve in state/evidence-registry.json
  issues: [#20]                       # GitHub issues
  adr: [0002]                         # docs/adr numbers
---
```

Rules:
- `evidence_ids` in front-matter MUST resolve in the compiled registry (validated by the V2
  determinism job once compile scripts exist).
- No other machine-parsed fields without a charter amendment.
- Views files carry generated front-matter with `generated: true` and a source hash.

## Conflict rules (the core)

1. **Journals are append-only.** Agents add dated entries; nobody edits yesterday's entries.
   Corrections happen as new entries referencing the old one.
2. **Curated notes (`decisions/`, `research-notes/`, `gotchas/`) are human-owned.** Agents
   propose changes but never push directly to these bodies; the owner applies or rejects.
3. **Views are machine-owned.** Regenerated wholesale; hand edits are discarded by design.
4. **Sync direction is one-way, registry→view and view→registry via chartered front-matter**
   (both directions arrive with V2 #10). The vault never becomes the canonical source of any
   field that also exists in `state/` — when both exist, `state/` wins and views re-render.
5. **Obsidian concurrent-edit conflicts:** because journals are append-only and per-session,
   human+agent simultaneous edits target different files by construction. Curated-note
   conflicts resolve by the human's copy winning; agents re-propose.

## Agent memory protocol pointer

What agents MUST read/write here per session type lands with V3 (#11) as MUST-READ /
MUST-WRITE lists wired into TRACKER.md. This charter fixes only where things live and who
owns them.

## Amendment procedure

Owner edits this file directly (it is prose-canonical, human-owned), then records the change
in `docs/decisions/log.md` if it alters zone ownership or conflict rules.

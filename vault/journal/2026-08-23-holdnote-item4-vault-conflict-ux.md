---
title: "proposal: Hold-note — fog item 4, vault sync-conflict UX (NOT FIRED: 'not yet')"
type: journal
date: 2026-08-23
owner: agent
---

Fog item 4 from MAP.md §Not yet specified, reviewed per handoff `handoff-d-fog-graduation.md`
decision table. Verdict: **condition NOT fired** — honest answer is "not yet", exactly as the
handoff predicted for two agents' worth of sessions.

## Checked condition

"Real human+agent edit conflicts accumulate under the V1 charter."

## Evidence mined at review time (2026-08-23)

1. **Git history:** zero merge commits in the entire repository history
   (`git log --oneline --merges | wc -l` → 0). No conflict was ever resolved at git level;
   history is linear.
2. **Curated zones are empty** — the primary conflict surface under charter rules #2/#5 has
   zero instances: `vault/decisions/` empty, `vault/research-notes/` empty. The only curated-
   zone file is `vault/gotchas/opencode-api-key-invocation.md` (agent-authored, uncontested).
3. **Journals:** all four entries (`vault/journal/2026-08-22..23-*`) are agent-written and
   append-only by construction (charter rule #1); per-session files mean human+agent
   simultaneous edits target different files by construction (charter rule #5).
4. **Text search:** no journal or commit message records a lost write, clobber, overwrite, or
   human-vs-agent edit collision. The single grep hit for "conflict" is unrelated fixture
   narrative ("conflicting continuity records" in GF-10).

## Exact trigger to re-check

Any ONE of:
- ≥1 real incident: simultaneous divergent edits to the same vault file (e.g., owner's
  Obsidian edit racing an agent commit to a curated note), or a demonstrably lost write.
- ≥2 human-curated notes under active co-editing where the "human copy wins; agents
  re-propose" rule produces recurring re-proposal churn (pattern, not one-off).
- Merge commits touching `vault/**` appear in git history.

Re-mine with: `git log --merges --name-only -- vault/`, curated-zone file counts, and a
journal/grep sweep for lost-write language. Re-check after roughly every five owner-touching
sessions or at first curated note creation, whichever comes first.

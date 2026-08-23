---
title: Architecture deepening sweep v3
type: journal
date: 2026-08-23
owner: agent
---

Ran the five-track architecture investigation (domain/pipeline, AI/eval,
persistence/delivery, UI, knowledge-system) then executed all six remediation
phases in agent loops under the owner's chart-and-execute directive. Map:
workflow/wayfinder/maps/v3-architecture-deepening/MAP.md — every phase left
`npm run ci` green; test count grew 165 → 279 across the day. Nothing committed;
owner reviews the working tree per phase.

What changed, compressed: pipeline contracts became executable (write-scope gate,
registry-driven async dispatch, loud skip recording); storage layout collapsed
into Repository (key helpers, getMany/delByPrefix, StoreUnavailableError,
coordinates-not-keys in artifacts); ZenAiAdapter decomposed into lib/inference.ts
with an adapter registry; prompts stopped restating domain facts by hand
(CANDIDATE_FIELDS/BANNED_WORDS/pack vocabulary single-sourced); routes lost their
embedded policy to pure domain modules (project-edits, input-states,
finding-review, intake); UI forks deleted (buildLayersClient, three raw-fetch
forks, hand-maintained stage-label invariant); the vault toolchain got one
front-matter module, charter-promised evidence-id resolution, graph-state as the
single source for node contracts, and a `npm run vault` composite.

Surprises worth keeping:

1. AG-ADJUDICATION never consumed candidate_findings despite contract prose —
   live candidates are produced, evidence-gated, then dropped before the report.
   Contracts were amended at source to match reality; building the real
   candidate-review flow remains fogged pending an owner decision (map flag #2).
2. The client checklist and AG-MANIFEST disagree on provided-but-blank inputs
   (verbatim vs downgrade-to-missing). Flagged in map fog; one rule must win.
3. Deterministic audit ids mean reruns overwrite prior audits per stage —
   history is depth-1 by accident of design. Recorded as map flag #1 for an ADR.
4. js-yaml was assumed in-tree since N1 but wasn't a direct dependency; added
   `yaml` as devDependency during the front-matter consolidation.
5. Two gotcha files violated the charter's own front-matter contract; minimal
   front-matter was added (bodies untouched) so validation could pass — owner
   should eyeball vault/gotchas/*.md.

# AutoForge Grilling: Deferred Frontier Tickets (R8, R12, R13, R14)

Scope: repo-root references for four deferred frontier items. Evidence cited from MAP.md, tracker index, and supporting gates/docs.

Key sources cited:
- MAP.md: R8, R12, R13, R14 entries (citations provided below) [workflow/wayfinder/maps/ops-residual/MAP.md:38-55, 63-70].
- .autoforge/discovery/tracker-index.md: R8, R12, R13, R14 listings and status lines [tracker-index.md:38-41, 58-60, 63-65, 68-70].
- Supporting gate policy: docs/validation/eval-gates.md (Tier-1 trigger paths and thresholds) [docs/validation/eval-gates.md:8-13].
- Freshness script: scripts/check-eval-gate-freshness.mjs (R13 freshness checks) [check-eval-gate-freshness.mjs:10-15, 28-29].
- Health/health-aggregation: route.ts and health-aggregate.ts show health shape and exposure details used in R8. See src/discovery/health-aggregate.ts and src/app/api/dev/health/route.ts for shape and exposure.

Note: This document encodes a self-approval policy where evidence in the cited MDs and prior decisions suffices to resolve with a default policy pick. The defaults are explicitly marked as self-approved and reversible where noted.

---

R8 — Health route exposes harvest-health sub-object
- Context (evidence): tracker-index lists R8 and MAP.md documents the intent; MAP.md explains what R8 covers [tracker-index.md:38-40] [MAP.md:41-49].
- Key question: Should the harvest-health sub-object remain a four-field shape, or does future expansion require a schema revision?
- Findings: Harvest health is modeled as a 4-field object (lastRunAt, lastSuccessAt, lastHits, degraded) in health-aggregate.ts; route.ts exposes a harvest snapshot built from these fields. This yields a stable, four-field shape today. See src/discovery/health-aggregate.ts lines 6-11 and 136-165 for exposure in route.ts. 
- Self-approve default (R8): Keep the four-field shape; no move to richer surface unless a concrete release gate requires it. This is consistent with the current HarvestHealth interface (4 fields) and stable exposure in the Health route. Evidence: health-aggregate.ts lines 6-11; route.ts lines 157-166; MAP.md lines 41-49. [MAP.md:41-49][src/discovery/health-aggregate.ts:6-11][src/app/api/dev/health/route.ts:158-166]
- Action: no code changes required; monitor drift in future gates.
- Escalation: none.

R12 — AutoForge staging: exclude `.autoforge/` from committed tree
- Context (evidence): MAP.md explicitly defines R12 and its intent; tracker-index.md shows the R12 entry as OPEN. See MAP.md: R12 entry and R12 description [MAP.md:58-60]; tracker-index.md:58-60.
- Key question: Do we currently ignore .autoforge in Git, or is an explicit ignore rule missing?
- Findings: The repository contains a general .gitignore (see .gitignore). It does not show an explicit .autoforge/ rule today (the file content excerpt shows typical build, state, and temp artifacts; no explicit autogenerator folder). Evidence: .gitignore shows rules for state, build outputs, etc., but no .autoforge entry; this is a gap to codify the policy. See .gitignore lines 1-12 and 40-46 for context. [.gitignore:1-12][.gitignore:40-46]
- Self-approve default (R12): Add explicit ignore for .autoforge/ to Git (e.g., a .gitignore rule for .autoforge/). Rationale: aligns with MAP.md intent and avoids drift between local auto-generated state and committed repository.
- Action: update .gitignore to include a line for .autoforge/; verify no accidental commits of autoforge content by CI; optionally gate in CI if needed. See MAP.md:58-60; tracker-index.md:58-60 for policy; ARGS: .gitignore is the place to enforce this. [MAP.md:58-60][tracker-index.md:58-60][.gitignore:40-46]
- Escalation: none.

R13 — Eval gate §2 freshness automation: timestamp check
- Context (evidence): MAP.md explicitly lists R13; the eval-gate freshness script implements a timestamp freshness gate; docs/validation/eval-gates.md describes Tier-1 gating policy. See MAP.md:63-65; check-eval-gate-freshness.mjs:10-15; docs/validation/eval-gates.md:8-13.
- Key question: Is the current freshness window and automation adequate for production gate stability, or do we need additional checks (e.g., direct registry freshness, or more frequent scorecard sampling)?
- Findings: The check-eval-gate-freshness.mjs enforces that Tier-1 freshness logic remains anchored to the docs gate and issues a warning when scorecards are older than 7 days; it also ensures the gate doctrine is present in docs. The script exits with failure if the doctrine cannot be found. See scripts/check-eval-gate-freshness.mjs lines 10-15 and 28-29; docs/validation/eval-gates.md lines 8-13 describe Tier structure. 
- Self-approve default (R13): Maintain the existing freshness gate behavior as the default; no additional automation needed unless fresh evidence mandates it. This is supported by the current script behavior and doc doctrine. See check-eval-gate-freshness.mjs:10-15, 28-29; docs/validation/eval-gates.md:8-13. [scripts/check-eval-gate-freshness.mjs:10-15][scripts/check-eval-gate-freshness.mjs:28-29][docs/validation/eval-gates.md:8-13]
- Action: preserve current freshness workflow; consider bumping maxAge or adding an explicit Tier-1-run trigger if gate policy changes. 
- Escalation: none.

R14 — Tier-1 archive: keep helper script, de-skill its drift
- Context (evidence): MAP.md documents R14 and its intent to keep a helper script for Tier-1 archiving and to de-skill drift; tracker-index.md shows R14 as OPEN with citations. See MAP.md:68-70; tracker-index.md:68-70.
- Key question: Do we currently have a Tier-1 archive script present? If not, should we implement a minimal skeleton that is drift-resistant and easy to evolve?
- Findings: The repo does not visibly contain a tier1-archive.mjs script; scripts directory includes check-eval-gate-freshness.mjs, but tier1-archive.mjs is not present in the checked tree. Evidence: file search in repository indicates tier1-archive.mjs is not found; MAP.md references such a script as R14. See MAP.md:68-70; repo search results show no tier1-archive.mjs. [MAP.md:68-70]
- Self-approve default (R14): Create a minimal tier1-archive.mjs skeleton and annotate drift-sensitivity, de-skill drift by isolating from other state; provide a stable public API so future upgrade work can be slotted in without breaking existing gates. Rationale: aligns with MAP.md intent and keeps Tier-1 archival path insulated from drift.
- Action: Add skeleton tier1-archive.mjs (and accompanying README note) to project; ensure it is not committed and clearly marked as a non-production helper until upgraded. See MAP.md:68-70.
- Escalation: none.

---
Summary: All four tickets have sufficient documentary evidence to enable self-approval with the default policy picks. The proposed actions are minimal, reversible, and aligned with the ladder rules.

Artifacts:
- Source references cited inline above for each ticket.
- Final: this file is stored at .autoforge/requirements/grilling-deferred.md

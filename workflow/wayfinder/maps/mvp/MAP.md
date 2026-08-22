---
map: mvp
label: wayfinder:map
created: 2026-08-22
---

## Destination

A deployed, free-hosted MVP web application where a road-safety auditor can: create a
project; select jurisdiction → framework → stage (0–2); see required/recommended/missing
inputs for that stage in that jurisdiction; run an evidence-grounded audit producing
typed findings with provenance, explicit uncertainty and human-review workflow; and
generate a structured report. Canonical internal stage model maps Intl/UK/USA/Canada/UAE
native stages with cited provenance and confidence. Backed by deterministic policy packs,
evidence registry, contracts, shared state, CI green, and the §39 quality gate satisfied.
AI-assisted but not AI-defined. Docker out of scope.

## Notes

- Skills every session should consult: `grilling` + `domain-modeling` for decisions,
  `codebase-design` vocabulary (Module/Interface/Depth/Seam/Adapter/Leverage/Locality)
  for anything structural, `research` discipline for evidence work.
- Standing preferences: deterministic-first; AI bounded to candidate/draft artifacts;
  compliance ≠ safety; primary sources only for normative claims; no silent harmonization
  of jurisdictions; state reconstructed from repo, never chat history.
- Research tickets are executed by parallel subagents writing only their own
  `docs/research/*.md`; orchestrator commits and compiles `state/evidence-registry.json`.

## Decisions so far

- [Bootstrap structure & shared state](https://github.com/Akamel01/AuditorAI/commit/fa234aa): repo skeleton, registries, contract templates, CI state-validation live.

## Not yet specified

- Input manifest schema finalization (awaits research on per-stage inputs/outputs)
- Policy pack JSON format details
- Audit-graph node decomposition granularity (assessment nodes vs audit questions)
- Golden fixture design specifics (which intentional defects, expected findings)
- Determinism test harness design
- AI integration approach: provider selection, prompt isolation, cost controls
- Report template shape and export format(s)
- Security controls detail (upload validation limits, rate limiting placement)
- UI flow details beyond §27 minimums

## Out of scope

- Docker / containerization (explicitly deferred by project brief)
- Stage 3 / Stage 4 support (architecture must extend toward them; MVP stops at Stage 2)
- GIS / CAD / connected-vehicle integrations (future extension direction only)
- Multi-tenant database persistence (a seam is reserved; not built this phase)
- Legal determinations, professional certification, or approval outputs from AI

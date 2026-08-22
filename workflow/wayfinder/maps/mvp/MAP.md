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
- [International RSA baseline (R1)](tickets/R1-international-baseline.md): NO true international standard exists; PIARC 2023R40EN is the nearest de-facto guideline; ISO 39001 is management-systems only; "International" must ship as an explicitly qualified synthesized baseline.
- [UK stage definitions (R2)](tickets/R2-uk-gg119-dmrb.md): GG 119 v2.0.1 (2025-04-30) defines exactly Stages 1–4 — no UK Stage 0; interim RSAs are the only pre-stage audits; response report + decision log; no severity scores in GG 119 itself.
- [USA stage definitions (R3)](tickets/R3-usa-fhwa-rsa.md): no numbered federal stages; named project phases × one phase-independent eight-step process; prompt lists are not stages; never map US phases onto UK numbers.
- [Canada stage definitions (R4)](tickets/R4-canada-tac-crsag.md): TAC CRSAG (2001) is recommended national guidance (paywalled); provincial ladders differ (Alberta Stage 1–3 + pre-opening, BC T-02/04 mandatory-in-MoTI, Ontario Good Roads 2023 municipal); stage IDs collide across jurisdictions → namespace per jurisdiction.
- [UAE stage definitions (R5)](tickets/R5-uae-adqcc-rsam.md): Abu Dhabi DMT RSAM 1st Ed. Jan 2018 (TR-540): native Stage 0 = feasibility/conceptual; sanctioned combined Stage 1/2 for smaller schemes; exemption certificates; Dubai contents unverified; all Abu Dhabi rules jurisdiction-flagged, never universal.
- [Stack + hosting (G1)](tickets/G1-stack-hosting.md): Next.js + Vercel free tier; provider-agnostic AI adapter OFF by default; hosted-KV persistence behind a seam. ADR-0001.

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

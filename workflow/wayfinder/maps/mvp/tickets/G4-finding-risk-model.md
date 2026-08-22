---
id: G4
title: Finding + risk model semantics
type: grilling
hitl: true
status: open
assignee:
blocked_by: [G2]
blocks: []
created: 2026-08-22
resolved:
---

## Question

Sharpen the typed Finding structure (§28 seed) against research evidence: category
taxonomy, severity/likelihood/exposure scales (canonical vs jurisdiction-specific),
confidence semantics, distinction between compliance findings and safety findings,
reviewer status workflow, and how assumptions and missing information attach to findings.

## Resolution

Resolved by ORCH under delegated authority (2026-08-22), evidence-grounded:

1. Two categorically distinct finding kinds: `safety_concern` | `compliance_question`.
2. Risk components (`severity`/`likelihood`/`exposure`) null-safe + framework-relative
   (scale-id tagged); UK renders "not scored under this framework" [EV-UK-024].
3. Recommendation wording discipline canonical across jurisdictions ("consider"/"must"
   banned [EV-UK-015]) — deterministic output-discipline rule.
4. Reviewer workflow: draft → accepted | accepted_with_edits | rejected | escalated;
   AI output stays candidate until human-adjudicated.
5. Missing info = MissingInformationQuestion artifacts + input states, never findings.

Decision: ADR-0003. Conflicts register C5/C6 updated.

# ADR-0003: Finding model — two categorically distinct finding kinds; null-safe framework-relative risk components

- **Status:** Accepted
- **Date:** 2026-08-22
- **Decided in:** Wayfinder ticket [G4-finding-risk-model](../../workflow/wayfinder/maps/mvp/tickets/G4-finding-risk-model.md)
- **Evidence:** `docs/research/standards-conflict-analysis.md` C5–C6 and cited records

## Context

GG 119 assigns no severity scores (risk assessment sits in designer response [EV-UK-024]);
US practice uses an optional qualitative frequency×severity matrix [EV-US-016]; Canadian
municipal guidance has its own matrix [EV-CA-021]. RSA is not compliance checking — the
product must never imply that passing checks means "safe".

## Decision

1. **Two finding kinds, categorically distinct**: `safety_concern` and
   `compliance_question`. No shared numeric scale bridges them.
2. **Risk components are null-safe and framework-relative**: `severity`, `likelihood`,
   `exposure` are structured labels, each optionally tagged with its framework scale id;
   `null` renders as "not scored under this framework" — never invented numbers.
3. **Recommendation discipline is canonical**: vague wording banned in recommendations
   ("consider", "must" per UK practice [EV-UK-015]); enforced by a deterministic output-
   discipline rule across all jurisdictions.
4. **Reviewer workflow**: findings carry `reviewer_status`
   (`draft → accepted | accepted_with_edits | rejected | escalated`); only auditor-reviewed
   findings appear in a final report. AI artifacts remain candidates until adjudicated.
5. **Missing information is not a finding**: it produces `MissingInformationQuestion`
   artifacts and input-state transitions (`unknown` / `not_available`), keeping findings
   about the Scheme and questions about inputs distinct.

## Consequences

- Cross-jurisdiction report comparisons stay honest: risk labels travel with their scale ids.
- The determinism test can assert identical findings for identical contexts, including
  which fields are deliberately null.

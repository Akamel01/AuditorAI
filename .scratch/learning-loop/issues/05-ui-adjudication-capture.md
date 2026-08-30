# 05 — UI wiring: adjudication capture → CandidateOutcome POST

Type: task · Status: resolved · Blocked by: 01

## Question

Wire the adjudication surface (src/app/** audits page) to emit CandidateOutcome rows:
accept / accept_with_edits / reject actions capture the whitelisted edited_fields +
optional note; consent checkbox records consent_version; pseudonymous auditor id from
session config. Additive API endpoint only. BEFORE WORK: check git status for live
parallel-session WIP in src/app/** and stash-coordinate (AGENTS.md lanes rule).

## Answer

RESOLVED. Consent strip + whitelist edits + pseudonym; declined=no rows; route tests via memory sink.

Implemented on the audits page (the candidate-review surface). No second API — the
existing `PATCH /api/projects/[projectId]/audits/[auditId]` was extended additively.

**Wire contract (additive to existing PATCH body):**
- `candidate_promotions[]` gained two optional fields for ADR-0009 whitelist parity:
  `edited_category?: string` ("" is a non-edit) and `edited_evidence_ids?: string[]`
  (undefined is a non-edit; ids not on the candidate are dropped, never minted).
- New optional body keys: `consent` and `auditor_pseudonym`.
- The client sends only actual diffs (unchanged prefilled values are omitted), so a
  plain accept stays a one-click no-edit action.

**Consent-declined semantics (decision):** the checkbox always sends an explicit
posture — `{version:"1.0"}` when checked, `{declined:true}` when unchecked. Declined
means **skip logging entirely**: dispositions still promote/reject on the stored
draft, but no row is constructed and nothing reaches the sink (no tombstone rows —
an unconsented decision must never exist in the log). When the consent key is
absent entirely (old callers, devtab, tests), the server defaults to logged under
CONSENT_VERSION with the default pseudonym, keeping every pre-existing call site
byte-identical. Malformed postures (e.g. `{nonsense:true}`, empty pseudonym) are
loud 400s rather than silent defaults.

**Auditor pseudonym:** stored in localStorage under `auditorai.auditor_pseudonym`
(default `auditor-a1`), editable inline next to the consent checkbox, sent as
`auditor_pseudonym` and threaded through `applyCandidatePromotions` →
`buildOutcomeRow` onto every row.

**Category select fallback:** pack vocabulary (`issue_categories`) is not exposed by
any client-reachable GET endpoint, so category is free text validated server-side.

**Server-authoritative validation:** edited_fields are constructed domain-side from
a fixed whitelist, so unknown keys can never reach the outcome schema; API 4xx
messages (banned wording, bad index, invalid posture) surface inline per card via
InlineNotice.

UI placement: one-line each —
- Consent bar: full-width strip above the candidate cards — checkbox left ("Log my
  decision for system improvement (pseudonymous)"), pseudonym input right.
- Candidate cards: new "AI candidates" section between the disclaimer and Findings;
  one card per pending candidate with Accept / Accept with edits / Reject buttons.
- Accept-with-edits panel expands in-card: statement textarea + category/evidence-id
  inputs side-by-side + recommendation textarea, exactly the whitelist.
- Reject panel expands in-card with an optional note input + Confirm reject.
- Note field also offered in the edits panel; errors render under the action bar.

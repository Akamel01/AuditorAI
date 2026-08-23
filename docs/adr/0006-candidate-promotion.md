# ADR-0006: Candidate promotion model — AI proposals are a distinct species; review promotes, never flips

- **Status:** Accepted
- **Date:** 2026-08-23
- **Decided in:** Reviewer grill session on [v3-architecture-deepening](../../workflow/wayfinder/maps/v3-architecture-deepening/MAP.md) Flag #2
- **Evidence:** ADR-0003 §4 ("AI artifacts remain candidates until adjudicated") left the
  candidate lifecycle undefined; AG-ADJUDICATION contract (amended 2026-08-23) records
  that candidates were display-only and dropped before any report

## Context

Live runs produce evidence-gated, boundary-validated AI candidates, but nothing could
ever act on them: `AG-ADJUDICATION` reads only deterministic findings, the stored draft
did not carry candidates, and CONTEXT.md had no Candidate term at all. Flag #2 committed
to an auditor-review UX; this ADR fixes its semantics.

Two structural facts shaped the decision. First, in production all human review already
happens post-pipeline on the *stored draft* (PATCH route) — the adjudication node runs
with zero decisions in live paths. Second, retention is already solved by issuing
(ADR-0004): drafts are per-run working state, including every reviewer_status on
deterministic findings.

## Decision

1. **Distinct species, not a shared status.** A Candidate is structurally a subset of
   Finding plus provenance (`producer`, source drawings); it is never itself a report
   member. Review does not flip a shared reviewer_status — it acts on the species.
2. **Promotion mints identity.** Acceptance creates a Finding with a fresh `F-AI-{seq}`
   id, `source_trace.origin="ai_candidate"` recording the producer, honest unscored risk
   components, and low confidence labelled as machine-originated. The wording discipline
   applies to edited recommendations exactly as for deterministic findings.
3. **Rejection drops without minting.** A rejected candidate leaves no Finding.
4. **Per-run ephemerality.** Candidates and their pending decisions live on the draft;
   a rerun replaces them like any other unissued result — identical to how reruns treat
   reviewer work on deterministic findings. Retention comes from issuing, not from
   candidate persistence.
5. **Issuance over unreviewed candidates succeeds loudly**: the frozen snapshot strips
   pending candidates entirely and appends a limitation line naming their count.
6. Review happens post-pipeline on the stored draft via the existing PATCH surface;
   pipeline nodes and node contracts are unchanged.

## Alternatives considered

- **Status-flip model** (candidates share the Finding type from birth): discarded —
  every consumer (report assembly, issue freeze, eval gates) would need to filter
  unreviewed AI entries forever; "what is in a report" becomes conditional.
- **Promotions survive reruns** (content-hash re-matching): discarded — inconsistent
  with how deterministic-finding reviews already behave under depth-1 drafts; revisit
  only if real usage shows auditors losing meaningful work.
- **Pipeline-level consumption by AG-ADJUDICATION**: discarded — contradicts where human
  review actually happens and would re-amend freshly settled contracts.

## Consequences

- `AuditResult` gains optional `candidate_findings`; deterministic results never set it,
  preserving golden byte-stability.
- Issued issues can reference AI-sourced findings only through promoted `F-AI-*`
  Findings — provenance is always inspectable per finding.
- The candidate-review UI mirrors the findings cards; rejected/pending state is visible
  only within the current draft's lifetime.

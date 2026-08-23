# ADR-0004: Audit lifecycle — mutable depth-1 draft; immutable numbered issued revisions

- **Status:** Accepted
- **Date:** 2026-08-23
- **Decided in:** Reviewer grill session on [v3-architecture-deepening](../../workflow/wayfinder/maps/v3-architecture-deepening/MAP.md) Flag #1
- **Evidence:** v3 five-track investigation finding that deterministic audit ids made
  history depth-1 "by accident of design"; RSA practice requires delivered reports be
  stable formal records (GG 119 report/response cycle)

## Context

Audit ids are deterministic per project+stage (`AUD-{project}-{stage}`,
`src/domain/pipeline/result.ts:67`), so every rerun silently overwrote the previous
results for that stage. The v3 investigation flagged this as an *accident*: nothing had
ever decided whether audit history should exist. Worse, CONTEXT.md defined an Audit as
"a single execution" — contradicting the overwrite behavior in code. Any future feature
relying on history would be built on undefined semantics.

The real workflow pulls both ways: before delivery, iteration is normal and most reruns
are worthless drafts; after delivery (to the Authority/designer), a report is a formal
professional record whose contents must not change silently.

## Decision

1. **Hybrid lifecycle, per Audit (= Scheme × Native Stage):** the Audit's current
   results are a mutable **Draft**, overwritten depth-1 by each Run. An explicit
   in-product act by the Auditor (**issuing**) freezes the draft into an immutable,
   sequentially numbered revision (**Audit Issue**: I1, I2, …).
2. **Issued issues are never modified or deleted.** Re-issue after designer response
   creates the next numbered revision; all revisions are retained permanently.
3. `AUD-{project}-{stage}` remains the identity of the Audit/draft line; issue
   revisions extend it. Exact storage-key format is implementation detail owned by the
   Repository (sole key-scheme owner since the v3 sweep).
4. Glossary redefined accordingly: CONTEXT.md now carries **Audit / Run / Audit Issue**
   (DEC-0005 wording), replacing the "single execution" definition.

## Alternatives considered

- **Pure state view** (depth-1 intended, zero retention): discarded — silent loss of
  previously delivered report versions is unacceptable for formal audits.
- **Append-only executions** (every run distinct): discarded — unbounded noise from
  exploratory reruns; forces every consumer to filter garbage versions.
- **One-shot close** (issue locks the stage; changes require a new cycle): discarded —
  designer-response iteration is inherent to the RSA process; forcing new cycles fights
  the actual workflow.

## Consequences

- Storage gains issue-revision coordinates; the Repository key scheme extends without
  breaking existing keys.
- History queries must distinguish draft-current results from issued lineage.
- UI eventually needs an Issue control and an issue list (product work; currently fogged
  alongside the candidate-review UX).
- Nothing in code changes today: current behavior (depth-1 overwrite) becomes
  *specified* rather than accidental, so nothing may rely on history until implemented.

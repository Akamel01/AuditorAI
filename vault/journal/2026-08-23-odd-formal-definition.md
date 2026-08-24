---
title: "ODD formal definition — ADR-0005/DEC-0006 via owner grilling session"
type: journal
date: 2026-08-23
owner: agent
---

Ran the dedicated ODD grilling session per handoff (`handoff-odd-formal-definition.md`),
paired grill-with-docs + domain-modeling. Ten owner decisions produced AuditorAI's first
formal Operational Design Domain: **ADR-0005**, glossary terms (**ODD / ODD Cell / Input
Floor** in a new CONTEXT.md "System boundary" section), eval-gates §2 trigger-path 5, and
DEC-0006 in the decision registry.

Decision shape, compressed: capability matrix (Framework × Canonical Stage) with structural
absences first-class; conjunctive membership (accepted mapping + gate-passing fixture);
three-zone edge behavior (refuse where structurally absent / stamp mapped-unproven runs /
Input-State degradation inside cells); per-cell input floors below which the claim fails
entirely; road-user + scheme scopes inherited from glossary and native framework statements;
versioned machine-readable declaration as an explicit Tier-1 trigger; three-zone claim
language. Matrix v1 snapshot ships four clean IN cells (UK S1, US prelim+final, INT prelim)
plus CA planning IN with an open incident flag.

Surprises worth keeping:

1. **The grilling caught a live regression.** The handoff said all five corpus projects pass;
   the latest full archive (2026-08-23T19-37-04-183Z) has GF-10 at 0.5% — JB-GF10-002 lost
   its `evidence_grounding=2` after commit 311fb8d purged fabricated EV-CA-007 (incident
   VAL-024) and the replacement evidence doesn't carry verbatim quotes for the pivotal claim.
   Owner ruled: membership reads from *any* post-fix passing archive with an active incident
   flag on latest-archive failure; §5 procedure stays open for a separate session.
2. **Repo state moved mid-session** — seven owner commits landed while grilling (input
   substance boundary e4fd8b2, ADR-0004 implementation 32369b1, baseline resolution
   ed2a16d). Working-tree assumptions from session start had to be re-verified before every
   write.
3. Precedent research (SAE J3016 / ISO 34503 / PAS 1883 / AV Act 2024) transferred cleanly:
   declared-envelope vs actual-conditions separation, versioned public declaration, mandatory
   out-of-envelope behavior. Physical condition taxonomies did not transfer — documentary
   products check envelopes at intake, not in real time.

Fogged out of this session (candidates for graduation): machine-readable declaration file +
intake wiring; readiness-campaign sample-inclusion corollary is recorded in ADR-0005 but its
map remains conversation-only until re-charted; claims-surface enforcement (prose only today).

Addendum (same session, post-commit ce22341) — owner rulings on open items, recorded here
because execution was scoped OUT of this session:

- **GF-10 / VAL-024**: classification ratified as rot-family (authored baseline lost
  evidentiary support through legitimate provenance purge; not judge drift, not engine
  regression). Strategy chosen: **swap + re-test** — replace JB-GF10-002 with a different
  well-grounded compliance baseline; move the `'conflicting'` MI-path coverage into a
  deterministic test instead of the judged corpus. CA cell keeps its incident flag until a
  fresh full archive passes under gates §5 with ORCH review + owner acknowledgement.
  Executor: a future non-ODD session.

Addendum 2 — ODD declaration Phase 1 (post-ce22341), owner decisions: declaration lives at
`policies/odd.json` (pack-data-driven idiom); enforcement = intake refusal + result stamping,
split into phases so nothing collides with the concurrently-running candidate-review session
(active in `src/domain/types.ts` / `src/lib/ai.ts`). Schema blessed as proposed, refined to
array `canonical_stage` for combined-audit spans. Input floors derived from GF manifests and
owner-blessed verbatim (UK collision-analysis stays floor; CA volumes stay above-floor).
Shipped: `policies/odd.json` v1.0.0 (10 cells), `contracts/schemas/odd-declaration.schema.json`,
8 invariant tests in `tests/domain/odd-declaration.test.ts`; ADR gained a Declaration log.
Gotcha worth keeping: fixture filenames drop the id hyphen (`GF-6` → `gf6-*`) — prefix checks
must strip hyphens before matching.


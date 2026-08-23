---
title: "proposal: Hold-note — fog item 5, report-generation + recommendation-drafting LLM assists (NOT FIRED)"
type: journal
date: 2026-08-23
owner: agent
---

Fog item 5 from MAP.md §Not yet specified, reviewed per handoff `handoff-d-fog-graduation.md`
decision table. Verdict: **condition NOT fired** for both sub-items (report-drafting assist and
recommendation-drafting assist). Handoff C landed *partially* — the handoff pre-decides that
case: NOT fired → hold-note referencing the exact remaining gap.

## Checked condition

"Eval corpus shows a quality baseline post-upgrade (all projects passing ≥90 %)."

## Evidence at review time (2026-08-23)

Latest Tier-1 archive `state/eval-scorecards/2026-08-23T03-23-50-642Z/`
(VAL-2026-08-22-017, result "PARTIALLY PASSED — 4/5"):

| Project | Mean dim total | passes_corpus_mark | tier2_review_required |
|---|---|---|---|
| GF-6 | 9.5 | true | false |
| GF-7 | 9.5 | true | false |
| GF-8 | 10.0 | true | false |
| GF-9 | 8.5 | **false** | **true** |
| GF-10 | 9.0 | true | false |

Zero-drop satisfied across all three re-baseline runs (02-49 / 03-10 / 03-23), but the
condition reads **all** projects ≥90 %. Four of five does not fire it.

### The exact remaining gap

GF-9 (INT preliminary-design interchange fixture) fails with pass rate 0 % of sampled
findings meeting minimums: JB-GF9-001 and JB-GF9-002 each cap `evidence_grounding=1`.
Their pivotal claims — CD-road weave adequacy at the recorded 1,100 pcu/h design-year flow,
and uncontrolled shared-use-path crossings at free-flow ramp terminals — rest on recorded
fixture inputs, but the ω rubric requires a verbatim quoted sentence asserting the pivotal
claim, and the only registered INT source (EV-IN-001, PIARC 2023R40EN order-library abstract)
is process text containing nothing on weaving or ramp-terminal crossings; the full PDF is
login-gated. This is a sourcing gap, not an audit-quality gap — but per §5.3 nothing may be
re-baselined or loosened to force the pass ("never weaken gates to make assists easier to
land").

Weighing note: the gap is arguably orthogonal to report-generation quality, so an owner could
amend the condition — that is an owner decision under eval-gates §3/§5, not one this session
may make alone.

## Exact trigger to re-check

1. Obtain quotable interchange-safety INT source material covering weave adequacy at
   recorded volumes and/or free-flow ramp-terminal crossings (PIARC full text or equivalent
   public-domain source).
2. Re-author GF-9 baselines against it per eval-gates §5.3 (ORCH review + owner
   acknowledgement as a new VAL record referencing failing and accepting runs).
3. Fresh Tier-1 run shows ALL FIVE projects `passes_corpus_mark=true` with zero-drop vs
   priors → condition FIRED.

If fired, design sequence (per map + A2 precedent): report drafting first, as AI-bounded
candidate/draft artifacts behind the `contracts/node-contracts/AG-REPORT.md` seam (today a
deterministic node; any assist would be declared-shape AI-CANDIDATES additions, deterministic
adjudication unchanged). Recommendation drafting shares the pattern but remains explicitly
rejected by A2 until this same condition fires. Any implementation touches §2 trigger paths →
Tier-1 scorecard newer than the change is mandatory.

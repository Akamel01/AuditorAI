# Evaluation Gate Policy (E5)

**Status:** draft for owner ratification (Checkpoint ω, 2026-08-22) · **Authority:** owner thresholds set in E1 (#7), harness in E4 (#18)
**Doctrine:** gates protect the release; the judge never ships a scheme. Enforcement starts human-in-the-loop by design.

## 1. The three tiers

| Tier | What | Where it runs | Blocking? |
|---|---|---|---|
| **Tier 0 — deterministic** | Golden fixtures GF-1..10 byte-stability, schema contracts, lint/typecheck/build | `ci.yml` on every push/PR | **Always.** Red CI = no merge, no deploy |
| **Tier 1 — judged corpus eval** | ox-alpha-as-judge scorecards over corpus fixtures via `npm run eval` / `eval.yml` | Manual (`workflow_dispatch`) or pre-release run | **On trigger paths** (§2): blocks *release*, not merge |
| **Tier 2 — owner sign-off** | Human acceptance decision | Release checklist (§4) | Blocks release when invoked |

## 2. Tier-1 trigger paths (owner-confirmed, E1)

A change to any of these MUST have a Tier-1 scorecard newer than the change, attached to the release checklist:

1. AI adapter changes (`src/lib/ai.ts`, adapter seam consumers)
2. Prompt changes (`buildPromptMessages` and any judge prompts)
3. Engine semantic changes (`src/domain/**` affecting findings/questions/manifests)
4. Jurisdiction pack edits (`policies/*/pack.json`)

Everything else ships on Tier 0 alone.

## 3. Threshold table (owner-set, E1 — do not adjust without §5)

| Gate | Value |
|---|---|
| Per-finding minimums | every dimension ≥ 1 **and** substance = 2 **and** evidence-grounding = 2 |
| Corpus pass mark | ≥ 90 % of sampled findings per project meet minimums |
| Regression tolerance | **zero-drop**: any decline in a project's mean dimension-total vs the prior archived run triggers §5 |
| Judge identity/effort | recorded per scorecard (`x-preview-f-free`, effort max) — a scorecard without provenance is invalid |

Latest archived run: `state/eval-scorecards/<latest>/` (first live archive
2026-08-22T22-13-39Z: all five projects below the 90 % mark — see §6).

## 4. Release checklist (human-in-loop)

Before any release where a §2 trigger path changed:

1. [ ] Run `OPENCODE_API_KEY=… npm run eval -- ` (or dispatch `eval.yml`) — fresh run archived.
2. [ ] Every project in scope shows `passes_corpus_mark: true`.
3. [ ] No project carries `tier2_review_required: true`; any that does goes to §5.
4. [ ] Scorecard judge provenance lines match this policy's model/effort.
5. [ ] Owner (or delegated releaser) records sign-off on the release; the referenced
      scorecard run-id is quoted in the sign-off comment.
6. [ ] `deploy.yml` prints this checklist as a reminder at deploy time.

If any box cannot be ticked → **no release**. Fix, re-run, re-check.

## 5. Drift & below-threshold procedure (never silent)

When a scorecard is below threshold or regresses:

1. **Freeze the affected surface** — no further releases touching §2 paths.
2. **Classify** from the scorecard justifications:
   - *Baseline rot* (authored expectations lag reality) → file fixture/baseline updates.
   - *Judge drift* (same inputs, scores moving) → re-score a known subset twice; if
     inconsistent, pin the judge model/effort and re-baseline per (3).
   - *Real regression* (a change caused it) → revert or fix forward; add a Tier-0 test
     encoding the failure shape where possible.
3. **Re-baseline requires ORCH review + owner acknowledgement** — recorded as a new
   validation-state record referencing both the failing and the accepting runs.
   Threshold values themselves change only through an owner session amending §3.
4. Nothing in this section may be executed silently by automation.

## 6. Worked example (real data, first archive)

The first live archive (run `2026-08-22T22-13-39Z`) scored all five corpus projects below
the 90 % mark — dominant causes: `evidence_grounding=1` where findings cite registry ids
with null quotes, and `vru_coverage=0` on vehicle-only compliance questions. Walking §5:
classification is *baseline rot vs rubric strictness ambiguity* → action: author decision
for the owner (quote-bearing baselines vs rubric clarification), fixtures untouched until
decided. This is the procedure working as designed: honest signal, explicit human decision,
nothing tuned to pass.

## 7. Deliberate deferrals

- Hard CI blocking on judge scores (revisit if human-in-loop proves insufficient).
- Third-party audit requirements.

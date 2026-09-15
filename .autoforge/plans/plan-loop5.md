# Plan loop-5 — H1 + H2 + H3-batch-1 (2026-09-15)

Grill order (ADR-0019): Lane A H1 || Lane B H2 → H3b1. H4/H7 blocked on judge transport (all free models 400/500 as of 2026-09-15).

## M-H2 counts-drift fix (orchestrator-inline, mechanical)
- `state/sample-corpus.json:933-939`: recompute counts from samples[] truth
  (total 83, reserve 46 = 41 + us-034..038; engine 6, judge 26, unassigned 5 —
  verify by role census, not assumption).
- Verify: `readiness-report.ts:144,158-160` outputs unchanged (they read samples[]).
- Touches: `state/sample-corpus.json` only.

## M-H1 DIRECT pairs (worker) — STAGED PROPOSED, ticket gate holds
- Author 6 pairs from ratified G9-D1..D6 (Karnataka field guide, INT):
  shapes split across finding-recommendation / evidence-risk-rank / stage-prompt-list
  (no new shape kinds); tier T3; jurisdiction INT; stage per quote (planning/preliminary-design).
- Stage in NEW `docs/RSA-Documents/pairs-proposed-g9d.json` with `"status":"PROPOSED"`
  per pair. DO NOT touch `pairs.json` / `finetune-*.jsonl` (unratified pairs NEVER
  enter training splits; pair-ratification is a later owner step).
- Script hardening (same worker): add Karnataka `SRC_OF` entry + update `:58`
  attestation to state the GF-9-DIRECT exception in `build-finetune.py`; rerun bare
  and prove `git diff` on finetune outputs is empty (idempotent, no content change).
- License proof: worker asserts each new pair's source resolves via catalog to
  `intl/piarc-irf/` + register exception covers GF-9-DIRECT; record proof in module brief.
- Touches: `docs/RSA-Documents/pairs-proposed-g9d.json` (new),
  `docs/RSA-Documents/scripts/build-finetune.py` (2 small edits). NOTHING else.

## M-H3b1 mining batch-1 (worker)
- Extract ≤10 candidate PDFs (discovery §3 list) via `extract-corpus.sh` to /tmp only.
- Draft 8-14 quote candidates as PROPOSED APPROVE/STRIKE lines in gf-quote-pack
  (existing format, CLEAR usa/ sources only); prove with verify-quotes.py.
- NO pairs, NO finetune contact (pairs await owner ratification — next wave).
- Touches: `docs/RSA-Documents/gf-quote-pack.md` (append-only). /tmp scratch only.

## Ship
- Reviews per module (read-only), validator battery, PR → CI → merge → prod health.
- Close H2 (done). H1 stays OPEN pending owner pair-ratification; H3 stays open
  until batch-2 + quote-ratification.

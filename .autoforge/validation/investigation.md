# Investigation — AutoForge Run: 07_validate

Scope: validation artifacts for tracker/run 28 (R1–R19, T2, M1–M8), OPS-loop evidence, vault state, plan, and health signals. Cross-check HEAD anchoring, cross-module interactions, and potential FOg/HTL risks.

Summary (high-signal): several load-bearing blockers remain in place (R1–R4, R13, R16–R18, M1–M8), which prevents dispatch of waves F and beyond. HEAD anchoring for evidence appears stale relative to current HEAD and requires regeneration to re-validate gates. Vault determinism guard is currently passing, but live-run notes show a read-only FS hazard during discovery; this could become a silent regression if FS state changes. Overall, the GO items (R5, R6, R7, R8, R9, R10, R11, R12, R14, R15, R19) are ready to dispatch once gating blockers are resolved or re-planned, with existing health checks indicating no fatal faults in the current environment.

Key evidence anchors (selected):
- HEAD anchoring automation stale: evidence commit anchor in OPS loop points to 056b75f, while current HEAD is a715ee8. See: .autoforge/validation/ops-loop-evidence.json (anchor lines, 118-119; 3-4 for commit). R17 gate status FOg due to stale trigger.
- Vault determinism: vault-sync --check exit 0 reported in ops-loop evidence; deterministic state preserved against uncommitted edits. See .autoforge/validation/ops-loop-evidence.json (vaultCheck: line 103).
- Live run hazards: PERSIST-WARN due to read-only state/discovery-ledger.json in D04 path; potential durability hazard if workdir FS state becomes read-write. See ops-loop-evidence.json lines 60-64.
- Tracker / Plan mapping: R1–R4 BLOCKED; R5–R12 OPEN; R13 OPEN HITL; R16–R18 FOG; R19 OPEN. See .autoforge/discovery/tracker-index.md and .autoforge/plans/plan.md entries cited in plan/ticket mappings. See: tracker-index.md lines 3-6, 23-31, 33-41, 43-46, 58-60, 63-66, 68-75, 78-85, 88-90, 93-95, and plan.md sections 15-28, 66-68, 81-90, 105-106, 113-116, 118-121, 123-130, 150-164, 165-178, 180-196.

Ranked findings (evidence-weighted):
- Load-bearing: R1, R2, R3, R4 BLOCKED by HITL/external gates; these block dispatch of Waves F (highest severity). Evidence: tracker-index.md 3-6; plan.md 15-21; MAP.md 41-45. See also plan DAG: M1→M4 and R4→T2 traceability in plan.md.
- Load-bearing: R13 (Eval gate freshness automation) OPEN with HITL; gating is critical for Tier-1 freshness. Evidence: tracker-index.md 63-66; plan.md 27-28; MAP.md 53-54.
- Strategic risk: R16–R18 (Brave quota, HEAD anchoring automation, Bento merge verification) flagged as FOG; potential drift if gating semantics change. Evidence: tracker-index.md 78-85, 87-89, 93-95; plan.md 30-33, 58-62, 165-178.
- Evidence staleness: R17 (HEAD anchoring automation) shows a stale trigger; evidence anchor commit in OPS-loop vs HEAD mismatch. Evidence: OPS-loop JSON 216-225; plan.md 31-32; MAP.md 57-59.
- Operational hazard: D10-like read-only state discovery hazard in live run (discovery-ledger.json read-only) could mask real failures. Evidence: ops-loop-evidence.json 60-63; 62-64.
- Minor/maintainability: non-critical lint/debug gaps (example: Brave 402 path not fully green; plan notes reference) but not blocking gating. See .autoforge/reviews/R16. md (as context) and plan notes.

Evidence mapping (selected sources and lines):
- tracker-index.md: R1–R19, T2, M1–M8 statuses (3-6, 23-24, 28-31, 33-36, 38-46, 58-60, 63-66, 68-75, 78-80, 83-85, 88-90, 93-95, 98-101, 103-106, 108-111, 113-116, 118-121, 123-126, 128-131, 133-136, 138-140).
- .autoforge/plans/plan.md: plan entries for the same 28 items; see sections for R1–R4 (15-21), R5–R9 (23-31), R10–R13 (51-66), R14–R15 (68-75), R16–R18 (78-89), R19 (93-95); T2 (24-25); M1–M8 (66-196).
- .autoforge/validation/ops-loop-evidence.json: the commit anchor (056b75f...), HEAD pointer (a715ee8), vaultCheck exit code, and anchoring notes (lines 2-4, 103, 118-120). See also historicalProbe section lines 112-120.
- .autoforge/discovery/tracker-index.md: up-to-date 28 entries with statuses and citations (R1–R19, T2, M1–M8). See lines 3-6 (R1) and 23-30 (R5–R9).
- docs/validation/eval-gates.md: governance on gating and tier structure to contextualize failures. See lines 6-13, 21-33, 54-60 for gating policies.

Root cause hypotheses (erstwhile hypotheses to falsify quickly):
- H1: HEAD anchoring drift causes false-positive HITL gating. Falsify by regenerating evidence to current HEAD and re-check gates.
- H2: Vault determinism race between HEAD and working tree not fully exercised in CI. Falsify by running vault-sync --check and ensuring committed state matches HEAD compilation.
- H3: Read-only FS hazard in discovery path (PERSIST-WARN) could escalate under production FS pressure. Falsify by exercising a writeable staging fs and re-running the OPS loop.
- H4: R16–R18 FOg gating indicates uncertainty in gating semantics; falsify by stabilizing gating rules and updating MAP/artifacts, then re-rerun evaluation.

Recommended plan (GO + REPLAN):
- GO: Proceed with GO items (R5, R6, R7, R8, R9, R10, R11, R12, R14, R15, R19) once the HEAD anchor discrepancy is resolved, and vault-determinism evidence is verified against HEAD. Validate health signals and confirm external gates remain unchanged. Also ensure that R4 still cannot dispatch without HITL proof; do not bypass gating.
- REPLAN: Implement a concrete loop-back to resolve blockers within 1 sprint:
  1) Regenerate OPS-loop evidence to HEAD: run node scripts/check-evidence-head.mjs, then node scripts/vault-sync.mjs (without --check) to refresh state and re-run typecheck/build; commit updated .autoforge/validation/ops-loop-evidence.json and .autoforge/validation/report.md as needed.
  2) Reconcile R1–R4 blockers by finalizing external HITL proofs (production HITL proof for R4) and adjust plan.md to reflect any policy decisions; align with MAP.md for traceability.
  3) Address R13 HITL gating to enable Tier-1 freshness automation: ensure HITL_EVAL_DOCTRINE_FROZEN gating policy is satisfied.
  4) Investigate R16–R18 FOGs: either downgrade to OPEN under updated gating policies or complete the gating artifacts (BRAVE quota stabilization, HEAD anchoring, Bento verification) to convert to GO or block again as needed.
  5) Create a targeted pre-release run to validate R5, R6, R7, R8, R9, R10, R11, R12, R19 in isolation, while leaving R1–R4 blocker items out of scope for that run.

Artifact paths cited in this investigation:
- .autoforge/validation/ops-loop-evidence.json
- .autoforge/discovery/tracker-index.md
- .autoforge/plans/plan.md
- .autoforge/validation/report.md
- docs/validation/eval-gates.md
- scripts/vault-sync.mjs

Notes for reviewers:
- This document mirrors the evidence catalog from the current run and should be updated after a gate-regression cycle or evidence regeneration.
- Do not ship changes here; the purpose is to surface risks and drive the REPLAN loop.

Output artifacts requested:
- Investigation document: .autoforge/validation/investigation.md (this file)
- Evidence alignment: updated OPS-loop evidence and plan mapping as needed.

Status: DRAFT. Awaiting confirmation on HEAD-anchor regeneration and gating resolutions.

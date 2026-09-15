# Glossary (living; grill-with-docs maintains)

- **DIRECT / ANALOG (C7):** DIRECT = quote from a scheme/jurisdiction-matched source; ANALOG = practice-level support, flagged. GF-9 pivotals were ANALOG until G9-D1..D6 (PIARC DIRECTs, ratified 2026-09-15).
- **PROPOSED / RATIFIED (C7):** AI proposes quote lines; owner checks APPROVE/STRIKE per line and signs `RATIFIED-BY`. Unratified lines NEVER enter scorecards, journals, or training splits.
- **Scoped-mining exception (C10):** dated, batch- and use-scoped owner sign-off recorded in `LICENSE-REGISTER.md` without changing the RESTRICTED verdict. Current: piarc-irf GF-9-DIRECT mining + use only.
- **Calibration run (eval):** side-by-side Tier-1 under a new judge vs archived means, delta published before cutover (ADR-0019).
- **Release-test floor:** 100 cataloged samples (`RELEASE_TEST_CORPUS_FLOOR`, `src/domain/split-firewall.ts`); tier dormant below.
- **Frontier (Wayfinder):** open + unblocked + unclaimed tickets. `ready_without_owner` = agent-executable now; `hitl_frontier` needs owner.
- **lane_gate (ticket):** named owner/trigger authority that must clear before execution (e.g. `OWNER_RATIFICATION`, `JUDGE_TRANSPORT`).
- **Twin (cleanup):** untracked compiled `.js`/`.jsx` shadowing tracked `.ts`/`.tsx` source; CI never sees them, local vitest/eslint can.

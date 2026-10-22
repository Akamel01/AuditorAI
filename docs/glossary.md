# Glossary (living; grill-with-docs maintains)

- **DIRECT / ANALOG (C7):** DIRECT = quote from a scheme/jurisdiction-matched source; ANALOG = practice-level support, flagged. GF-9 pivotals were ANALOG until G9-D1..D6 (PIARC DIRECTs, ratified 2026-09-15).
- **PROPOSED / RATIFIED (C7):** AI proposes quote lines; owner checks APPROVE/STRIKE per line and signs `RATIFIED-BY`. Unratified lines NEVER enter scorecards, journals, or training splits.
- **Scoped-mining exception (C10):** dated, batch- and use-scoped owner sign-off recorded in `LICENSE-REGISTER.md` without changing the RESTRICTED verdict. Current: piarc-irf GF-9-DIRECT mining + use only.
- **Calibration run (eval):** side-by-side Tier-1 under a new judge vs archived means, delta published before cutover (ADR-0019).
- **Release-test floor:** 100 cataloged samples (`RELEASE_TEST_CORPUS_FLOOR`, `src/domain/split-firewall.ts`); tier dormant below.
- **Frontier (Wayfinder):** open + unblocked + unclaimed tickets. `ready_without_owner` = agent-executable now; `hitl_frontier` needs owner.
- **lane_gate (ticket):** named owner/trigger authority that must clear before execution (e.g. `OWNER_RATIFICATION`, `JUDGE_TRANSPORT`).
- **Twin (cleanup):** untracked compiled `.js`/`.jsx` shadowing tracked `.ts`/`.tsx` source; CI never sees them, local vitest/eslint can.
- **Workspace:** the isolation boundary — the owner of a customer's projects, audits and artifacts; the unit a workspace credential grants access to. Canonical definition in `CONTEXT.md` (§ Tenant store).
- **Member:** a Subject belonging to a workspace, with a role; membership is checked per request once the tenant store serves that workspace, and a non-member is refused rather than served.
- **Subject:** the identity behind a credential (`subject_id`) — a person or seat a request is attributed to. Not yet an authenticated user: #54 supplies the named-user credential.
- **Credential:** the bearer secret a client presents, stored only as its short hash; rotatable and revocable, and revocation never deletes tenant data.
- **Legacy wire tokens (unchanged by #53):** `ws:<hash>` KV namespace, `x-workspace-key` request header, `auditorai.workspace_key` browser item — names and meanings unchanged.
- **G-2 open:** the browser still mints the workspace key (`src/lib/client.ts:19-26`); "the server derives tenant identity from something the client cannot mint" remains open until #54. #53 does not close it.

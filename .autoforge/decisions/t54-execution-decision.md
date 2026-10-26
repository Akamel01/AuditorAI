# Orchestrator decision — ticket #54 (final)

Date: 2026-10-22. Authority: AutoForge orchestrator, auto-approval lane.

## What was done

- Discovery: `.autoforge/discovery/report-t54.md` + `tracker-index-t54.md` (40 rows, exactly one frontier entry #54).
- Grilling: `.autoforge/requirements/grilling-t54.md` (R1–R13, 11 gap ACs, 8 assumptions, 22 hidden, 12 risks, 3 operator decisions D1–D3).
- Architecture: `.autoforge/architecture/report-t54.md` + `decisions-t54.md` (Alternative A chosen, M1..M12 seams, one migration, no new dependency).
- Orchestrator decisions: `.autoforge/decisions/od-t54.md` (OD1–OD11) and `.autoforge/decisions/od-t54-fixups.md` (OD12–OD20, the resolutions of the first critique's 8 blockers + 9 notes).
- Plan v2: `.autoforge/plans/plan-t54.md` (1315 lines, 12 modules, 8 waves, 24 ACs) + `.autoforge/execution/work-order-t54.json` (verified: valid JSON, 73 distinct paths, zero within-wave collisions, all blocked_by edges in earlier waves, every module has touches/tests/acceptance/blocked_by/commit_message/implements; OD1–OD20 all covered).
- Critiques: `.autoforge/reviews/plan-critique-t54.md` (first pass, CHANGES_REQUIRED, 8 blockers B1–B8) and `.autoforge/reviews/plan-critique-v2-t54.md` (second pass — see below).

## Orchestrator resolutions of the plan's open questions (binding)

**Q1 (DAG root / empty `blocked_by`).** M1 stays the sole root with `blocked_by: []`. A DAG needs exactly one root; inventing an edge would be a false dependency. Not a defect.

**Q2 (role change / "no UPDATE policy on `workspace_members.role`").** The plan's two-form implementation stands: (i) the app role holds no UPDATE privilege on the `role` column, (ii) the single UPDATE policy contains no `role` expression. Postgres has no column-scoped policies, so the privilege is the guarantee. The optional `BEFORE UPDATE` trigger is NOT added — the privilege is sufficient and the trigger would be belt-and-braces the reviewer asked for, not the ticket.

**Q3 (`SEAT_COUNT_DEFAULT` has no app-side reader).** DROPPED from the plan. The env var, its `.env.example` line, the operator step 2b, and the open-question entry are removed. The operator's provisioning SQL carries the number; the DDL's column default stays `1`. The env surface is now five names: `SUPABASE_AUTH_ENABLED`, `SUPABASE_AUTH_EMAIL_ENABLED`, `SUPABASE_AUTH_GOOGLE_ENABLED`, `SUPABASE_AUTH_MICROSOFT_ENABLED`, `SUPABASE_AUTH_REDIRECT_ORIGIN`.

**Q4 (legacy audit record carries no actor).** Accepted. On the legacy path the audit document IS the `AuditResult` and OD13 forbids a key inside a payload document, so the audit actor is stored on the Postgres path only (`audits.produced_by`); the issue, the project and the attachment carry it on both paths. The Postgres adapter is authoritative after the cutover. The asymmetry is recorded in the ADR.

**Q5 (`GET /api/auth/me`).** KEPT. The operator needs a user's uuid for the out-of-band owner provisioning (OD18). It returns only `{ subject, email }` and returns `{ subject: null }` with 200 when there is no session — **not** a 401. The orchestrator overrides the reviewer's note on this point: a 401 here would force the sign-in page into an error state on every first visit; a null subject is the correct degraded answer, and no tenant data is leaked. The test asserts the body shape, not a status code.

## Plan amendments to apply during execution (workers must follow these, not the plan's open questions)

1. Remove `SEAT_COUNT_DEFAULT` everywhere it appears in the plan (env table row, `.env.example` block, operator step 2b, open question 3). The DDL's `default 1` stays.
2. `/api/auth/me` returns 200 with `{ subject, email }` or `{ subject: null }`. No 401. No tenant data in either branch.
3. The `SEAT_COUNT_DEFAULT` removal means M12's `env-surface.test.ts` must not assert that name.

## Verdict

The plan (v2) is **APPROVED** for execution. The second critique's blockers are closed by OD12–OD20 and the remaining notes are either non-blocking or resolved above. The two plan amendments above are the only deltas the workers must apply.

## Execution order

Wave 0 — M1 (root). Wave 1 — M2, M7 (parallel, disjoint files). Wave 2 — M3. Wave 3 — M4. Wave 4 — M5, M8, M11 (parallel). Wave 5 — M6, M9 (parallel). Wave 6 — M10. Wave 7 — M12.

Every wave ends green: `npm run lint && npm run typecheck && npm run test && node scripts/vault-sync.mjs --check`. The worker commits small, single-purpose commits using the `commit_message` field in the work order, stages only the files its module touched, and never writes the literal `[skip ci]`.

## What the worker must NOT do

- Never create accounts, projects or secrets (OD12, ticket body). The Auth Admin API call lives in M10's accept route only.
- Never apply the migration (M7 is text only; the operator applies it).
- Never download a new dependency (OD8).
- Never add a `NEXT_PUBLIC_SUPABASE_*` name (OD9).
- Never claim G-2 is closed (OD1).
- Never commit `.autoforge/`, `.env*` or secrets.
- Never push to any branch other than `oc/54`.
- Never merge, close, edit or label issues.

## Stop conditions

- If a wave cannot be made green after a reasonable fix pass, stop and write `.autoforge/decisions/need-human.md` with the failing command's quoted output, then post it as a comment on #54.
- If the plan contradicts the repo (a file the plan assumes exists does not, or a function signature differs), stop and write the contradiction to `.autoforge/decisions/need-human.md` rather than guessing.
- If an operator decision is genuinely needed (D1/D2/D3 from the grilling), stop and ask — do not invent the commercial answer.

## Next step

Dispatch the workers in wave order. Wave 0 (M1) is the root; wave 1 (M2 + M7) can run in parallel once M1 lands. Report progress per wave.
# Orchestrator resolution of the plan critique — ticket #54

Date: 2026-10-22. Source: `.autoforge/reviews/plan-critique-t54.md` (verdict CHANGES_REQUIRED, 8
blockers B1–B8, 9 notes N1–N9). These resolutions are **binding** on the plan revision. The planner
folds them in; the worker then executes the revised plan.

Nothing here re-opens OD1–OD11 in `.autoforge/decisions/od-t54.md`.

## OD12 (resolves B1) — no public sign-up; accounts are created only by accepting an invite

- The app has **no open self-serve sign-up route**. `signUpWithPassword` and any `action:"signup"`
  call to Supabase are removed from the plan.
- An account is created in exactly one place: the **invite-acceptance** path. The invitee sets a
  password at acceptance; the server creates the user through the Supabase **Auth Admin API**
  (`SUPABASE_SERVICE_ROLE_KEY`, server-side only, `email_confirm: true`), then activates the
  membership row and signs the invitee in.
- A sign-in attempt for an email with no accepted invitation returns a plain notice
  ("no invitation for this email"). It creates nothing.
- The **first workspace member (role `owner`) is provisioned by the operator out of band** — SQL in
  `supabase/README.md`. The application never creates an owner.
- Module split: M9 = sign-in surface only (config, email sign-in, provider start, callback, signout,
  me). M10 = team surface **including** invite creation, invite list and invite acceptance (where
  account creation lives).

## OD13 (resolves B2) — the actor id never enters the frozen payload

- The actor id is written **only** to columns that sit beside the frozen payload, never inside it:
  `issued_by` on the issue, plus per-row actor columns that are siblings of `payload` in the same
  table. `payload` stays byte-identical whether or not an actor is present.
- Any module that touches the frozen record must prove it: a test asserts the frozen payload bytes
  are identical with and without an actor, and the restore byte-compare
  (`src/lib/persistence/issue-ledger.ts:114`) still passes.

## OD14 (resolves B3) — role is assigned at invite time; there is no role-change surface

- Roles are `owner` | `admin` | `member`, assigned **when the invite is created** (the inviter
  chooses `member` or `admin`; `owner` is never granted by the app).
- The invite insert policy permits `role='admin'` **only** when `app_claim_role()` is `owner`;
  otherwise only `member` may be inserted.
- The migration creates **no UPDATE policy on `workspace_members.role`**, and the app role gets no
  UPDATE privilege on that column. Changing a role is an operator SQL operation — documented in
  `supabase/README.md`, deferred to a follow-up ticket.
- Consequence: a plain member can never escalate, and the app needs no role-management UI.

## OD15 (resolves B4) — every wave must leave the repo green

- `npm run lint`, `npm run typecheck` and `npm run test` must pass at the **end of every wave**, not
  only at the end of the build. A worker that leaves a red wave does not finish.
- Therefore the repository-interface change that introduces the actor must be **backward compatible
  when it lands**: the actor is an **optional** parameter (`actor?: ActorContext`) on the
  repository interface, the callers that have one pass it, and the resolver **derives** a
  non-constant legacy actor when it is absent (never a constant, never a required argument).
- The `issued_by` type widens from the literal `"auditor"` to `string` in the **same** module that
  introduces the actor type, so nothing breaks typecheck mid-build.

## OD16 (resolves B5) — the migration lands before any code that reads its columns

- The migration module (0004) moves to an **earlier wave** than every module that reads
  `workspace_members.status`, `email`, `invited_by`, `expires_at`, `accepted_at`, `revoked_at` or
  `workspaces.seat_count`.
- No module may depend on a column before its migration lands, and no module may lean on the
  `SCHEMA_MISSING_STATES` fallback (`src/lib/db/identity.ts:79`) for the new columns — that fallback
  is for a missing tenant schema, not for a missing migration.

## OD17 (resolves B6) — the migration module owns the migration-enumerating tests

- `tests/integration/tenant-rls.test.ts` asserts the exact list of applied migrations
  (`:166-171`). The migration module owns that test file and updates the list.
- Rule for the plan: **any test that enumerates migrations or schema objects belongs to the
  migration module's `touches:`.** The plan must list it.

## OD18 (resolves B7) — one owner of the first-workspace-owner question

- The **operator** provisions the first owner (role `owner`) out of band, via the SQL procedure in
  `supabase/README.md`.
- The application never creates an owner and never auto-grants `owner` to the first subject it
  sees. A subject with no membership row gets the existing `WorkspaceMembershipError` → 403, exactly
  as today.

## OD19 (resolves B8) — seat_count is written only by the operator, out of band

- The app role may **SELECT** `workspaces.seat_count` and may **never** write it: no UPDATE
  privilege on that column for the app role (column-level grant), and no policy that permits it.
- Provisioning is an operator SQL statement executed with the platform's owner credentials
  (`POSTGRES_URL`, which the app never reads) or in the Supabase SQL editor — both bypass RLS. It is
  documented in `supabase/README.md`.
- The test must be non-vacuous: assert the **privilege shape** (that the app role does not hold
  UPDATE on the column) rather than relying on a pglite superuser write attempt, which would pass
  silently. The seat check itself is asserted through the app's own code path.

## OD20 (resolves N1–N9)

- **N1** — invite TTL = **14 days**, as an exported named constant (`INVITE_TTL_DAYS = 14`), named in
  the ADR, and asserted by a test: an invite past the TTL no longer consumes a seat.
- **N2** — the member list read is filtered by the caller's `workspace_id`; a member never sees a
  member row of another workspace.
- **N3** — the seat/role write path never uses the owner credentials. The app never reads
  `POSTGRES_URL` or `DB_ALLOW_OWNER`; a test asserts that.
- **N4** — **no backfill rewrites a historical `issued_by`.** Existing rows keep `"auditor"`; only
  new writes carry an actor. State this in the ADR.
- **N5** — the read type accepts the legacy literal (so historical rows type-check); the **write**
  path accepts only a validated actor, enforced by a runtime guard at the write site, not by the
  type alone.
- **N6** — drop `next.config.ts` from the touches unless a change there is genuinely required (the
  repo has no `vercel.json`).
- **N7** — a delete **is** a mutation of tenant state and carries the actor, like every other
  mutation. (The critique's "not a mutation" reading is rejected.)
- **N8** — the KV adapter and the Postgres adapter accept the actor identically: one interface, both
  implementations, same parameter.
- **N9** — a revoked member does not consume a seat (`status='revoked'` is excluded from the
  count).

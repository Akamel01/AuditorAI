# Orchestrator decisions — ticket #54

Date: 2026-10-22. Authority: AutoForge orchestrator (auto-approval lane).
Sources reconciled: `.autoforge/discovery/report-t54.md`, `.autoforge/requirements/grilling-t54.md`,
`.autoforge/architecture/report-t54.md`, `.autoforge/architecture/decisions-t54.md`.

The grill and the architecture disagree in places (the architect wrote before the grilling landed).
The orchestrator decides here, once, so the plan is not ambiguous. Every decision is reversible
except OD2-OD5, which change stored data — those are additive and backward compatible.

## OD1 — Scope

The ticket body governs: sign-in (email, Google, Microsoft), per-workspace seat count enforced at
invite, an actor id on every mutation and issued record, rotatable/revocable credentials. That is
G-1 + G-5, the gap audit's own scope for this ticket.

G-2 is **not** closed by this ticket. `CONTEXT.md:283-288` says G-2 "remains open until #54" and
`docs/glossary.md:16` disagrees with the tracker index. Resolution: G-2 is satisfied on the **Postgres
tenant path** (server-issued credential from #53 + named-user session from #54) and remains **open on
the legacy KV path**, whose browser still mints the workspace key (`src/lib/client.ts:19-26`). This
ticket must update `CONTEXT.md` and `docs/glossary.md` to say exactly that, and no document may claim
G-2 is fully closed. The legacy path's retirement is the `TENANT_STORE=postgres` cutover, not this
ticket.

## OD2 — Actor id vocabulary

`issued_by` stops being the literal `"auditor"` (`src/domain/types.ts:304`) and becomes a
non-constant string with three forms:

- `u:<uuid>` — a signed-in Supabase user id (Postgres path).
- `legacy:<16-hex>` — the credential holder on the legacy path, derived from the presented
  workspace key using the existing repo convention (`src/lib/db/migration.ts:136-138`,
  `legacySubjectFor`). Non-constant, resolvable to the credential, honest about not being a person.
- `admin:<digest>` — an admin/dev-console actor (the admin key digest).

Consequences the plan must own:

- On the legacy path the **value** written to `issued_by` changes from `"auditor"` to
  `legacy:<hash>`. Accepted: G-1 forbids the constant actor (`docs/research/enterprise-gap-audit.md:527-528`).
  It is metadata, not the frozen payload; existing stored records keep their value. A test must prove
  the restore byte-compare still passes (`src/lib/persistence/issue-ledger.ts:114-120`).
- The actor id is **never** written into the frozen `AuditResult` payload and **never** into the
  ADR-0009 outcome log (`state/candidate-outcomes/`). It lives in `issued_by` and in per-row actor
  columns only.
- The browser-asserted `EvidenceOverride.auditor_pseudonym`
  (`src/domain/types.ts:240-242`) keeps its current meaning in this ticket. The resulting ambiguity
  (two attributions on one formal record) is **documented in the ADR and deferred** to a follow-up
  ticket — not silently resolved here.

## OD3 — Production behaviour unchanged

While `TENANT_STORE` is unset (production today), the legacy KV path keeps serving exactly as it
does: same header, same key storage, same namespace, same responses, same status codes. No new
dependency and no new env var may be required for the legacy path to work. The legacy path never
refuses a mutation for want of an actor id.

## OD4 — Seat semantics

- A **seat** = an accepted member **+** a pending, unexpired invitation. This is the only reading
  under which "enforced at invite" is a true sentence (grilling §5.1). A pending invite holds a seat
  until it expires; expiry is a column (`expires_at`) evaluated when the count is computed, so no
  background job is needed.
- The **limit** lives in `workspaces.seat_count` (column), defaulting from env
  `SEAT_COUNT_DEFAULT` (default `1`).
- **Who may invite**: a member whose role is `owner` or `admin`. A workspace's first member is
  `owner`. A plain `member` may not invite.
- **At the limit**: the invite is refused with a typed error in the house style
  (`src/lib/db/errors.ts`), mapped to HTTP `409` through the existing error table
  (`src/lib/api.ts:146-161`).
- **Operator admin**: may raise `seat_count` out of band (that is provisioning the entitlement); the
  customer-facing invite path never bypasses the limit.

## OD5 — RLS hardening (mandatory, with tests)

Three holes must be closed by the migration, each with a test:

1. `workspaces_update` (`supabase/migrations/0002_rls_policies.sql:70-73`) lets any member UPDATE
   its own workspace row — so a `seat_count` column there would be raisable by the party it
   constrains. The app role must not be able to write `seat_count` (column-level privilege revoke).
2. `workspace_members_select` (`:77-79`) shows a member only their own row, so neither the count nor
   the team page can work. Widen it to the members of the caller's own workspace.
3. `workspace_members` insert requires `subject_id = app_claim_subject()` (`:80-82`), so the app
   cannot insert a member row for another subject. The invite path needs a role carried in the claim.

## OD6 — Sign-in mechanism

- **Email**: email + password, server-mediated against the Supabase Auth REST API
  (`/auth/v1/signup`, `/auth/v1/token?grant_type=password`). No mail provider is required, so the
  flow is testable without the operator's project. Magic link / email OTP are **deferred** (they need
  operator SMTP). Email verification and password reset are **deferred** to a follow-up ticket.
- **Google / Microsoft**: server-mediated OAuth2 PKCE through the Supabase authorize endpoint. The
  operator configures those apps later, so when the provider env var is absent the provider is simply
  not offered and the API answers a plain "sign-in not configured" notice — never an error, never a
  crash.
- The browser never receives a token, a key or a Supabase URL it must call. The session is an
  `httpOnly` cookie set by the server.

## OD7 — No PII mapping table in this ticket

The grill's D3 (a re-identifiable user-id ↔ pseudonym mapping) is a compliance/product decision that
this ticket does **not** pre-empt: #54 creates no mapping table, no PII store and no re-identification
path. ADR-0009's promise (mapping outside the log) stays true because no mapping exists. Account
deletion / PII purge is deferred to a follow-up ticket.

## OD8 — No new runtime dependency

`@supabase/supabase-js`, `@supabase/ssr` and any JWT library are **out**: the box disk is tight, the
repo has no such dependency today, and the server-mediated flow is implementable on `node:crypto`
plus `fetch` with `fetch` injected for tests. JWT verification must be HS256 against
`SUPABASE_JWT_SECRET` and must reject `alg=none`, a wrong signature, an expired token and a wrong
audience/issuer. Pinning and scanning is #47's job, not this ticket's.

## OD9 — Environment variables

- **No new `NEXT_PUBLIC_SUPABASE_*` name** — `tests/integration/secret-boundary.test.ts` Rule 2
  forbids it, and that test must keep passing.
- Provider switches are **server-side** env vars with non-`NEXT_PUBLIC` names, e.g.
  `SUPABASE_AUTH_ENABLED`, `SUPABASE_AUTH_EMAIL_ENABLED`, `SUPABASE_AUTH_GOOGLE_ENABLED`,
  `SUPABASE_AUTH_MICROSOFT_ENABLED`, `SUPABASE_AUTH_REDIRECT_ORIGIN`, `SEAT_COUNT_DEFAULT`.
  The browser learns what is offered from a server route (`/api/auth/config`), never from env
  exposure.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` already exist and stay allowed.
- Every new name is added to `.env.example` with a comment saying what it switches on, and absent =
  a degraded notice.

## OD10 — Dev console

The `/api/dev/*` surfaces are admin-gated and deliberately not tenant-scoped
(`src/app/api/dev/runs/[runId]/finish/route.ts`). They stay **out of scope** for the actor-id
requirement, and the plan must state that exclusion in writing. Where a dev route creates a record
that needs an actor, it stamps `admin:<digest>`. The constant `"auditor"` must not survive anywhere.

## OD11 — The unconfigured states (one observable behaviour each)

| Condition | Behaviour |
|---|---|
| Supabase auth env absent | Sign-in page says sign-in is not configured; the product otherwise works exactly as today. |
| Google/Microsoft env absent | That provider is not offered; the rest of sign-in works. |
| `TENANT_STORE` unset | Legacy KV path; no seat UI, no session requirement, no new env var needed. |
| Database unreachable | The existing fail-closed behaviour (`DatabaseUnavailableError`) — no new failure mode. |

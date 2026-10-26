# Architecture — Ticket #54 (Supabase Auth sign-in, per-workspace seats, actor id on every mutation and issued record)

Repo: `Akamel01/AuditorAI` · branch `oc/54` · read-only design pass.
Inputs: `.autoforge/discovery/report-t54.md`, `.autoforge/discovery/tracker-index-t54.md`,
`docs/research/enterprise-gap-audit.md:518-529` (G-1), `docs/research/enterprise-gap-audit.md:569-580` (G-5),
ticket #54 body.

**Grilling input was unavailable at write time.** `.autoforge/requirements/grilling-t54.md` did not exist
when this report was written (the requirements directory held only `grilling.md`, `grilling-HOLD.md`,
`grilling-deferred.md`, `grilling-remaining.md`). Every open question the discovery raised
(`.autoforge/discovery/report-t54.md:306-314`) is therefore answered *by this document* rather than by a
prior grilling artifact, and each answer is written so it can be overruled by a later grilling pass
without unwinding the module seams. If the grilling artifact lands and contradicts §2–§6, the alternatives
comparison and the decision log are the parts that must be re-run; the module table (§4) is built on the
seams, not on the answers, and survives a change of answer only where the answer is a data value.

Every repo claim below carries `path:line`. Where I could not verify a discovery claim I say so.

---

## 1. Scope and invariants

### 1.1 What this ticket must deliver

| # | Requirement | Where it lands |
|---|---|---|
| S1 | Sign-in with email, Google, Microsoft; Google/Microsoft degrade to a plain "sign-in not configured" state | §3.2, §7 |
| S2 | Every user has a resolvable identity distinct from the workspace key | §3.3, §6 |
| S3 | A seat count per Workspace, enforced at invite | §3.5, §5 |
| S4 | Every mutation carries the actor's user id | §3.4, §6 |
| S5 | Every issued record carries the actor's user id | §6 |
| S6 | The issued record still freezes | §6.4 |
| S7 | Rotatable, revocable credentials | §3.6 |
| S8 | Credentials are server-side, not browser-minted | §3.6 |
| S9 | The repo's own security record stops contradicting the code | M12 (`docs/validation/security-review.md:11`, `:17`, `:19`) |
| S10 | The agent never creates accounts and never handles secrets; names live in `.env.example` | M2, M12 |

### 1.2 The invariants this design must never break

**I1 — Production is unchanged while `TENANT_STORE` is unset.**
`tenantStoreEnabled()` is `TENANT_STORE === "postgres"` (`src/lib/db/config.ts:30-32`) and
`isDatabaseConfigured()` additionally requires `TENANT_POSTGRES_URL` (`src/lib/db/config.ts:35-37`).
An existing caller holding a workspace key must keep working *exactly* as today: the same header
(`src/lib/api.ts:31`, `src/lib/client.ts:77`), the same 401 for a missing/short key
(`src/lib/api.ts:79-88`), the same legacy KV store, the same key namespace
(`src/lib/persistence/store.ts:236-240`), the same rate-limit bucket (`src/lib/api.ts:90`), the same
"database not configured" notice (`src/lib/db-notice.ts:58-69`), the same 200-with-legacy-list
degradation (`tests/integration/database-not-configured.test.ts:121-140`). **The design adds a second,
additive identity channel (a server-verified Supabase session) and never removes, renames, reorders or
re-derives the workspace-key channel.** Every path that the workspace key alone drives today still
works when no session cookie exists. Addressed again in §7 (state 3).

**I2 — The issued record still freezes, and its frozen payload still byte-compares on restore.**
`IssueLedger.saveIssue` computes `revision = prior + 1`, refuses an existing key, and writes the record
once (`src/lib/persistence/issue-ledger.ts:40-52`); the Postgres mirror relies on the revision being
part of the primary key (`supabase/migrations/0001_tenant_schema.sql:94-103`,
`src/lib/db/tenant-store.ts:204-241`). Restore compares the stored record with the imported record
byte-for-byte via `JSON.stringify(existing) === JSON.stringify(issue)` and raises
`IssueRevisionConflictError` on a difference (`src/lib/persistence/issue-ledger.ts:108-120`).
**The actor id is written into the frozen record's own field (`issued_by`), not into the frozen
`AuditResult` payload**, so the payload bytes of an already-issued revision are untouched, the
revision-in-key lineage is untouched, and the restore comparison keeps comparing the same two objects
it compares today. A pre-#54 export still restores byte-identically (both sides carry `issued_by:
"auditor"`).

**I3 — No secret ever reaches the browser except the Supabase publishable/anon key.**
The existing secret boundary is enforced by a source scan: no `"use client"` module may name
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `service_role`, `SUPABASE_JWT_SECRET` or
`POSTGRES_URL` (`tests/integration/secret-boundary.test.ts:44-51`); no client module may import
`src/lib/db/**` (`tests/integration/secret-boundary.test.ts:64-67`); the service-role names live only in
`src/lib/db/admin.ts` and `scripts/**` (`tests/integration/secret-boundary.test.ts:61-62`); and the only
permitted `NEXT_PUBLIC_SUPABASE_*` names are the three already listed
(`tests/integration/secret-boundary.test.ts:53-57`). **This design goes further than the invariant
requires: the browser never receives the Supabase URL, the anon key, or any token at all.** Every
sign-in interaction is server-mediated (§3.2), the session lives in `httpOnly` cookies, and the browser
only ever sees booleans from `GET /api/auth/config`. Consequence: **no new `NEXT_PUBLIC_SUPABASE_*` name
may be introduced** (the scan at `tests/integration/secret-boundary.test.ts:53-57` would fail), so the
provider switches are *server* env names read at request time (§3.2, M12).

**I4 — No client may mint an identity.**
The actor id is derived only from server-verified material: a Supabase access token verified
server-side against `SUPABASE_JWT_SECRET` (`src/lib/db/config.ts:64-67`, already reserved for this
ticket), or the server-side derivation of the presented credential's subject. **No request body, header,
query parameter or `localStorage` value can become the actor id.** This explicitly excludes the
browser-supplied `auditor_pseudonym` (`src/lib/client.ts:37-42`,
`src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:86-101`), which stays what ADR-0009
made it — a pseudonymous, self-asserted handle (§6.5).

**I5 — The workspace key remains a *tenant selector*, never an *identity*.**
Today the browser mints its own key (`src/lib/client.ts:19-26`) and that hash *is* the tenant
(`src/lib/api.ts:89`, `src/lib/persistence/store.ts:236-240`). That is G-2's problem, not #54's, but #54
must not make it worse: **the key keeps selecting the tenant and stops meaning "who"**. The actor is a
separate, server-derived value.

**I6 — The repo's persistence key scheme does not change.**
The gap audit sizes G-1 as "a cross-cutting change to the auth model **and the persistence key scheme**"
(`docs/research/enterprise-gap-audit.md:529`). The actor id is carried **in record bodies, never in
keys**, so `src/lib/persistence/keys.ts` is untouched and the KV namespace of an existing workspace is
byte-identical before and after this ticket.

**I7 — The agent never creates accounts and never handles secrets.**
The Supabase project, its keys and its OAuth apps are the operator's
(`supabase/README.md:23-52` is the precedent: the operator applies SQL by hand; "No agent ever applies
them", `supabase/README.md:8-9`). This design reads env only, adds no account-creating code, and adds
no new secret name to `src/` outside `src/lib/db/admin.ts`.

**I8 — The migration is applied by the operator, in order, and is re-runnable.**
`0001 → 0002 → 0003` are applied in that order and must not be reordered (`supabase/README.md:19-21`).
The new file is `0004` (§5).

### 1.3 Explicit non-goals

- WorkOS SSO (ticket #41, out of scope per `.autoforge/discovery/report-t54.md:24`).
- The append-only hash-chained audit trail and per-mutation tombstones (ticket #55). This is why
  `deleteAttachment` does not gain an actor field (§6.3).
- Per-member *data* credentials replacing the shared workspace key for every surface (G-2 / ticket #50's
  "server-issued credentials"). #54 issues one server-issued credential when a member is accepted into a
  workspace (§3.6) but does not migrate existing workspaces off the shared key.
- Replacing the KV store or flipping `TENANT_STORE`. That is an operator action (`supabase/README.md:85-88`).

---

## 2. Alternative designs

### Alternative A — "Supabase Auth only, no local user table; the Supabase uuid *is* the actor id"

The Supabase user uuid (JWT `sub`) is the user id. `workspace_members.subject_id` stores it directly
(that column is already free text — `supabase/migrations/0001_tenant_schema.sql:42-48`). No new table,
no user/member mapping layer, no second source of truth for identity.

- **Cost:** the smallest diff of the three. One new vocabulary, one widening of `AuditIssue.issued_by`,
  one session seam, one migration for seats/invites.
- **Breaks:** nothing that ships today, *provided* the actor on the legacy path is defined (§6.2). The
  identity of a person lives in Supabase's `auth` schema, which the app cannot read without the service
  role — so **the app cannot resolve an actor id to an email or a display name locally**.
- **Makes impossible later:** nothing structural. A local user table can be added later as a *cache*
  (email/display name per uuid) without changing the actor id's meaning. It does, however, make the
  *seat count* depend on Supabase's own user lifecycle: a user deleted in Supabase leaves a dangling
  `workspace_members.subject_id`, and the seat count must treat that row explicitly.
- **Rollback:** trivial — remove the session seam, revert `issued_by` to the literal, drop the migration.

### Alternative B — "Supabase Auth **plus** a local users table mapped 1:1 to a `workspace_members` row"

A new `public.app_users(id uuid pk, email text, created_at, last_seen_at)` plus a
`workspace_members.app_user_id` FK. The actor id becomes the local row's id; the row is the local
resolution of "an actor id resolves to a user".

- **Cost:** one more table, one more FK, one more backfill path, one more RLS policy set, and a
  consistency obligation (a local row must exist for every Supabase user who touches a workspace). It
  also multiplies the pglite fixtures (every identity assertion needs two rows).
- **Breaks:** the legacy path. The legacy KV store has no users table at all — a local user row would
  live in Postgres, which is *off* in production (§1.2 I1). So on the live path the local table does not
  exist, and the "resolves to a user" property is unavailable exactly where production runs.
- **Makes impossible later:** it makes the actor id a *local* id, which forecloses the cheap path where
  the actor id is simply the Supabase uuid. If the local table is later dropped, every stored actor id
  becomes unresolvable. It also pushes a local email store into a product whose ADR-0009 record
  deliberately keeps identity out of durable local logs (`docs/adr/0009-candidate-outcome-logging.md:29-31`).
- **Rollback:** hard. Actor ids already written into frozen records would point at a dropped table;
  the frozen records are write-once (`src/lib/persistence/issue-ledger.ts:30-45`), so they cannot be
  rewritten.

### Alternative C — "Local-first credential/session table; Supabase Auth as an optional upstream"

The app owns a `public.app_sessions` table (its own opaque session token → user id) and treats Supabase
Auth as an optional identity provider that merely vouches for an email.

- **Cost:** the largest of the three. It re-implements what Supabase Auth already does (token issuance,
  refresh, revocation, OAuth handshake, email verification) and adds a second revocation axis.
- **Breaks:** I3 and I7 by construction — a local session table means the app stores and validates its
  own session secrets, and `SUPABASE_JWT_SECRET` (reserved for exactly this at
  `src/lib/db/config.ts:64-67`) goes unused.
- **Makes impossible later:** migrating to Supabase Auth's own sessions becomes a second migration of
  every session, and the two revocation models have to be reconciled forever.
- **Rollback:** hardest of the three — a local session table is a new durable store with live
  credentials in it.

### Chosen: **Alternative A**, with one deliberate amendment

**A is chosen.** It is the only one of the three that satisfies I1–I7 simultaneously, and it is the only
one that is cheap to roll back. The amendment: **A's "no local user table" is kept, but the *invite
binding* needs a local email → subject mapping, so the mapping lives where the seat model already
needs it — `public.workspace_invites.email` (§5) — not in a parallel users table.** The pending invite row
is the one place where "an email that has not yet become a subject" must be durable; once accepted, the
row carries `accepted_subject_id` and the mapping is redundant.

Against the invariants:

- **I1** — A adds a channel; it never touches the key channel. B and C both change what the legacy path
  resolves to.
- **I2** — A writes the actor into `issued_by` (outside the frozen payload). B and C add a second
  identity store whose rows would need to be part of the frozen payload to be meaningful.
- **I3** — A can be fully server-mediated (no browser token at all). C cannot (it makes the app a
  token issuer).
- **I4** — A's actor comes from one verified source. B's actor comes from a local row the app writes —
  which makes a client-reachable write path into an identity write path.
- **I5/I6** — A touches no key.
- **I7** — A reads env only.

**The cost A accepts:** the app cannot resolve an actor id to an email locally. The team surface (§3.5)
needs an email → it gets it from the *invite row it wrote*, not from a user directory. A signed-in user's
own email is available from the verified JWT (`email` claim), so the UI never needs a directory.

**The alternative that was considered and rejected inside A:** making the actor id the *email* instead of
the uuid. Rejected — an email is mutable, is PII, and would put a personal identifier into every frozen
record, which collides with the ADR-0009 posture (`docs/adr/0009-candidate-outcome-logging.md:29-31`).

---

## 3. Chosen design

### 3.1 Shape in one paragraph

Two identity channels meet at one seam. The **workspace key** (unchanged, `x-workspace-key`) still
selects the tenant. A **Supabase session** (new, `httpOnly` cookie, server-verified) identifies the
person. The seam resolves both into a single `actor` id that is a **namespaced string**: `u:<uuid>` for a
signed-in user, `legacy:<16-hex>` for the anonymous holder of a workspace credential, `admin:<digest>` for
a dev-console operator. The actor id is written into the records a mutation creates or updates. The
Postgres tenant store (off in production) additionally gains a **seat count** on the workspace, a
**pending-invite** table, and a widened membership policy so an admin can invite a third party. Google
and Microsoft are *operator-configured later* and therefore **absent by default**: their provider buttons
do not exist until the operator sets the corresponding server env flag.

### 3.2 Sign-in (email, Google, Microsoft)

**Server-mediated, browser-token-free.** The browser never learns the Supabase URL, the anon key, or a
token.

| Step | Browser | Server | Supabase Auth |
|---|---|---|---|
| 1 | GET `/api/auth/config` | reads env, returns `{ configured, providers: ["email"] }` | — |
| 2 | POST `/api/auth/email {email}` | `sendMagicLink(email, redirectTo)` → `POST {url}/auth/v1/otp` | emails a link |
| 2' | GET `/api/auth/signin/google` | 302 → `{url}/auth/v1/authorize?provider=google&redirect_to=…&code_challenge=…` | — |
| 3 | follows the emailed link → `{appUrl}/api/auth/callback?token_hash=…&type=email` (or `?code=…`) | `verifyOtp` / `exchangeCode` | returns `{access_token, refresh_token, user}` |
| 4 | — | sets `auditorai.session` + `auditorai.refresh` (httpOnly) | — |
| 5 | — | 302 → `/projects` | — |

- **OAuth (Google/Microsoft).** The server generates the PKCE verifier, stores it in a short-lived
  `httpOnly` `auditorai.pkce` cookie, and computes the S256 challenge with `node:crypto`
  (`createHash("sha256")`, the same primitive the repo already uses at `src/lib/api.ts:67-69`). The
  verifier never reaches the browser.
- **Email.** The magic-link path uses Supabase's `token_hash` + `type` verify exchange, which works even
  when the link is opened in a different browser than the one that requested it (the PKCE verifier cookie
  is absent there). The callback accepts **both** `?token_hash=&type=` and `?code=` so the flow does not
  depend on which shape Supabase returns.
- **Provider availability is a server env flag, not a build-time constant.**
  `SUPABASE_AUTH_GOOGLE_ENABLED` / `SUPABASE_AUTH_MICROSOFT_ENABLED` are read at request time, so the
  operator can enable a provider *after* the deploy without a rebuild — which is exactly the operator's
  workflow (the OAuth apps are configured later). They are deliberately **not** `NEXT_PUBLIC_*`: the
  secret-boundary scan permits only three `NEXT_PUBLIC_SUPABASE_*` names
  (`tests/integration/secret-boundary.test.ts:53-57`), and a `NEXT_PUBLIC_*` value is inlined at build
  time, so it would be the wrong shape for a later operator change anyway.
- **"Not configured" is a state, not an error.** When `SUPABASE_URL` / the anon key / `APP_URL` are
  absent, `GET /api/auth/config` answers `{ configured: false, providers: [] }` and the sign-in page shows
  the plain notice (the `databaseNoticeText` pattern, `src/lib/db-notice.ts:58-69`, rendered by
  `InlineNotice`, `src/app/projects/page.tsx:65-69`). The legacy workspace-key path is untouched.
- **New env names** (server-side, added to `.env.example` by M12): `APP_URL`,
  `SUPABASE_AUTH_GOOGLE_ENABLED`, `SUPABASE_AUTH_MICROSOFT_ENABLED`. `SUPABASE_URL`, the anon key and
  `SUPABASE_JWT_SECRET` already exist (`src/lib/db/config.ts:53-67`, `.env.example:27-33`).

### 3.3 Identity resolution seam

**One place produces an identity: `resolveTenant` (`src/lib/db/identity.ts:127-192`).** The actor
resolution sits next to it, in the same request, and is the ONLY other place an actor id is produced.

```
requireWorkspace(req)                                src/lib/api.ts:73-123
  ├─ key = req.headers["x-workspace-key"]            src/lib/api.ts:79-88   (unchanged)
  ├─ session = readSession(req)                      (new; httpOnly cookie, JWT verified)
  ├─ resolution = await resolveTenant(key, session)  src/lib/db/identity.ts:127-192
  │     └─ credential → workspaceId + credentialSubject      identity.ts:137-144
  │     └─ actor subject = session?.subject ?? credentialSubject
  │     └─ membership + role of the ACTOR subject             identity.ts:164-177
  │     └─ → { mode:"postgres", workspaceId, subjectId, subjectRole, legacyHash }
  │        or { mode:"legacy", legacyHash, reason }           identity.ts:129-131, :155-159
  ├─ actor = session ? userActor(sub) : legacyActor(legacyHash)
  └─ → { ok:true, ws, repo, databaseStatus, actor, workspaceId }
```

`TenantResolution` (`src/lib/db/identity.ts:32-38`) gains `subjectRole` and `sessionSubject`; the
**legacy variant keeps carrying no subject** — that is deliberate and is the reason the actor on the
legacy path is derived in §6.2 rather than read out of the resolution.

**Why the credential still selects the tenant.** The credential row already binds
`(credential_hash → workspace_id, subject_id)` (`supabase/migrations/0001_tenant_schema.sql:50-57`) and
the resolution already refuses a non-member (`src/lib/db/identity.ts:164-177`). Re-keying tenant
selection onto the session would mean re-designing tenant establishment — which is ticket #50's job
("Which identity and tenant model", `.autoforge/discovery/tracker-index-t54.md:8`), not #54's, and it
would violate I1 for every existing caller.

**The claim gains two fields.** `claimsJson(subjectId, workspaceId)` (`src/lib/db/identity.ts:43-45`)
becomes `claimsJson(subjectId, workspaceId, role?, email?)`, and the claim document gains `"role"` and
`"email"`. They are read by two new SQL helpers, `public.app_claim_role()` and
`public.app_claim_email()` (M7), which read the claims GUC and **reference no table** — preserving the
explicit design rule of `supabase/migrations/0002_rls_policies.sql:3-8` ("NO POLICY REFERENCES ANOTHER
TABLE"). The `role` is DB-sourced: the app reads the actor's *own* membership row (visible under the
existing self-subject select policy, `supabase/migrations/0002_rls_policies.sql:77-79`) and re-issues the
claim with that role for the rest of the request. The `email` comes from the verified JWT.

**Trust note (stated plainly, because it is a real property of the existing model).** The app is the
policy engine: it sets `request.jwt.claims` itself. RLS is a second fence against application SQL that
forgets a workspace predicate, not an authorization layer. This design does not weaken that: the `sub`
and `workspace_id` in the claim remain credential-derived (`src/lib/db/identity.ts:137-144`) and the
`role` is read from the actor's own DB row rather than asserted by the client.

### 3.4 Request-time flow, end to end

```
browser                                  route handler                         Postgres
   │  POST /api/projects                     │                                  │
   │  cookie: auditorai.session (httpOnly)    │                                  │
   │  header: x-workspace-key: <k>            │                                  │
   │ ────────────────────────────────────────>│                                  │
   │                                          │ readSession(req)                 │
   │                                          │   verifyAccessToken(token,        │
   │                                          │     SUPABASE_JWT_SECRET) → sub    │
   │                                          │ resolveTenant(k, session) ───────>│
   │                                          │   credential row → workspaceId    │
   │                                          │   member row   → role            │
   │                                          │ actor = u:<sub> | legacy:<hash>  │
   │                                          │ repo.saveProject(ws, project, actor)
   │                                          │   → project.updated_by = actor ──>│
   │ <── 201 { project } ─────────────────────│                                  │
```

- The **actor is captured once per request**, at the seam, and is passed down explicitly. No route
  re-derives it, and no route accepts one from the body.
- The **repository seam is where it enters** (`src/lib/db/tenant-repository.ts:19-70`), because every
  tenant-scoped write goes through `auth.repo` (`src/lib/api.ts:117`) — 7 mutation call sites, not 21
  (`.autoforge/discovery/report-t54.md:187`).
- `requireAdmin` (`src/lib/api.ts:47-71`) also returns an actor (`admin:<digest of the presented admin
  key>`) so the dev console's requests are attributed to the operator, even though dev records are not
  firm records and carry no actor (§6.3).

### 3.5 Seats: the data model and the enforcement point

**Model (Postgres-only).**

- `public.workspaces.seat_count integer not null default 1` — the allowance. Set by the operator
  (`update public.workspaces set seat_count = 25`); the default is deliberately conservative (M12,
  `supabase/README.md`).
- `public.workspace_members` gains `status text not null default 'active'`, `email text`,
  `invited_by text`, `accepted_at timestamptz`, `revoked_at timestamptz`. The primary key
  `(workspace_id, subject_id)` is **unchanged** (`supabase/migrations/0001_tenant_schema.sql:47`) — no
  PK surgery, because `subject_id` stays `not null`.
- `public.workspace_invites` (new) — one row per pending invite: `workspace_id`, `email`, `role`,
  `invited_by`, `invite_token_hash`, `created_at`, `accepted_at`, `accepted_subject_id`, unique
  `(workspace_id, email)`.

**Why a separate invite table rather than a status column on `workspace_members`.** A pending invite has
no subject yet, and `subject_id` is the primary key and `not null`
(`supabase/migrations/0001_tenant_schema.sql:42-48`). Making it nullable means dropping the primary
key; keeping a placeholder (`invite:<token>`) pollutes the membership namespace with non-users that the
membership check (`src/lib/db/identity.ts:164-177`) would then have to special-case. A separate table
keeps "a member is a subject" true and lets the seat count be `members(active) + invites(pending)`.

**Enforcement point: the invite write, and nowhere else.**

```
POST /api/workspaces/team  { email }          src/app/api/workspaces/team/route.ts
  1. resolveTenant → must be mode:"postgres" (the seat model lives in Postgres)
  2. the actor's membership role must be "admin"      → else 403 NotWorkspaceAdminError
  3. BEGIN; set local role auditorai_app;
       set_config('request.jwt.claims', {sub, workspace_id, role:"admin", email})
       select seat_count from public.workspaces where id = $ws
       select count(*) from public.workspace_members where workspace_id = $ws and status = 'active'
       select count(*) from public.workspace_invites where workspace_id = $ws and accepted_at is null
  4. if members + pending >= seat_count → ROLLBACK; 409 SeatLimitExceededError
  5. insert into public.workspace_invites (...)      → COMMIT
```

The check and the insert are **one transaction** (`src/lib/db/sql.ts:11-14` is the seam;
`src/lib/db/sql.ts:44-47` is the role preamble; `src/lib/db/tenant-store.ts:79` is the existing
one-transaction-per-operation pattern). A race between two concurrent invites cannot exceed the seat
count, because the second transaction sees the first's committed row.

**Acceptance (the invited person becomes a member).** After a successful sign-in the callback (or
`POST /api/workspaces/team/accept`) looks for pending invites whose `email` equals the verified JWT's
email, and for each one inserts a `workspace_members` row with `subject_id = <the user's uuid>`,
`status = 'active'`, `accepted_at = now()`, and marks the invite accepted — in one transaction. The
insert satisfies the **existing** self-insert policy (`subject_id = app_claim_subject()`,
`supabase/migrations/0002_rls_policies.sql:80-82`) because the app sets the claim's `workspace_id` to
the invite's `workspace_id` in that transaction. **No policy change is needed for the acceptance path**
— only the admin-driven paths need widening (§5).

**Revocation frees the seat.** `status = 'revoked'` on a membership row (and `revoked_at`) makes the
membership check fail (`src/lib/db/identity.ts:164-177` → `WorkspaceMembershipError` → 403,
`src/lib/api.ts:160`), so the member's next request is refused *immediately* and no data is deleted.
The seat is released because the seat count only counts `status = 'active'`.

**Bootstrap (an OPERATOR step).** The first admin of a workspace must be created by the operator, because
the invite path requires an admin and there is no admin yet. One SQL statement
(`supabase/README.md`):

```sql
update public.workspaces set seat_count = 25 where id = '<workspace-uuid>';
insert into public.workspace_members (workspace_id, subject_id, role, email, accepted_at)
values ('<workspace-uuid>', '<supabase-user-uuid>', 'admin', 'owner@firm.com', now());
```

The app surfaces the signed-in user's uuid at `GET /api/auth/me` so the operator can paste it. This is
the "operator creates the project" posture the ticket states, applied to the one bootstrap fact the app
cannot bootstrap itself.

### 3.6 Credential rotation and revocation lifecycle

Two credential families exist; they are **not** the same artifact (discovery risk R1,
`.autoforge/discovery/report-t54.md:280`).

**(a) The Supabase session (a person's credential into the product).**
- Issued by Supabase at sign-in; the app stores it in `httpOnly` cookies only.
- **Rotated** by Supabase's refresh-token rotation on every refresh; the app never sees a rotation knob.
- **Revoked** by `POST /api/auth/signout`, which calls `{url}/auth/v1/logout` with the refresh token
  (so the revocation is *server-side at Supabase*, not merely a cookie delete) and then clears the
  cookies. A member's access to a workspace is additionally revocable *by an admin* through the
  membership status (§3.5) — which needs no service role and therefore no RLS bypass.
- The access token is verified **locally** (HS256 over `SUPABASE_JWT_SECRET`,
  `src/lib/db/config.ts:64-67`) — no network call per request. See the OPERATOR flag in
  `.autoforge/architecture/decisions-t54.md` (D9) about asymmetric signing keys.

**(b) The workspace credential (the tenant bearer key).**
- The existing lifecycle is reused as-is: `revokeCredential` sets `revoked_at` and never deletes the
  row (`src/lib/db/credentials.ts:62-88`); `rotateCredential` marks the old row `revoked_at` **and**
  `rotated_at` and writes a new row for the same workspace/subject
  (`src/lib/db/credentials.ts:92-165`, `:120-127`, `:147-152`). The resolution then rejects a rotated
  credential exactly like a revoked one (`src/lib/db/identity.ts:160-162`) — **rotation is total, there
  is no overlap window**. That is the existing, tested semantics and #54 does not change it.
- **What is new is who mints the next credential.** Today the *browser* mints it
  (`src/lib/client.ts:19-26`); G-5 names that as the evidence
  (`docs/research/enterprise-gap-audit.md:576`). #54 adds a **server-side issuance path**: the server
  generates the new credential value, calls `rotateCredential(presented, next)`, and returns the value
  **once** to the client, which stores it as its workspace key (`src/lib/client.ts` gains a
  `setWorkspaceKey`; the credential *hash* is what the server stores, `src/lib/db/credentials.ts:57-58`).
- **Guard: rotation and credential replacement are Postgres-only.** On the legacy KV path the key's hash
  *is* the data namespace (`src/lib/persistence/keys.ts:5-43`), so replacing the key would orphan the
  workspace's data. The route therefore refuses with a plain, named state when the resolution is
  `mode: "legacy"`. This is the single most important safety rule in the credential part of the design.
- **The same rule applies to the credential issued at invite acceptance**: a member's credential is
  issued only when the tenant store is Postgres; on the legacy path the member joins the seat count but
  keeps their own key (and the operator hands over workspace access out of band — a documented G-2
  residue, not a silent gap).

---

## 4. Module seams

`blocked_by` lists module ids. **No file appears in two modules' `touches:`** — this is checked
file-by-file and is the planner's collision contract.

| id | purpose | `touches:` | public interface | blocked_by | parallel-safe |
|---|---|---|---|---|---|
| **M1** | Actor vocabulary + the domain type widening. Dependency-free (browser-safe), like `src/domain/outcome-contracts.ts:1-5`. | `src/domain/actor.ts` (NEW)<br>`src/domain/types.ts`<br>`tests/domain/actor-id.test.ts` (NEW) | `src/domain/actor.ts`:<br>`export type AuditActor = \`u:${string}\` \| \`legacy:${string}\` \| "auditor"`<br>`export type ActorKind = "user" \| "workspace-credential" \| "admin" \| "unattributed"`<br>`export function userActor(subjectId: string): AuditActor`<br>`export function legacyActor(legacyHash: string): AuditActor`<br>`export function adminActor(digest: string): AuditActor`<br>`export function parseActorId(v: string): { kind: ActorKind; id: string } \| null`<br>`export function legacySubjectFor(legacyHash: string): string` (moved from `src/lib/db/migration.ts:135-137`; re-exported there) | — | yes |
| **M2** | Supabase Auth server core: env gating, provider URLs, OTP/PKCE/refresh/revoke calls, **local HS256 JWT verification**. No new runtime dependency (§8 of the decision log). | `src/lib/auth/supabase.ts` (NEW)<br>`src/lib/auth/__tests__/supabase.test.ts` (NEW) | `export interface SupabaseAuthEnv { url; anonKey; jwtSecret; appUrl; google; microsoft }`<br>`export function supabaseAuthEnv(): SupabaseAuthEnv`<br>`export function authConfigured(env?): boolean`<br>`export function enabledProviders(env?): ("email"\|"google"\|"microsoft")[]`<br>`export function providerSignInUrl(provider, { redirectTo, codeChallenge? }): string`<br>`export async function sendMagicLink(email, redirectTo, { fetchImpl? }): Promise<void>`<br>`export async function verifyOtp(tokenHash, type, { fetchImpl? }): Promise<AuthTokens>`<br>`export async function exchangeCode(code, verifier, { fetchImpl? }): Promise<AuthTokens>`<br>`export async function refreshSession(refreshToken, { fetchImpl? }): Promise<AuthTokens>`<br>`export async function revokeSession(refreshToken, { fetchImpl? }): Promise<void>`<br>`export function verifyAccessToken(token, secret, { now? }): { sub; email; exp } \| null` | — | yes |
| **M3** | Session cookie seam: read/verify the session, set/clear cookies, PKCE pair. | `src/lib/auth/session.ts` (NEW)<br>`src/lib/auth/__tests__/session.test.ts` (NEW) | `export const SESSION_COOKIE/REFRESH_COOKIE/PKCE_COOKIE`<br>`export interface AuthSession { subject; email; accessToken; refreshToken; expiresAt }`<br>`export function readSession(req: Request): AuthSession \| null`<br>`export function applySessionCookies(res: NextResponse, s: AuthSession): void`<br>`export function clearSessionCookies(res: NextResponse): void`<br>`export function newPkce(): { verifier: string; challenge: string }` | M2 | yes |
| **M4** | The identity resolution seam: the resolution carries the actor's subject/role; `requireWorkspace`/`requireAdmin` return an actor; the new typed errors. | `src/lib/db/identity.ts`<br>`src/lib/db/errors.ts`<br>`src/lib/db/repository-factory.ts`<br>`src/lib/api.ts`<br>`src/lib/auth/actor.ts` (NEW)<br>`src/lib/auth/__tests__/actor.test.ts` (NEW) | `identity.ts`: `resolveTenant(presentedCredential: string, session?: { subject: string; email: string \| null } \| null): Promise<TenantResolution>`; `TenantResolution` gains `subjectRole: "admin"\|"member"\|null` and `sessionSubject: string \| null`; `claimsJson(subjectId, workspaceId, role?, email?)`.<br>`api.ts`: `requireWorkspace(req) → { ok:true; ws; repo; databaseStatus; actor: AuditActor; workspaceId: string \| null }`; `requireAdmin(req) → { ok:true; actor: AuditActor }`.<br>`errors.ts`: `NotSignedInError`, `SeatLimitExceededError`, `NotWorkspaceAdminError`, `AuthNotConfiguredError`, `ProviderNotConfiguredError` (all mapped in `ERROR_TABLE`, `src/lib/api.ts:146-161`). | M1, M3 | yes (owns `src/lib/api.ts` exclusively) |
| **M5** | Actor propagation through the persistence seam: the interface widens, both adapters write it, the backfill carries it. | `src/lib/db/tenant-repository.ts`<br>`src/lib/persistence.ts`<br>`src/lib/persistence/issue-ledger.ts`<br>`src/lib/persistence/project-store.ts`<br>`src/lib/db/tenant-store.ts`<br>`src/lib/db/migration.ts`<br>`tests/domain/actor-propagation.test.ts` (NEW) | `TenantRepository` (`src/lib/db/tenant-repository.ts:19-70`) mutating methods gain a trailing `actor: AuditActor` parameter: `saveProject`, `saveAudit`, `saveIssue`, `saveAttachment`. `saveArtifactTrailFor` and `deleteAttachment` are **unchanged** (§6.3). `AuditIssue.issued_by` becomes `AuditActor`; `Project.updated_by?`, `AuditResult.produced_by?`, `Attachment.uploaded_by?` become optional additive fields. | M1, M4 | yes |
| **M6** | The mutation call sites pass the actor down. 7 files, no behaviour change beyond the actor. | `src/app/api/projects/route.ts`<br>`src/app/api/projects/[projectId]/route.ts`<br>`src/app/api/projects/[projectId]/audits/route.ts`<br>`src/app/api/projects/[projectId]/audits/[auditId]/route.ts`<br>`src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts`<br>`src/app/api/projects/[projectId]/attachments/[attachmentId]/route.ts`<br>`src/app/api/upload/route.ts` | No new exports. Each handler passes `auth.actor` into the repository call. The one-store-per-request invariant of `src/app/api/upload/route.ts:19-21` survives. | M5 | yes |
| **M7** | The Postgres schema change: seats, membership state, the invite table, the widened RLS, the two new claim helpers. | `supabase/migrations/0004_seats_invites.sql` (NEW)<br>`supabase/README.md` | SQL only. No TS export. | — | yes |
| **M8** | The seat + invite service: the seat arithmetic, the invite write, the acceptance, the membership listing. | `src/lib/db/seats.ts` (NEW)<br>`tests/integration/seat-invite.test.ts` (NEW) | `export interface SeatSummary { workspaceId; name; seatCount; usedSeats; members: { subjectId; role; status; email }[]; pendingInvites: { email; role; createdAt }[] }`<br>`export async function seatSummary(client: SqlClient, session: TenantSession): Promise<SeatSummary>`<br>`export async function createInvite(client, session, email): Promise<InviteRecord>` (throws `SeatLimitExceededError`)<br>`export async function acceptPendingInvites(client, { subject, email }): Promise<{ workspaceId; credential? }[]>` | M4, M7 | yes |
| **M9** | The sign-in surface: the auth routes and the sign-in page. | `src/app/api/auth/config/route.ts` (NEW)<br>`src/app/api/auth/email/route.ts` (NEW)<br>`src/app/api/auth/signin/[provider]/route.ts` (NEW)<br>`src/app/api/auth/callback/route.ts` (NEW)<br>`src/app/api/auth/signout/route.ts` (NEW)<br>`src/app/api/auth/me/route.ts` (NEW)<br>`src/app/sign-in/page.tsx` (NEW)<br>`src/app/_components/sign-in-form.tsx` (NEW)<br>`src/app/_components/ui/app-shell.tsx`<br>`next.config.ts`<br>`tests/integration/auth-routes.test.ts` (NEW) | `GET /api/auth/config` → `{ configured: boolean; providers: ("email"\|"google"\|"microsoft")[] }` (no secret, no token).<br>`POST /api/auth/email` → 202.<br>`GET /api/auth/signin/[provider]` → 302 to Supabase, or 503 `AuthNotConfiguredError`.<br>`GET /api/auth/callback` → 302 + cookies.<br>`POST /api/auth/signout` → 204, revokes at Supabase.<br>`GET /api/auth/me` → `{ subject, email } \| { subject: null }`.<br>`next.config.ts:10-43` registers the new routes for `outputFileTracingIncludes`. | M2, M3 | yes |
| **M10** | The team surface: the seat/invite API and the team page. | `src/app/api/workspaces/team/route.ts` (NEW)<br>`src/app/api/workspaces/team/accept/route.ts` (NEW)<br>`src/app/team/page.tsx` (NEW)<br>`src/app/_components/team-panel.tsx` (NEW) | `GET /api/workspaces/team` → `{ team: SeatSummary \| null; database_status: DatabaseStatus }` (the `database_status` shape of `src/lib/db-notice.ts:25-28`; `team: null` + the plain notice when the tenant store is not live).<br>`POST /api/workspaces/team` `{ email }` → 201 `{ invite }`, or 409 `SeatLimitExceededError`, or 403 `NotWorkspaceAdminError`, or 409/503 "requires the tenant store". | M8, M9 | yes |
| **M11** | The credential lifecycle surface: server-side issuance, rotation, revocation, and the client key store. | `src/lib/db/credentials.ts`<br>`src/app/api/workspaces/credentials/route.ts` (NEW)<br>`src/lib/client.ts`<br>`tests/integration/credential-lifecycle.test.ts` (NEW) | `src/lib/db/credentials.ts` gains `issueCredential(workspaceId, subjectId, credentialValue): Promise<CredentialRecord>` and `rotateCredential` keeps its semantics (`src/lib/db/credentials.ts:92-165`).<br>`POST /api/workspaces/credentials` `{ action: "rotate" \| "revoke" }` → `{ credential }` (rotate, **once**) or `{ revoked: true }`; refuses with a named state when the resolution is `mode:"legacy"` (the key hash is the KV namespace — `src/lib/persistence/keys.ts:5-43`).<br>`src/lib/client.ts` gains `setWorkspaceKey(key: string): void` (the client stores a server-issued key; it no longer *mints* the replacement). | M4 | yes |
| **M12** | The env surface and the records that must stop contradicting the code. | `.env.example`<br>`docs/validation/security-review.md`<br>`docs/adr/0020-named-user-identity-and-seats.md` (NEW)<br>`docs/adr/README.md` | `APP_URL`, `SUPABASE_AUTH_GOOGLE_ENABLED`, `SUPABASE_AUTH_MICROSOFT_ENABLED` added to `.env.example` (server-side names — **no** `NEXT_PUBLIC_SUPABASE_*`, per `tests/integration/secret-boundary.test.ts:53-57`). `docs/validation/security-review.md:11`, `:17`, `:19` updated (G-5's last acceptance item, `docs/research/enterprise-gap-audit.md:579`). A new ADR records the identity model, the actor vocabulary and the seat model. | M4, M7 | yes (sequence last for content) |

**Sequencing advice for the planner** (not ticket edges): M1 → M2/M3 → M4 → M5 → M6; M7 is independent
and can land first (it is SQL only, and the pglite suites apply every file in
`supabase/migrations` in sorted order — `tests/integration/tenant-isolation.test.ts:83-90` — so `0004`
is picked up automatically); M8 follows M7; M9 follows M2/M3; M10 follows M8/M9; M11 follows M4; M12 last.

**Cross-module hazards the planner must respect**

1. `src/lib/api.ts` is owned by M4 only. Any module that needs a new route behaviour must go through
   M4's interface, not edit `api.ts`.
2. `src/lib/db/identity.ts` is owned by M4 only. M8 (seats) and M11 (credentials) consume it; they do
   not edit it.
3. `src/lib/client.ts` is owned by M11 only. M9/M10 do not touch the transport.
4. `next.config.ts` is owned by M9 only; any later new API route must be registered there or it will
   500 on Vercel (`next.config.ts:3-9` explains why).
5. The `.env.example` and `docs/adr/README.md` edits are M12's alone, so the env names are declared once.

---

## 5. Data model change

### 5.1 The new migration file

**`supabase/migrations/0004_seats_invites.sql`** — applied by the operator, after `0001 → 0002 → 0003`,
never by an agent (`supabase/README.md:8-9`, `:19-21`). It is re-runnable, like `0002`
(`supabase/README.md:20-21`: "`0002` drops each policy before recreating it, so a re-apply is safe").
The pglite suites apply every file in `supabase/migrations` in sorted order
(`tests/integration/tenant-isolation.test.ts:83-90`), so `0004` is exercised offline with no extra
harness work.

**Ordering rationale.** `0004` depends on `0001` (the tables it alters) and on `0002` (the policies it
replaces) and on `0003` (the role it grants to). It must come **after** all three. It changes no
existing table's primary key and no existing policy's *shape* — it only widens two membership policies
and adds a table, so a re-apply after a partial apply is safe.

### 5.2 DDL sketch (text only — not applied)

```sql
-- AuditorAI tenant store, ticket #54 — seats, membership state, invitations.
-- Apply AFTER 0001 -> 0002 -> 0003. The operator applies this file by hand;
-- no agent ever applies it (supabase/README.md:8-9).

-- ---------- 1. the seat allowance ----------
alter table public.workspaces
  add column if not exists seat_count integer not null default 1;

-- ---------- 2. membership state ----------
-- subject_id stays NOT NULL: it is part of the primary key
-- (supabase/migrations/0001_tenant_schema.sql:47), so a pending invite is NOT
-- a membership row (it lives in workspace_invites).
alter table public.workspace_members
  add column if not exists status      text        not null default 'active',
  add column if not exists email       text,
  add column if not exists invited_by  text,
  add column if not exists accepted_at timestamptz,
  add column if not exists revoked_at  timestamptz;

-- ---------- 3. pending invitations ----------
create table if not exists public.workspace_invites (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        not null references public.workspaces(id) on delete cascade,
  email              text        not null,
  role               text        not null default 'member',
  invited_by         text        not null,
  invite_token_hash  text        not null unique,
  created_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  accepted_subject_id text,
  unique (workspace_id, email)
);
create index if not exists workspace_invites_workspace_idx
  on public.workspace_invites (workspace_id);
create index if not exists workspace_invites_email_idx
  on public.workspace_invites (email);

alter table public.workspace_invites enable row level security;
alter table public.workspace_invites force row level security;

-- ---------- 4. two more claim helpers ----------
-- Same shape as app_claim_subject(): read the claims GUC, reference NO table
-- (supabase/migrations/0002_rls_policies.sql:3-8).
create or replace function public.app_claim_role() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
create or replace function public.app_claim_email() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email' $$;

-- ---------- 5. the membership policies, widened for the admin ----------
-- A member still sees only their OWN row; an ADMIN of the workspace sees the
-- member list (needed to count seats). The role comes from the claim, which
-- the app fills from the actor's own membership row.
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members for select
  using (workspace_id = public.app_claim_workspace_id()
         and (subject_id = public.app_claim_subject()
              or public.app_claim_role() = 'admin'));

-- The admin may insert a member row for ANOTHER subject (the invite
-- acceptance path for a third party). Self-insert is unchanged, so the
-- KV->Postgres backfill (src/lib/db/migration.ts:536-543) keeps working.
drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members for insert
  with check (workspace_id = public.app_claim_workspace_id()
              and (subject_id = public.app_claim_subject()
                   or public.app_claim_role() = 'admin'));

drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members for update
  using (workspace_id = public.app_claim_workspace_id()
         and public.app_claim_role() = 'admin')
  with check (workspace_id = public.app_claim_workspace_id());

-- ---------- 6. the invite policies ----------
drop policy if exists workspace_invites_select on public.workspace_invites;
create policy workspace_invites_select on public.workspace_invites for select
  using (workspace_id = public.app_claim_workspace_id()
         and (public.app_claim_role() = 'admin'
              or email = public.app_claim_email()));
drop policy if exists workspace_invites_insert on public.workspace_invites;
create policy workspace_invites_insert on public.workspace_invites for insert
  with check (workspace_id = public.app_claim_workspace_id()
              and public.app_claim_role() = 'admin');
drop policy if exists workspace_invites_update on public.workspace_invites;
create policy workspace_invites_update on public.workspace_invites for update
  using (workspace_id = public.app_claim_workspace_id()
         and public.app_claim_role() = 'admin')
  with check (workspace_id = public.app_claim_workspace_id());
drop policy if exists workspace_invites_delete on public.workspace_invites;
create policy workspace_invites_delete on public.workspace_invites for delete
  using (workspace_id = public.app_claim_workspace_id()
         and public.app_claim_role() = 'admin');

-- ---------- 7. grants ----------
grant select, insert, update, delete on public.workspace_invites to auditorai_app;
grant execute on function public.app_claim_role()  to auditorai_app;
grant execute on function public.app_claim_email() to auditorai_app;
```

### 5.3 The RLS change that makes an admin-invite possible — and why this shape

The blocking policy today is `workspace_members_insert … with check (subject_id =
app_claim_subject() and workspace_id = app_claim_workspace_id())`
(`supabase/migrations/0002_rls_policies.sql:80-82`): under the `auditorai_app` role
(`supabase/migrations/0003_roles.sql:18-23`) an owner **cannot** insert a membership row for a different
subject, so "an owner invites a third party" is inexpressible.

Three candidate fixes, and why this one:

| Fix | Verdict |
|---|---|
| Use the service role for the invite write | **Rejected.** The service-role names are readable only in `src/lib/db/admin.ts` (`src/lib/db/admin.ts:9-14`; enforced by `tests/integration/secret-boundary.test.ts:61-62`), and the service role **bypasses RLS entirely** — the isolation guarantee would then depend on the app's own WHERE clause, which is exactly what `src/lib/db/tenant-store.ts:5-11` says RLS exists to make unnecessary. It also needs a Postgres path for a key that is an HTTP bearer, which the repo does not have. |
| Add a `SECURITY DEFINER` helper that counts members and inserts | **Rejected.** It is an RLS-bypass primitive owned by the migration executor, and it would put the seat count outside the policy graph — the first thing a buyer's security review asks about. |
| **Widen the membership policy with a claim-carried role** | **Chosen.** The role is read from the actor's own `workspace_members` row (visible under the existing self-subject select policy) and re-issued into the claim. The policy still references **no table** (the rule at `supabase/migrations/0002_rls_policies.sql:3-8` holds), the workspace predicate still holds, and the admin can only ever act inside the workspace the resolution granted. |

The `workspace_invites` select policy is the one place a row is visible **across** the actor's workspace
(`email = app_claim_email()`), because an invited person does not yet belong to the workspace they were
invited to — that is the whole point of the pending state. It exposes only the caller's own invite.

### 5.4 The `issued_by` column and the backfill path

- The column `public.audit_issues.issued_by text not null default 'auditor'`
  (`supabase/migrations/0001_tenant_schema.sql:100`) is **left as it is**: the default stays for
  historical rows, and the app now always supplies an explicit value.
- The backfill `src/lib/db/migration.ts:266` (`typeof document.issued_by === "string" ? … : "auditor"`)
  keeps its fallback: a legacy row that predates the actor field is migrated with `"auditor"`, which is
  the honest description of a record whose author is unknown. **Those rows cannot be re-attributed** —
  they are write-once (`src/lib/persistence/issue-ledger.ts:30-45`) and #54 does not rewrite them.
  `AuditIssue.issued_by` therefore admits `"auditor"` as a *read* value (§6.1) and never *writes* it.
- `src/lib/db/migration.ts` also gains: the `legacySubjectFor` re-export from M1, the `projects.updated_by`
  backfill param, and the `issued_by` write for newly-migrated rows (which carry the legacy actor
  `legacy:<hash>` — the same id the KV namespace implies, `src/lib/db/migration.ts:135-137`).
- The seat count is **not** backfilled: `workspaces.seat_count` defaults to 1 and the operator sets the
  real allowance (`supabase/README.md`).

### 5.5 What is *not* in the migration

- No change to `public.workspace_credentials` — the credential lifecycle is reused as-is (§3.6).
- No change to any primary key.
- No `app_users` table (Alternative B was rejected, §2).
- No new Supabase schema objects: Supabase Auth's own `auth` schema is the provider's, not ours.

---

## 6. Actor id propagation

### 6.1 The exact type change

`src/domain/types.ts:301-306` today:

```ts
export interface AuditIssue {
  revision: number;
  issued_at: string;
  issued_by: "auditor";      // <-- src/domain/types.ts:304
  result: AuditResult;
}
```

After this ticket:

```ts
// src/domain/types.ts
import type { AuditActor } from "./actor";

export interface AuditIssue {
  revision: number;
  issued_at: string;
  issued_by: AuditActor;     // was the literal "auditor"
  result: AuditResult;
}
```

with, in the new `src/domain/actor.ts`:

```ts
export type AuditActor = `u:${string}` | `legacy:${string}` | "auditor";
```

- The literal type `"auditor"` is a **compile-time blocker** today (`src/domain/types.ts:304`) — widening
  it is a visible change for every consumer, which is exactly what we want: the compiler points at every
  place that assumed a constant author.
- `"auditor"` stays in the union **as a read-only historical value** (the backfilled rows of §5.4).
  Honesty beats a tighter type here: the stored JSON is read back with a cast
  (`src/lib/persistence/issue-ledger.ts:62`), so a union that excluded `"auditor"` would be a lie about
  rows that exist in every migrated database.
- **The write path never produces `"auditor"`.** The two write sites use the constructors from
  `src/domain/actor.ts` (`src/lib/persistence/issue-ledger.ts:49`, `src/lib/db/tenant-store.ts:220`), and
  a test asserts that no writer emits the constant.

### 6.2 The actor vocabulary, and what it means on the legacy path

| Form | Produced when | Resolves to |
|---|---|---|
| `u:<supabase-uuid>` | a Supabase session cookie verified against `SUPABASE_JWT_SECRET` | a person: the Supabase auth user, and (on the Postgres path) a `workspace_members.subject_id` row |
| `legacy:<16-hex workspaceHash>` | no session — the caller presented a workspace credential | the workspace credential holder: the synthetic subject the KV→Postgres backfill already creates for that workspace (`src/lib/db/migration.ts:135-137`), i.e. a `workspace_members.subject_id` row once the workspace is migrated |
| `admin:<16-hex digest of the admin key>` | a dev-console request (`requireAdmin`) | the operator holding the admin credential |

**The legacy-path answer, stated rather than defaulted.** G-1 forbids a constant actor
(`docs/research/enterprise-gap-audit.md:527-528`). The legacy KV branch of the resolution carries no
subject at all (`src/lib/db/identity.ts:34-38`, `:129-131`, `:155-159`), so there is no person to name.
The design answers with the **third option**: a *derived, resolvable, non-constant* id — `legacy:<hash>`
of the presented credential. It is:

- **not constant** — it varies per workspace and per credential; two workspaces never share it, and a
  rotated credential produces a different id;
- **resolvable** — it is exactly the subject id the migration creates for that workspace
  (`src/lib/db/migration.ts:135-137`) and the subject the membership check uses
  (`src/lib/db/identity.ts:164-177`), so after the switch flips the *same* id resolves to a
  `workspace_members` row;
- **explicit** — the `legacy:` prefix names the kind; it never pretends to be a person.

**What this means for I1.** On the live path the issued record's `issued_by` changes from the constant
`"auditor"` to `legacy:<hash>`. That is the ticket's point (S5) and the gap audit's explicit demand
(`docs/research/enterprise-gap-audit.md:527-528`), so it is **not** treated as a violation of I1: I1 is
about *behaviour* (the same caller, the same key, the same data, the same responses), not about the byte
content of one field the ticket exists to change. Every other stored document, every key, every
namespace, every response shape and every status code is unchanged. **This tension is flagged in the
decision log (D3) for the orchestrator to confirm** — it is the one place where "production unchanged"
and "no constant actor" pull against each other, and the resolution is deliberate rather than silent.

### 6.3 Where the actor is captured and how it travels

1. **Captured once per request**, at `requireWorkspace` (`src/lib/api.ts:73-123`), from two sources only:
   the verified session (`src/lib/auth/session.ts`) or the resolution's `legacyHash`
   (`src/lib/db/identity.ts:128`).
2. **Carried on the auth object**: `auth.actor` (`src/lib/api.ts:76`, widened by M4).
3. **Passed explicitly into the repository seam** — the interface's mutating methods gain a trailing
   `actor: AuditActor` (`src/lib/db/tenant-repository.ts:19-70`).
4. **Written into the record** by the adapter:

| Method | Record | Field | Note |
|---|---|---|---|
| `saveIssue` | `AuditIssue` | `issued_by` (**required**) | the issued record; the ticket's named deliverable |
| `saveAudit` | `AuditResult` | `produced_by?` | rides in `public.audits.payload` jsonb (`supabase/migrations/0001_tenant_schema.sql:81-88`) — **no DDL** |
| `saveAttachment` | `Attachment` | `uploaded_by?` | rides in `public.attachments.payload` jsonb (`:107-114`) — **no DDL** |
| `saveProject` | `Project` | `updated_by?` | `public.projects` is **decomposed into columns** (`:65-74`, `src/lib/db/tenant-store.ts:105-128`), so this needs **one column** in `0004` |
| `saveArtifactTrailFor` | — | — | **unchanged**: the artifact trail is machine output written only by the dev console (`src/app/api/dev/runs/[runId]/finish/route.ts:28-33`), pruned to a summary (`src/lib/persistence/artifact-trail.ts:87-105`); it is not a firm record |
| `deleteAttachment` | — | — | **unchanged**: a delete has no record to name. The delete's attribution is ticket #55's hash-chained trail (`.autoforge/discovery/tracker-index-t54.md:12`) |

All three added fields are **optional** (`?`), because historical rows genuinely lack them (the KV
documents are copied verbatim by the backfill, `src/lib/db/migration.ts:225-230`, `:266`, `:271-284`), and
an optional field is the honest type for "absent on rows that predate the actor".

### 6.4 Why the freeze survives

- The revision stays in the key (`src/lib/persistence/issue-ledger.ts:41-45`,
  `supabase/migrations/0001_tenant_schema.sql:102`, `src/lib/db/tenant-store.ts:212-216`).
- The write-once conflict check is untouched (`src/lib/persistence/issue-ledger.ts:43-45`,
  `src/lib/db/tenant-store.ts:239-241`).
- The restore byte-compare (`src/lib/persistence/issue-ledger.ts:114-120`) compares the **whole
  `AuditIssue` object**, and the actor lives in `issued_by`, **outside the frozen `result` payload**. So
  the frozen payload's bytes are exactly what they are today, and a pre-#54 export/restore still
  round-trips byte-identically (both sides carry `issued_by: "auditor"`).
- The Postgres mirror stores the whole issue as `payload jsonb` plus the `issued_by` column
  (`src/lib/db/tenant-store.ts:223-238`), so the same property holds there.

### 6.5 The interaction with ADR-0009

ADR-0009 fixes a **pseudonymous stable auditor id** (`auditor-a1`) for the candidate-outcome log, with
"real identity mapping … outside the log" (`docs/adr/0009-candidate-outcome-logging.md:29-31`); the
default lives at `src/domain/outcome-contracts.ts:7` and is read from `localStorage`
(`src/lib/client.ts:37-42`).

**#54 does not link the pseudonym to the user id, and must not.** Concretely:

- `auditor_pseudonym` stays a **self-asserted, browser-local handle**. It is still what the evidence
  override carries (`src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:86-101`) and what
  the outcome log records.
- The **actor id** is a different thing with a different trust level: server-verified, persisted on the
  record. The pseudonym is neither persisted nor verified.
- The mapping "this pseudonym is that user" is **not** created by #54. Creating it would write a
  personal identifier into the local, gitignored outcome log
  (`docs/adr/0009-candidate-outcome-logging.md:18-20`), undoing ADR-0009's privacy property, and the
  outcome log is a different data store with its own retention rules.
- Consequence to state out loud: **a record can name a verified actor and a pseudonym at the same time,
  and the two do not correspond.** If a firm needs them to correspond, that is a separate, deliberate
  decision (and a separate ADR amendment) — not a side effect of #54.
- One mechanical consequence: `src/lib/client.ts` keeps `getAuditorPseudonym` / `setAuditorPseudonym`
  untouched. Nothing in #54 reads them for identity purposes.

---

## 7. Degraded and unconfigured states

One observable state per condition. No silent failures; no state is an outage unless it is one.

### State 1 — Supabase env vars absent (`SUPABASE_URL` / anon key / `APP_URL` unset)

- **Observable:** `GET /api/auth/config` → `200 { configured: false, providers: [] }`.
  `/sign-in` renders the plain notice **"sign-in not configured"** (`InlineNotice`,
  `src/app/_components/ui/inline-notice.tsx`; the wording lives in one plain module, the
  `databaseNoticeText` pattern at `src/lib/db-notice.ts:46-69`).
- **Not observable:** no error, no 500, no redirect loop. `POST /api/auth/email` → `503` with the plain
  message "sign-in not configured" (`AuthNotConfiguredError` in `ERROR_TABLE`, `src/lib/api.ts:146-161`).
- **Everything else is unchanged:** the workspace-key path, the legacy store, the projects list, the
  "database not configured" notice. The actor on every request is `legacy:<hash>` (§6.2).

### State 2 — Google / Microsoft env vars absent (`SUPABASE_AUTH_GOOGLE_ENABLED` / `…_MICROSOFT_ENABLED` unset)

- **Observable:** `GET /api/auth/config` → `200 { configured: true, providers: ["email"] }` — the
  Google/Microsoft buttons **do not exist**. Email sign-in is unaffected.
- **If the operator sets the flag but the provider is not configured in the Supabase project:**
  `GET /api/auth/signin/google` → `503` with the plain message **"this sign-in provider is not
  configured"** (`ProviderNotConfiguredError`) — the provider's own error is mapped to one named state,
  never a raw 500 and never a stack trace.
- **Testability:** the code path is exercisable with the flag set and a fake Auth endpoint (M2 takes an
  injected `fetchImpl`); **the operator's OAuth apps are never required to exist for a test to run**,
  which is the orchestrator's constraint.

### State 3 — `TENANT_STORE` unset (production today)

- **Observable:** the tenant store is legacy (`src/lib/db/config.ts:30-37`,
  `src/lib/db/identity.ts:129-131`). The projects list answers `200` with the legacy list and
  `database_status: { database_state: "legacy", code: "database_not_configured" }` — exactly as today
  (`tests/integration/database-not-configured.test.ts:121-140`).
- **The seat/team surface:** `GET /api/workspaces/team` → `200 { team: null, database_status: { … } }`
  and the team page renders the same plain notice. `POST /api/workspaces/team` → `409` with the plain
  message **"seats require the tenant store"**. This is a **notice, not an outage** — the same
  "degrade, never 503" posture as the tenant store itself (`src/lib/db/identity.ts:81-83`).
- **Credential rotation/revocation:** refused with the same named state — **the key hash is the KV
  namespace** (`src/lib/persistence/keys.ts:5-43`), so replacing it would orphan the workspace's data.
- **Sign-in still works** (Supabase Auth is an HTTP service, independent of `TENANT_STORE`), and the
  actor on an issued record becomes `u:<uuid>` — which is the point of the ticket and works on the live
  path.
- **Nothing about the legacy path changes** (I1).

### State 4 — The database is unreachable

- **Unchanged from today:** the resolution fails closed with `DatabaseUnavailableError` → `503` with a
  redacted body and **no** fall back to the KV store (`src/lib/db/identity.ts:97-100`, `:145-153`;
  `src/lib/api.ts:158`; asserted at `tests/integration/database-not-configured.test.ts:195-215`).
- **New:** the actor resolution is *local* (a JWT signature check), so it does not add a database
  dependency — the failure mode is unchanged, not amplified.
- **The auth routes are unaffected** (they never touch Postgres): sign-in, sign-out and
  `GET /api/auth/config` keep working while the tenant database is down. That is deliberate: identity
  availability must not be coupled to tenant-store availability.

### State 5 (extra) — a revoked credential, and a revoked member

- Revoked/rotated credential → `401`, redacted (`src/lib/db/identity.ts:160-162`,
  `src/lib/api.ts:159`). Unchanged.
- Revoked membership (`status = 'revoked'`) → `403`, redacted (`WorkspaceMembershipError`,
  `src/lib/api.ts:160`). The member's access ends on the very next request; **no data is deleted**
  (G-5's "revocation … takes effect without data loss", `docs/research/enterprise-gap-audit.md:578`).

---

## 8. Failure modes and rollback

| # | Failure | What breaks | Blast radius | Rollback |
|---|---|---|---|---|
| F1 | `0004` applied to a database whose `0001`/`0002`/`0003` are not applied | the ALTER/CREATE fails on a missing table | the operator's SQL session; the app is unaffected (the tenant path is off in production) | re-apply `0001→0002→0003` then `0004`; the app's own degradation path (`src/lib/db/identity.ts:149-151`) covers a missing schema |
| F2 | `0004` applied **partially** (e.g. the table was created, the policies were not) | an admin invite is refused by the old insert policy; the seat count column exists | the seat feature only; identity, sessions and the legacy path are unaffected | `0004` is re-runnable: every statement is `if not exists` / `drop policy if exists` + `create policy`, exactly like `0002` (`supabase/README.md:20-21`). Re-apply the file |
| F3 | The operator flips `TENANT_STORE=postgres` **before** the seats migration | the tenant path serves Postgres; the seat surface reports "seats require the tenant store" | the seat feature only | apply `0004`; no code change |
| F4 | `SUPABASE_JWT_SECRET` does not match the project's signing key (e.g. the project uses asymmetric ES256/RS256 keys) | every session fails verification → `readSession` returns null → the actor falls back to `legacy:<hash>` | **silent degradation**: sign-in appears to work but the actor is never a user | OPERATOR: set the correct secret, or (out of scope) add JWKS verification. This is flagged as **OPERATOR D9** — it is the one failure mode that is *not* observable as an error, only as a missing actor |
| F5 | The operator never sets `SUPABASE_AUTH_GOOGLE_ENABLED` | no Google button | none | set the flag; no deploy needed (server env, read at request time) |
| F6 | The Supabase project has public sign-ups disabled | `POST /auth/v1/otp` errors | the email sign-in path | the operator enables sign-ups, or the app surfaces the plain "sign-in not configured" state (the error is mapped, not raw) |
| F7 | The session cookie is present but expired | `readSession` returns null → the actor is `legacy:<hash>` | a signed-in user silently degrades to the credential actor | refresh at the callback/refresh path; the expiry is checked in `verifyAccessToken` |
| F8 | A credential is rotated on the legacy path (the guard in M11 fails) | the workspace's KV data would be orphaned | **high** — this is why M11 refuses the rotation on the legacy path | the guard prevents it; if it ever fires, the old key still works (rotation never deletes the old row until the new one is committed — `src/lib/db/credentials.ts:120-127`) |
| F9 | The seat count is lowered below the current usage | the next invite is refused with `SeatLimitExceededError` | the seat feature only | raise `seat_count` |
| F10 | The actor widening changes a client's JSON shape | an external consumer of `/api/projects` sees `updated_by` | additive and optional; no consumer in-repo breaks | drop the field (the value becomes unread; no data loss) |

**Rollback of the whole ticket, in order.** The change is additive in every direction, so the rollback is
a revert, not a data repair:

1. **Revert the app** (the merge is auto-deployed, `supabase/README.md:56-57`).
2. **Leave `0004` applied.** It is purely additive: a new column with a default, a new table, widened
   policies. The pre-#54 app ignores all of it, and the widened policies are *more* permissive for an
   admin claim and identical for everyone else. Rolling the schema back would mean
   `drop table public.workspace_invites` + `alter table … drop column` (the order in
   `supabase/README.md:142-144` is the reverse-creation order) — **but there is no reason to**: leaving
   it applied keeps the door open and destroys nothing.
3. **The frozen records are not touched by any rollback.** They are write-once
   (`src/lib/persistence/issue-ledger.ts:30-45`); a rolled-back app writes `issued_by: "auditor"` again
   (the old literal), and the newer records keep their `u:`/`legacy:` values. Both values are readable by
   both versions, because the union admits both. **This is why the union includes `"auditor"` (§6.1).**

---

## 9. Test strategy

### 9.1 The seams available

| Seam | What it gives | Where it is |
|---|---|---|
| **Unit (vitest, node env)** | pure functions, injected `fetchImpl`, injected clock | `vitest.config.ts:5-7`; the repo's unit suites live beside the code (`src/lib/__tests__/api-errors.test.ts`) |
| **Route (vitest, direct handler import)** | the real handler, a real `Request`, an in-memory store | `tests/integration/candidate-review-route.test.ts:8-29` — `import { POST as postIssue } from "@/app/api/…"`, `setDataStoreForTests(new MemoryStore())` |
| **pglite-backed Postgres** | the real migrations, the real RLS, the real SQL | `tests/integration/tenant-isolation.test.ts:79-90` — `PGlite.create()`, apply every file in `supabase/migrations` sorted, `setSqlClientForTests(...)` |
| **Env** | every config state, with no network | `vitest.config.ts:9-14` blanks the Supabase/tenant env vars for every suite; suites set `process.env` directly (the pattern at `tests/integration/admin-auth.test.ts:18-23`) |

### 9.2 The rule this design holds itself to

**No test in this ticket requires the network, the operator's Supabase project, or the operator's OAuth
apps.** The Auth client takes an injected `fetchImpl` (M2), the JWT verifier is a pure function over a
token the test signs itself with `node:crypto`, the session is a cookie the test builds by hand, and the
seat model runs against pglite. **If the implementation ends up needing a live Supabase project for a
test to pass, that is a design smell and the test must be re-shaped** (the injected-`fetchImpl` seam is
the only acceptable escape hatch).

### 9.3 Which behaviour gets which kind of test

| Behaviour | Kind | Assertion |
|---|---|---|
| The actor vocabulary (construct, parse, refuse a constant) | unit | `parseActorId("auditor")` → `unattributed`; `userActor(x)` is `u:x`; `legacyActor(h)` is `legacy:h`; two different hashes → two different ids (the non-constancy proof) |
| HS256 access-token verification (good, tampered, expired, wrong alg, wrong secret) | unit | `verifyAccessToken` returns the subject for a valid token, `null` for each failure mode |
| The provider URL / enabled-provider gating | unit | `enabledProviders` with each env combination; `providerSignInUrl` carries the provider and the redirect |
| The seat arithmetic (used vs allowance, pending invites count, over-limit) | unit | a pure function `seatsUsed(active, pending)` and `canInvite(active, pending, allowance)`; the boundary `active+pending == allowance` is refused, `== allowance-1` is allowed |
| The session cookie read/write/clear | unit | the cookie is `httpOnly`, `SameSite=Lax`, `Secure` in production; the refresh token never reaches a response body |
| The identity resolution with a session | route + pglite | a request with a valid session cookie and a workspace key resolves to `subjectId = <the uuid>`, `subjectRole` from the DB, and `actor = u:<uuid>` |
| The identity resolution without a session | route | `actor = legacy:<hash>`; `workspaceId = null`; `database_status` unchanged from today |
| **Every mutation carries the actor** | route | for each of the 7 mutation routes: the call succeeds and the persisted record carries the actor (`issued_by` on the issue, `produced_by` on the audit, `uploaded_by` on the attachment, `updated_by` on the project) |
| **The issued record still freezes** | route + domain | a second issuance to the same audit yields revision+1 and never rewrites revision N; a conflicting restore raises `IssueRevisionConflictError` (`src/lib/persistence/issue-ledger.ts:117-119`) |
| **The frozen payload still byte-compares on restore** | domain | export a lineage, restore it into an empty store → all revisions restored; restore again → all skipped (byte-identical); mutate one byte → conflict. This is the existing behaviour and it must stay green unchanged |
| A pre-#54 lineage (with `issued_by: "auditor"`) still restores | domain | the historical value round-trips — this is the regression guard for §8 step 3 |
| The seat limit is enforced at invite | pglite | with `seat_count = 2`: invite #1 ok, invite #2 ok, invite #3 → 409; the invite count and the member count are visible to the admin and invisible to a member |
| A member cannot invite | pglite | a non-admin session → 403 (`NotWorkspaceAdminError`) — the widened policy must not let a plain member insert another subject |
| The invite acceptance binds the subject | pglite | a session whose email matches a pending invite creates the `workspace_members` row with `subject_id = <uuid>`, `status='active'`, and marks the invite accepted |
| Revocation frees the seat and ends access | pglite | `status='revoked'` → the member's next request is 403; the seat count drops; **the rows are still there** (no data loss) |
| The credential rotation / revocation lifecycle | pglite | rotate → the old credential is refused on the next request (`src/lib/db/identity.ts:160-162`), the new one works, and the workspace's rows are untouched; revoke → 401, rows untouched |
| Rotation is refused on the legacy path | route | with `TENANT_STORE` unset, `POST /api/workspaces/credentials {action:"rotate"}` → the named "requires the tenant store" state, and the legacy key still works |
| The auth routes, offline | route | `/api/auth/config` in each env state; `/api/auth/email` against an injected fake Auth server → 202; `/api/auth/callback` with a fake `token_hash` → 302 + `httpOnly` cookies; `/api/auth/signout` → the fake server received a revoke call |
| The provider-degradation state | route | with `SUPABASE_AUTH_GOOGLE_ENABLED` unset, `/api/auth/config` lists only email; with it set but the fake server rejecting the provider, `/api/auth/signin/google` → the plain "provider not configured" message |
| The secret boundary still holds | existing | `tests/integration/secret-boundary.test.ts` — it must stay green; it is the machine check for I3 and it will fail if anyone adds a `NEXT_PUBLIC_SUPABASE_*` name or imports `src/lib/db/**` from a client module |
| The tenant isolation is still real | existing | `tests/integration/tenant-isolation.test.ts` — it must stay green **after** `0004` is applied by the harness (it applies every migration file) |

### 9.4 The new test files

| File | Owner | What it proves |
|---|---|---|
| `tests/domain/actor-id.test.ts` | M1 | the vocabulary; the non-constancy of the legacy actor |
| `src/lib/auth/__tests__/supabase.test.ts` | M2 | HS256 verification; the provider gating; the URL shapes; every Auth call against an injected fake (no network) |
| `src/lib/auth/__tests__/session.test.ts` | M3 | the cookie flags; the read/verify/clear lifecycle |
| `src/lib/auth/__tests__/actor.test.ts` | M4 | the actor resolution from a session vs a credential |
| `tests/domain/actor-propagation.test.ts` | M5 | the repository seam carries the actor; both adapters agree (the pattern of `tests/domain/persistence-contract-matrix.test.ts`) |
| `tests/integration/auth-routes.test.ts` | M9 | the auth routes, offline, in every env state |
| `tests/integration/seat-invite.test.ts` | M8 | the seat limit, the admin-only invite, the acceptance, the revocation (pglite) |
| `tests/integration/credential-lifecycle.test.ts` | M11 | rotate/revoke take effect, no data loss, and the legacy-path refusal (pglite + route) |

**Existing suites that must stay green (the regression contract):** `tests/integration/tenant-isolation.test.ts`,
`tests/integration/tenant-rls.test.ts`, `tests/integration/database-not-configured.test.ts`,
`tests/integration/secret-boundary.test.ts`, `tests/integration/tenant-store-cutover.test.ts`,
`tests/domain/audit-issues.test.ts`, `tests/domain/retention-policy.test.ts`,
`tests/domain/persistence-contract-matrix.test.ts`, `tests/domain/artifact-persistence.test.ts`,
`tests/integration/kv-to-postgres-migration.test.ts`, `tests/integration/admin-auth.test.ts`.

**One environment note for the planner:** `vitest.config.ts:9-14` blanks `SUPABASE_URL` for every suite.
The new suites that need Supabase env set it explicitly in the suite (the pattern at
`tests/integration/admin-auth.test.ts:18-23`) and must restore it in `afterEach`, or they will leak
state into other suites running in the same process.

---

## 10. Verification of the discovery's five highest-risk findings

| # | Discovery finding | Verified? | Evidence |
|---|---|---|---|
| 1 | No actor id on the live path; the legacy variant carries no subject; G-1 forbids a constant | **Confirmed** | `src/lib/db/config.ts:30-37`; `src/lib/db/identity.ts:34-38`; `docs/research/enterprise-gap-audit.md:527-528` |
| 2 | The RLS insert policy blocks the invite; no seat column; no pending state ⇒ a new migration | **Confirmed** | `supabase/migrations/0002_rls_policies.sql:80-82`; `supabase/migrations/0001_tenant_schema.sql:32-48` |
| 3 | Rotation is total — no overlap window | **Confirmed** | `src/lib/db/credentials.ts:120-127`; `src/lib/db/identity.ts:160-162` |
| 4 | No `@supabase/supabase-js`, no `@supabase/ssr`, no JWT library; no `middleware.ts`; `SUPABASE_JWT_SECRET` reserved | **Confirmed** | `package.json:25-49`; no `middleware.ts` at the root or under `src/`; `src/lib/db/config.ts:64-67` |
| 5 | The actor id must enter through the repository seam; `issued_by` is a TS literal; the frozen payload byte-compares on restore | **Confirmed** | `src/domain/types.ts:304`; `src/lib/persistence/issue-ledger.ts:49`; `src/lib/db/tenant-store.ts:220`; `supabase/migrations/0001_tenant_schema.sql:100`; `src/lib/db/migration.ts:266`; `src/lib/persistence/issue-ledger.ts:114-120` |

**One discovery claim I did not adopt.** The discovery proposed `NEXT_PUBLIC_SUPABASE_AUTH_*` env names
(`.autoforge/discovery/report-t54.md:265-268`). **Those names would fail the existing secret-boundary
scan**, which permits only three `NEXT_PUBLIC_SUPABASE_*` names
(`tests/integration/secret-boundary.test.ts:53-57`). The design uses **server-side** names instead
(§3.2, M12), which is also the correct shape for an operator who enables a provider after the deploy.

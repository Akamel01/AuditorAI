# Architecture decisions — Ticket #54 (Supabase Auth sign-in, per-workspace seats, actor id on every mutation and issued record)

Repo: `Akamel01/AuditorAI` · branch `oc/54`.
Companion: `.autoforge/architecture/report-t54.md` (the design, the module table, the DDL, the test plan).
**Grilling input was unavailable at write time** (`.autoforge/requirements/grilling-t54.md` did not exist
when this log was written); the open questions the discovery raised
(`.autoforge/discovery/report-t54.md:306-314`) are answered in the report and marked below as
"open to a later grilling pass" where a human answer would change them.

Labels: **ORCHESTRATOR** = the orchestrator can settle it from the ticket + the repo. **OPERATOR** =
it genuinely needs the human (the operator owns the Supabase project, its keys, its OAuth apps, its
pricing, and the SQL).

---

## D1 — Two identity channels, composed at one seam

**Decision.** The workspace key (`x-workspace-key`) keeps selecting the **tenant**; a Supabase session
(`httpOnly` cookie, verified server-side) identifies the **person**. Both are resolved once per request
in `requireWorkspace` (`src/lib/api.ts:73-123`) via `resolveTenant`
(`src/lib/db/identity.ts:127-192`), and the request carries one `actor` id.

**Alternatives rejected.**
- *Session-only (the session selects the tenant).* Rejected: it re-designs tenant establishment — ticket
  #50's question ("Which identity and tenant model", `.autoforge/discovery/tracker-index-t54.md:8`) — and
  it breaks every existing caller that holds a workspace key, violating the production-unchanged
  constraint.
- *Key-only (the key keeps identifying the person).* Rejected: it is today's model, and it is exactly the
  gap — the key is browser-minted (`src/lib/client.ts:19-26`) and identifies a tenant, never a person
  (`docs/research/enterprise-gap-audit.md:522-523`).

**Consequence.** The key channel is untouched (invariant I1); a second, additive channel appears.
`resolveTenant` gains an optional session argument and the resolution carries the actor's subject and
role. The claim document gains `role` and `email` (`src/lib/db/identity.ts:43-45`).

**Reversible.** Yes — the session channel is additive; removing it restores today's behaviour exactly.

**ORCHESTRATOR.**

---

## D2 — Alternative A: Supabase Auth only, no local user table

**Decision.** The Supabase user uuid (JWT `sub`) **is** the user id and the actor id. `workspace_members.subject_id`
stores it (that column is already free text — `supabase/migrations/0001_tenant_schema.sql:42-48`). No
`app_users` table.

**Alternatives rejected.**
- *B — a local users table mapped 1:1 to a membership row.* Rejected: it is a second source of truth for
  identity; it does not exist on the live path (Postgres is off), so "an actor id resolves to a user"
  would be unavailable exactly where production runs; and because frozen records are write-once
  (`src/lib/persistence/issue-ledger.ts:30-45`), an actor id pointing at a dropped table can never be
  re-pointed.
- *C — a local-first session table with Supabase Auth as an optional upstream.* Rejected: it re-implements
  token issuance/refresh/revocation, makes the app a secret issuer (violating I3), and makes the
  migration to Supabase's own sessions a second migration.

**Consequence.** The app cannot resolve an actor id to an email locally. The team surface gets emails
from the invite row it wrote and from the verified JWT — never from a user directory. A deleted Supabase
user leaves a dangling `workspace_members.subject_id`, which the seat count must treat explicitly
(`status = 'revoked'`).

**Reversible.** Yes — a local users table can be added later as a *cache*; the actor id's meaning does
not change.

**ORCHESTRATOR.**

---

## D3 — The legacy-path actor is `legacy:<hash>`, and the live path's `issued_by` therefore changes value

**Decision.** With no session, the actor is `legacy:<16-hex workspaceHash>` — the same subject id the
KV→Postgres backfill already creates for that workspace
(`src/lib/db/migration.ts:135-137`). It is non-constant (it varies per credential), resolvable (it is a
`workspace_members.subject_id` once migrated, and the subject the membership check uses —
`src/lib/db/identity.ts:164-177`), and explicit (the `legacy:` prefix names the kind).

**Alternatives rejected.**
- *The constant `"auditor"`.* Rejected: G-1 forbids a constant actor
  (`docs/research/enterprise-gap-audit.md:527-528`).
- *`"unknown"` / `null`.* Rejected: not resolvable — a reader could not tell which credential produced
  the record, so the attribution would be useless.
- *A random per-request id.* Rejected: not resolvable either, and it would make the record unprovable.

**Consequence — and the tension this decision resolves.** On the live path the issued record's
`issued_by` changes from `"auditor"` to `legacy:<hash>`. That is a **byte-level change to one field of
one record type** while the switch is off. I read "production behaviour unchanged" as *behaviour*
(same caller, same key, same namespace, same responses, same status codes), not "no field ever changes
value" — because the ticket exists to change that field, and G-1 forbids the alternative. Every other
stored document, key, namespace and response shape is unchanged. **This is the one place where the two
constraints pull against each other, and the resolution is deliberate, not silent.** It is flagged here
because it is the orchestrator's call to confirm.

**Reversible.** Yes — revert the writer; the records written under the new scheme keep their values and
remain readable, because `AuditActor` admits `"auditor"` as well as the new forms (see D12).

**ORCHESTRATOR — needs an explicit confirmation of the "production unchanged" reading.**

---

## D4 — No new runtime dependency: the Auth client, PKCE and JWT verification are hand-rolled

**Decision.** No `@supabase/supabase-js`, no `@supabase/ssr`, no `jose`. The Supabase Auth client is a
thin `fetch` wrapper with an injectable `fetchImpl`; PKCE uses `node:crypto`
(`createHash("sha256")` / `createHmac`), the same primitives the repo already uses
(`src/lib/api.ts:67-69`); the access token is verified locally as an HS256 JWT against
`SUPABASE_JWT_SECRET` (`src/lib/db/config.ts:64-67`).

**Alternatives rejected.**
- *`@supabase/supabase-js`.* Rejected on three grounds: the orchestrator's rule that a new dependency
  must be justified as "cannot be done with what is installed" — what is installed can do it
  (`package.json:25-32`); the box-disk constraint (one `npm ci`, no large downloads); and the fact that
  the browser client persists the session in `localStorage`, i.e. a token becomes readable by page
  script, which is strictly weaker than the `httpOnly` cookie this design uses. It also collides with
  ticket #47's dependency inventory in the same release cycle
  (`.autoforge/discovery/tracker-index-t54.md:5`).
- *`@supabase/ssr`.* Rejected for the same dependency reasons, plus it brings a browser client.
- *A JWT library.* Rejected: HS256 verification is ~30 lines of `node:crypto`, and the repo already does
  timing-safe digest comparison in-house (`src/lib/api.ts:66-69`).

**Consequence.** ~250 lines of security-adjacent code that this repo did not previously have, and it
carries the risk that a hand-rolled verification has a subtle bug. Mitigation: the verification is a
pure function over a token the test signs itself, with explicit negative cases (§9.3 of the report). The
trade is deliberate — one small, testable, dependency-free verifier against two new packages and a
browser-readable session.

**Reversible.** Yes — swapping in `@supabase/supabase-js` later means replacing one module (M2) behind
the same interface; the session seam (M3) and the routes (M9) do not change.

**ORCHESTRATOR.**

---

## D5 — The sign-in is entirely server-mediated

**Decision.** The browser never receives the Supabase URL, the anon key, or any token. It calls
`GET /api/auth/config` (booleans only), `POST /api/auth/email`, and
`GET /api/auth/signin/[provider]` (a 302 to the provider). The session lives in `httpOnly` cookies. The
provider redirect is built server-side, with the PKCE verifier held in a short-lived `httpOnly` cookie.

**Alternatives rejected.**
- *The browser holds the anon key and calls Supabase directly (the usual `createBrowserClient` shape).*
  Rejected: it puts a session token in `localStorage`, where page script can read it, and it puts the
  provider handshake in the browser, where the redirect and the code exchange are not under the app's
  control. It also makes the "not configured" state depend on build-time env (`NEXT_PUBLIC_*` is inlined
  at build), which is the wrong shape for an operator who configures Google later.
- *`middleware.ts` for session refresh.* Rejected: no `middleware.ts` exists today, the repo resolves
  identity inside `requireWorkspace` (`src/lib/api.ts:113`), and adding one would add a request-time
  hook the app does not need.

**Consequence.** Stronger than invariant I3 requires (no Supabase credential at all reaches the
browser). The cost: one extra server hop per sign-in step, and the auth routes must exist even when
nothing else does.

**Reversible.** Yes.

**ORCHESTRATOR.**

---

## D6 — The provider switches are server env flags, not `NEXT_PUBLIC_*`

**Decision.** `SUPABASE_AUTH_GOOGLE_ENABLED` and `SUPABASE_AUTH_MICROSOFT_ENABLED` are read at request
time; `GET /api/auth/config` reports the enabled providers. `APP_URL` is added for the redirect target.

**Alternatives rejected.**
- *`NEXT_PUBLIC_SUPABASE_AUTH_GOOGLE_ENABLED` (the discovery's proposal,
  `.autoforge/discovery/report-t54.md:265-268`).* Rejected — and this one is **forced**: the existing
  secret-boundary scan permits only three `NEXT_PUBLIC_SUPABASE_*` names
  (`tests/integration/secret-boundary.test.ts:53-57`), so the discovery's names would fail
  `tests/integration/secret-boundary.test.ts` as it stands. Independently, a `NEXT_PUBLIC_*` value is
  inlined at build time, so the operator could not enable Google after the deploy without a rebuild —
  and the operator configures the OAuth apps later, by design.
- *Probing the provider at request time (call Supabase and see if the provider is enabled).* Rejected:
  it is a network call on a page render, and it would leak the provider state into a timing-dependent
  path.

**Consequence.** The operator can flip a provider on without a deploy. The absence of a flag is the
plain "sign-in not configured" state for that provider (report §7, state 2).

**Reversible.** Yes — env only.

**OPERATOR** (the operator sets the flags once the OAuth apps exist) **and ORCHESTRATOR** (the naming
rule).

---

## D7 — The seat count is a `workspaces.seat_count` column, enforced at the invite write, in one transaction

**Decision.** `workspaces.seat_count integer not null default 1`. The seat check and the invite insert
happen in the **same transaction** as the invite write: `members(status='active') + invites(pending)` is
compared with `seat_count`, and the invite is inserted only if there is room. The check lives at the
invite surface and nowhere else.

**Alternatives rejected.**
- *Enforce the count at sign-in / acceptance instead of at invite.* Rejected: the ticket says the count is
  "enforced at invite" (`docs/research/enterprise-gap-audit.md:526-527`), and enforcing at acceptance
  would allow unbounded over-inviting.
- *A plan/entitlement table outside `workspaces`.* Rejected: a second source of truth for the same
  fact, for a number that is a property of the workspace. (Open to a later grilling pass if a
  per-plan tiering is wanted.)
- *Count only members, not pending invites.* Rejected: the count could be bypassed by over-inviting;
  a pending invite reserves its seat.

**Consequence.** The seat allowance is set by the operator in SQL (see D15). The count is a
`select count(*)` per invite — cheap at the expected scale. The check is transactional, so concurrent
invites cannot exceed the allowance.

**Reversible.** Yes — the column is additive; dropping it restores the old behaviour (and the seat
surface then has nothing to enforce).

**ORCHESTRATOR.**

---

## D8 — Pending invites live in a new `workspace_invites` table, not in `workspace_members`

**Decision.** A new table holds pending invitations (`workspace_id`, `email`, `role`, `invited_by`,
`invite_token_hash`, `created_at`, `accepted_at`, `accepted_subject_id`). `workspace_members` gains
`status`, `email`, `invited_by`, `accepted_at`, `revoked_at` — **its primary key is unchanged**.

**Alternatives rejected.**
- *Make `workspace_members.subject_id` nullable and drop the PK.* Rejected: `subject_id` is part of the
  primary key (`supabase/migrations/0001_tenant_schema.sql:47`); dropping it changes the table's identity
  model and every policy that reads it.
- *A placeholder subject id for a pending invite (`invite:<token>`).* Rejected: it pollutes the
  membership namespace with non-users, and the membership check
  (`src/lib/db/identity.ts:164-177`) would have to special-case them.
- *An `invite_status` column on `workspace_members` with a placeholder subject.* Same objection.

**Consequence.** Two tables to read for the seat count (two `count(*)`s in one transaction). The
invariant "a member is a subject" stays true. The acceptance path inserts into `workspace_members` and
marks the invite accepted, in one transaction.

**Reversible.** Yes — `drop table public.workspace_invites` (the schema rollback order is in
`supabase/README.md:142-144`); the member rows stay.

**ORCHESTRATOR.**

---

## D9 — Session verification is local HS256 against `SUPABASE_JWT_SECRET`

**Decision.** The access token is verified server-side as an HS256 JWT with a timing-safe signature
comparison against `SUPABASE_JWT_SECRET` (`src/lib/db/config.ts:64-67`, already reserved for this
ticket). No network call per request.

**Alternatives rejected.**
- *Call Supabase's `GET /auth/v1/user` per request (what `@supabase/supabase-js`'s `getUser()` does).*
  Rejected: a network round-trip on every tenant request, and a new failure mode (the auth service
  being down would break the product's data path).
- *Fetch a JWKS and verify asymmetrically.* Rejected as out of scope for this ticket — but see the
  operator flag below: if the operator's project signs with ES256/RS256 (Supabase's newer default), the
  secret-based check will not work.

**Consequence.** A mismatch between the secret and the project's signing key degrades **silently**:
`readSession` returns null and the actor falls back to `legacy:<hash>` — sign-in appears to work but
records are never attributed to a user. This is the only failure mode in the design that is not
observable as an error, and it is why the operator must confirm the project's signing mode before the
feature is relied on.

**Reversible.** Yes — replace one function; the interface does not change.

**OPERATOR** — the operator must confirm that `SUPABASE_JWT_SECRET` matches the project's signing key
(or set it), and must be told that a mismatch is a silent degradation, not an outage. If the project
uses asymmetric keys, adding JWKS verification is a follow-up ticket.

---

## D10 — The RLS widening uses a claim-carried role, not the service role and not `SECURITY DEFINER`

**Decision.** `claimsJson` gains `role` and `email`; two new helpers (`app_claim_role()`,
`app_claim_email()`) read them and **reference no table**, preserving the explicit rule of
`supabase/migrations/0002_rls_policies.sql:3-8`. The membership select/insert policies are widened with
`or app_claim_role() = 'admin'`. The role is read from the actor's own membership row and re-issued into
the claim.

**Alternatives rejected.**
- *Perform the invite with the service role.* Rejected: the service-role names live only in
  `src/lib/db/admin.ts` (`src/lib/db/admin.ts:9-14`;
  `tests/integration/secret-boundary.test.ts:61-62`) and the service role **bypasses RLS**, which would
  make the isolation guarantee depend on the application's own WHERE clause — the thing RLS exists to
  make unnecessary (`src/lib/db/tenant-store.ts:5-11`). It would also need a Postgres path for an HTTP
  bearer key that the repo does not have.
- *A `SECURITY DEFINER` helper that counts and inserts.* Rejected: it is an RLS-bypass primitive owned
  by the migration executor, and it puts the seat count outside the policy graph.

**Consequence.** The app asserts the role in the claim — consistent with the existing model, in which
the app already asserts `sub` and `workspace_id` from credential-derived data
(`src/lib/db/identity.ts:137-144`). RLS remains a second fence, not the authorization layer. The
workspace predicate is retained in every widened policy, so an admin can only act inside the workspace
the resolution granted.

**Reversible.** Yes — the policies are dropped and recreated; `0004` is re-runnable by design.

**ORCHESTRATOR.**

---

## D11 — The actor is persisted on the issue, the audit, the attachment and the project; not on the artifact trail and not on deletes

**Decision.** `AuditIssue.issued_by` becomes required (`AuditActor`); `AuditResult.produced_by?`,
`Attachment.uploaded_by?` and `Project.updated_by?` are optional additive fields. `saveArtifactTrailFor`
and `deleteAttachment` are **unchanged**.

**Alternatives rejected.**
- *Carry the actor only in the request, persist it nowhere but the issue.* Rejected: "every mutation
  carries the actor's user id" would then be true only in memory, and a reviewer could not see it. A
  parameter that is received and dropped is not carried.
- *Give `deleteAttachment` an actor and a tombstone.* Rejected: a delete has no record to name, and a
  tombstone is ticket #55's hash-chained trail
  (`.autoforge/discovery/tracker-index-t54.md:12`).
- *Give the artifact trail an actor.* Rejected: it is machine output written only by the dev console
  (`src/app/api/dev/runs/[runId]/finish/route.ts:28-33`) and is pruned to a summary
  (`src/lib/persistence/artifact-trail.ts:87-105`); it is not a firm record.
- *Make the fields required.* Rejected: historical rows genuinely lack them (the backfill copies the
  documents verbatim — `src/lib/db/migration.ts:225-230`, `:266`), and an optional field is the honest
  type for "absent on rows that predate the actor".

**Consequence.** `public.projects` is decomposed into columns
(`supabase/migrations/0001_tenant_schema.sql:65-74`), so `updated_by` needs **one column** in `0004`.
The other three ride inside existing `payload jsonb` columns — no DDL. Client-visible JSON gains three
optional fields (additive; no in-repo consumer breaks).

**Reversible.** Yes at the code level; the persisted values become unread if the fields are dropped. No
data is lost and no frozen record is rewritten.

**ORCHESTRATOR.**

---

## D12 — The actor id is written into `issued_by`, not into the frozen `AuditResult` payload

**Decision.** `AuditIssue.issued_by` (today the literal `"auditor"`, `src/domain/types.ts:304`) becomes
`AuditActor = \`u:${string}\` | \`legacy:${string}\` | "auditor"`. The frozen `result` payload is
untouched.

**Alternatives rejected.**
- *Put the actor inside the frozen payload.* Rejected: it changes the frozen bytes of every issued
  revision, which changes the restore-conflict behaviour of existing lineages
  (`src/lib/persistence/issue-ledger.ts:114-120`) — the invariant the ticket must not break.
- *Drop `"auditor"` from the union.* Rejected: the stored JSON is read back with a cast
  (`src/lib/persistence/issue-ledger.ts:62`), so a union without it would be a lie about the
  backfilled rows that exist in every migrated database (`src/lib/db/migration.ts:266`). The write path
  never emits it, and a test asserts that.

**Consequence.** A pre-#54 lineage still restores byte-identically (both sides carry `"auditor"`), and
the frozen payload's bytes are exactly what they are today. The compiler points at every consumer that
assumed a constant author — which is the point of the change.

**Reversible.** Yes.

**ORCHESTRATOR.**

---

## D13 — ADR-0009's pseudonym is **not** linked to the user id

**Decision.** `auditor_pseudonym` stays a self-asserted, browser-local handle
(`src/lib/client.ts:37-42`, `src/domain/outcome-contracts.ts:7`). The actor id is a separate,
server-verified value. No mapping between them is created.

**Alternatives rejected.**
- *Derive the pseudonym from the user id (e.g. `auditor-<hash of the uuid>`).* Rejected: it writes a
  stable, re-identifiable handle into the local, gitignored outcome log
  (`docs/adr/0009-candidate-outcome-logging.md:18-20`) and destroys ADR-0009's stated property that the
  real identity mapping "lives outside the log"
  (`docs/adr/0009-candidate-outcome-logging.md:29-31`).
- *Make the pseudonym the actor id.* Rejected: it is browser-supplied — a client could mint an identity
  (invariant I4).

**Consequence — stated out loud, because it is a real asymmetry.** A record can name a verified actor
*and* a pseudonym, and the two do not correspond. If a firm needs them to correspond, that is a separate
deliberate decision and a separate ADR amendment, not a side effect of #54.

**Reversible.** Yes — nothing is stored, so nothing needs undoing.

**ORCHESTRATOR.**

---

## D14 — Credential issuance and rotation are Postgres-only

**Decision.** The server-side issuance/rotation/revocation surface refuses with a plain named state when
the resolution is `mode: "legacy"`. The existing lifecycle semantics are reused unchanged:
`revokeCredential` never deletes a row (`src/lib/db/credentials.ts:62-88`); `rotateCredential` marks the
old row `revoked_at` **and** `rotated_at` and writes a new one (`src/lib/db/credentials.ts:120-127`,
`:147-152`); the resolution then rejects a rotated credential exactly like a revoked one
(`src/lib/db/identity.ts:160-162`) — **rotation is total, with no overlap window**.

**Alternatives rejected.**
- *Allow rotation on the legacy path.* Rejected: the key's hash **is** the KV namespace
  (`src/lib/persistence/keys.ts:5-43`), so replacing the key orphans the workspace's data. This is the
  highest-severity failure mode in the whole design and it is prevented by this rule.
- *Add a grace window to rotation (the old key stays valid for N minutes).* Rejected: it changes
  existing, tested semantics (`src/lib/db/credentials.ts:120-127`), and "rotatable, revocable" does not
  ask for an overlap. Open to a later grilling pass if an operator wants one.

**Consequence.** On the live path the credential lifecycle is not exercisable — the tenant store is off.
The proof is a pglite test, not a deployment (which is also the state of G-5's acceptance today,
`.autoforge/discovery/report-t54.md:282`).

**Reversible.** Yes.

**ORCHESTRATOR.**

---

## D15 — The seat allowance defaults to 1 and the first admin is an operator SQL action

**Decision.** `workspaces.seat_count` defaults to `1`. The operator sets the real allowance
(`update public.workspaces set seat_count = 25`) and creates the first admin row
(`insert into public.workspace_members (workspace_id, subject_id, role, email, accepted_at) values (…)`).
The app surfaces the signed-in user's uuid at `GET /api/auth/me` so the operator can paste it.

**Alternatives rejected.**
- *The app bootstraps the first admin (e.g. "the first member of an empty workspace becomes admin").*
  Rejected: deciding "the workspace has no members" requires counting members, which the non-admin
  cannot see under the membership select policy
  (`supabase/migrations/0002_rls_policies.sql:77-79`) — it would need either a policy that trusts the
  app's word or a `SECURITY DEFINER` bypass (rejected in D10).
- *A default of 5 or 10.* Rejected: an arbitrary number in a schema default is a pricing decision
  hidden in DDL.

**Consequence.** One operator step before seats are usable. It matches the ticket's posture ("The
operator creates the Supabase project and its keys") and `supabase/README.md`'s pattern of the operator
applying SQL by hand.

**Reversible.** Yes — both are SQL updates.

**OPERATOR** — the seat allowance is a commercial decision, and the first-admin bootstrap needs the
operator's hands.

---

## D16 — The dev console's actor is `admin:<digest>`; no dev record stores it

**Decision.** `requireAdmin` returns `{ ok: true, actor: adminActor(digest) }` where the digest is of the
presented admin key. The dev console's records carry no actor.

**Alternatives rejected.**
- *Leave `requireAdmin` untouched.* Rejected: then a mutating request in the app has no actor at all,
  and "every mutation carries the actor" would be false in a corner of the codebase.
- *Give the dev console's artifacts an actor.* Rejected: the artifact trail is pruned to a summary
  (`src/lib/persistence/artifact-trail.ts:87-105`) and is written only by the dev console
  (`src/app/api/dev/runs/[runId]/finish/route.ts:28-33`), which is explicitly not tenant-scoped
  (`src/app/api/dev/runs/[runId]/finish/route.ts:5-6`).

**Consequence.** The dev surface is attributed at the request level but not on the record. The admin
digest is non-constant across installations and resolves to "the holder of the admin credential" — a
person only in the operator's sense.

**Reversible.** Yes.

**ORCHESTRATOR.**

---

## D17 — The new env surface: `APP_URL`, `SUPABASE_AUTH_GOOGLE_ENABLED`, `SUPABASE_AUTH_MICROSOFT_ENABLED`

**Decision.** Three new server-side names, listed in `.env.example` (`.env.example:27-45`), read at
request time. **No new secret name** is introduced anywhere in `src/` outside `src/lib/db/admin.ts`
(`src/lib/db/admin.ts:9-14`), and **no new `NEXT_PUBLIC_SUPABASE_*` name** is introduced (D6).

**Alternatives rejected.**
- *Reuse `VERCEL_*`.* Rejected: nothing in `src/` references `VERCEL_*` today, and the app's origin
  differs between preview and production deployments — the operator must state the origin that the
  Supabase project allow-lists.
- *Derive the app URL from the request.* Rejected: the request's `Host` header is attacker-controllable,
  and the value is used to build an OAuth redirect target. It must come from configuration.

**Consequence.** The operator must add `APP_URL` (and allow-list the redirect URLs in the Supabase
project) before any provider works.

**Reversible.** Yes — env only.

**OPERATOR.**

---

## D18 — The seat and credential features are dormant in production until `TENANT_STORE` flips; sign-in and the actor id work on the live path

**Decision.** #54 delivers two things at different activation levels:

- **Live today (switch off):** Supabase sign-in (email/Google/Microsoft) and the actor id on every
  issued record — `u:<uuid>` when signed in, `legacy:<hash>` otherwise.
- **Postgres-only (switch on):** the seat count, invites, membership state, admin-driven credential
  rotation/revocation.

**Alternatives rejected.**
- *Make the seat model work on the legacy KV store.* Rejected: the seat model needs `workspaces`,
  `workspace_members` and RLS — all Postgres. Re-implementing it in KV would fork the identity model.
- *Block sign-in behind `TENANT_STORE=postgres`.* Rejected: Supabase Auth is an HTTP service,
  independent of the tenant store; coupling them would make sign-in unusable on the live path and would
  change production behaviour in the direction the constraint forbids.

**Consequence.** A reviewer looking at production will see sign-in working and the seat surface showing
the plain "requires the tenant store" notice. That is a deliberate, named state (report §7, state 3),
not a gap.

**Reversible.** n/a — this is a statement of what activates when.

**ORCHESTRATOR.**

---

## D19 — `docs/validation/security-review.md` is updated in this ticket

**Decision.** `docs/validation/security-review.md:11` ("Bearer-style `x-workspace-key`"), `:17`
("Anonymous workspaces, no accounts/PII; demo data only") and `:19` ("acceptable for prototype
deployment carrying non-sensitive data") are corrected, and a new ADR
(`docs/adr/0020-named-user-identity-and-seats.md`) records the identity model, the actor vocabulary and
the seat model.

**Alternatives rejected.**
- *Leave the security record alone.* Rejected: G-5's acceptance is explicit — "the repository's own
  security record no longer contradicts the shipped code"
  (`docs/research/enterprise-gap-audit.md:579`), and the record currently contradicts both the new
  identity model and the credential lifecycle.
- *Defer to a documentation ticket.* Rejected: the contradiction is created by this ticket; it must be
  closed by it.

**Consequence.** The gate line (`:19`) may need to change from "acceptable for prototype deployment" —
that judgement is the operator's, not the implementer's.

**Reversible.** Yes — documentation.

**ORCHESTRATOR** for the ADR, **OPERATOR** for the gate judgement (`:19`) — the operator decides whether
the system may now carry sensitive data; the implementer may not.

---

## Summary of operator-facing items

| id | What the operator must do | Where |
|---|---|---|
| D6 | set `SUPABASE_AUTH_GOOGLE_ENABLED` / `…_MICROSOFT_ENABLED` after configuring the OAuth apps | `.env.example`, deployment env |
| D9 | confirm `SUPABASE_JWT_SECRET` matches the project's signing key (a mismatch is a **silent** degradation, not an error) | `.env.example`, deployment env |
| D15 | set `workspaces.seat_count` and create the first `admin` member row | `supabase/README.md` |
| D17 | set `APP_URL` and allow-list the redirect URLs in the Supabase project | `.env.example`, Supabase dashboard |
| D19 | re-judge the deployment gate in `docs/validation/security-review.md:19` | the document itself |
| D7/D15 | flip `TENANT_STORE=postgres` to activate the seat and credential surfaces (last, per `supabase/README.md:85-88`) | deployment env |
| — | apply `supabase/migrations/0004_seats_invites.sql` after `0001→0002→0003` | `supabase/README.md` |

**No operator step creates an account and no secret value appears in the repo.**

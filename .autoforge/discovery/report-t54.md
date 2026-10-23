# Discovery Report — Ticket #54 (named-user accounts, seats, actor id on issuance)

Repo: `Akamel01/AuditorAI` · branch `oc/54` · HEAD `c7c449e` (PR #59, Supabase Postgres tenant store)
Read-only investigation. Every repo claim below carries `path:line`. No design is proposed here.

---

## Ticket scope

Literal acceptance surface of #54, restated as testable facts. Source: ticket body + `docs/research/enterprise-gap-audit.md` G-1 (`:518-529`) and G-5 (`:569-580`).

- [ ] **S1 — Sign-in exists and is email + Google + Microsoft.** Three named sign-in methods are available; Google and Microsoft are operator-configured *later*, so when their configuration is absent the product must degrade to a plain "sign-in not configured" state rather than fail (ticket body; orchestrator brief).
- [ ] **S2 — Named-user accounts.** Every user has an identity that is a *person*, distinct from the workspace key (gap audit G-1 acceptance sketch, `docs/research/enterprise-gap-audit.md:526-528`).
- [ ] **S3 — Seat count per Workspace, enforced at invite.** A Workspace has a seat count; the count is enforced at a product surface (the invite surface) — gap audit G-1 acceptance sketch `:526-527`; ticket body "Seat count per Workspace, enforced at invite".
- [ ] **S4 — Every mutation carries the actor's user id.** Every mutating request and the record it writes carry a non-constant actor id that resolves to a user — gap audit G-1 acceptance sketch `:527-528`; ticket body "Every mutation and issued record carries the actor's user id".
- [ ] **S5 — Every issued record carries the actor's user id.** The frozen revision names the actor (gap audit G-1 acceptance sketch `:528`).
- [ ] **S6 — The issued record still freezes.** Issuance remains write-once / immutable — gap audit G-1 acceptance sketch `:528` (the write-once property is ADR-0004; see `src/lib/persistence/issue-ledger.ts:30-54`).
- [ ] **S7 — Rotatable, revocable credentials.** "Rotatable, revocable credentials" (ticket body) mapped onto the shipped credential lifecycle — gap audit G-5 acceptance sketch `:577-579`: "tenant credentials are issued and stored server-side; a rotation path exists and has been exercised; a revocation path exists and takes effect without data loss".
- [ ] **S8 — Credentials are server-side, not browser-minted.** Gap audit G-5 `:577-578`; the current browser-minted credential is the cited evidence (`src/lib/client.ts:10`, `src/lib/client.ts:22`).
- [ ] **S9 — The repo's own security record no longer contradicts the code.** Gap audit G-5 `:579`; the contradicting record is `docs/validation/security-review.md:17` ("Anonymous workspaces, no accounts/PII; demo data only") and `docs/validation/security-review.md:19` ("Gate: acceptable for prototype deployment carrying non-sensitive data").
- [ ] **S10 — No account creation, no secret handling by the agent.** The operator creates the Supabase project and its keys; the app reads them from env, and the names are listed in `.env.example` (ticket body).
- [ ] **S11 — Production behaviour unchanged unless the switch is on.** The Postgres tenant path runs only when `TENANT_STORE=postgres` (`src/lib/db/config.ts:30-37`); with the switch off the legacy KV path must keep serving (orchestrator brief).

Out of scope for #54 (per ticket body and the parent map #41): WorkOS SSO later (`#41` "Decided so far"); append-only hash-chained audit trail (`#55`); backups/PITR (`#56`); schema validation at every trust boundary (`#46`); dependency inventory/scanning (`#47`).

---

## Current identity model

How a caller is identified today, end to end. There is **no user identity today** — there is a browser-minted bearer key that identifies a *tenant/workspace*, plus a free-text *pseudonym* that identifies a person only by self-assertion.

**1. Browser key creation — `src/lib/client.ts`**
- `src/lib/client.ts:10` — `const KEY_ITEM = "auditorai.workspace_key";` (localStorage key).
- `src/lib/client.ts:19-26` — `ensureWorkspaceKey()`: if no key exists, mints `crypto.randomUUID() + crypto.randomUUID().split("-")[0]` (`:22`) and stores it in `localStorage` (`:23`). The client can therefore mint its own tenant credential with no server involvement.
- `src/lib/client.ts:77` — `api()` sets the header `x-workspace-key` on every browser→API call.
- `src/lib/client.ts:81` — `adminApi()` sets `x-admin-key` (dev-console surfaces).
- `src/lib/client.ts:11`, `:28-35` — the admin key lives in `localStorage` too.
- `src/lib/client.ts:39-42` — `getAuditorPseudonym()`: a browser-local string with the fallback `DEFAULT_AUDITOR_PSEUDONYM` (`src/domain/outcome-contracts.ts:7` = `"auditor-a1"`). It is **self-asserted and unverified**; it is the closest thing to an "actor" that exists today.
- `src/lib/client.ts:84-95` — `useWorkspaceKey()` / `useResetWorkspace()` (deletes the key and reloads).

**2. Header check — `src/lib/api.ts`**
- `src/lib/api.ts:31-32` — `WORKSPACE_HEADER = "x-workspace-key"`, `ADMIN_HEADER = "x-admin-key"`.
- `src/lib/api.ts:79-88` — `requireWorkspace()` reads the header; absent or `< 16` chars ⇒ 401 `missing or invalid x-workspace-key`.
- `src/lib/api.ts:89` — `const ws = workspaceHash(key);` — the tenant namespace is the hash of the presented key.
- `src/lib/api.ts:90-99` — rate limit keyed on the same hash.
- `src/lib/api.ts:113` — `resolution = await resolveTenant(key);` — the credential is resolved exactly once per request.
- `src/lib/api.ts:117` — `const repo = createTenantRepository(resolution);` — the factory picks the store; `requireWorkspace` never does.
- `src/lib/api.ts:122` — the success shape is `{ ok: true; ws, repo, databaseStatus }` — **there is no actor/user id in it** (`src/lib/api.ts:73-78`).
- `src/lib/api.ts:47-71` — `requireAdmin()`: env `ADMIN_KEY` vs `x-admin-key`, timing-safe SHA-256 comparison (`:67-69`), one indistinguishable denial for unset-env/missing/wrong (`:39-42`). Fail-closed.
- `src/lib/api.ts:146-176` — `ERROR_TABLE` + `serverError()`: the one place a typed error becomes an HTTP status.

**3. Hashing — `src/lib/persistence/store.ts`**
- `src/lib/persistence/store.ts:236-240` — `workspaceHash()` = `sha256(key).hex.slice(0,16)`. One derivation point, reused by the legacy KV namespace and by `public.workspace_credentials.credential_hash` (`src/lib/db/identity.ts:9-12`).
- `src/lib/persistence/keys.ts:5-43` — every legacy key is namespaced `ws:<hash>:…`; the namespace is the *workspace*, never a person.

**4. Tenant resolution — `src/lib/db/identity.ts`**
- `src/lib/db/identity.ts:127-192` — `resolveTenant(presentedCredential)`; documented as the ONE place a tenant identity is produced (`:1-2`).
- `src/lib/db/identity.ts:128` — `legacyHash = workspaceHash(presentedCredential)`.
- `src/lib/db/identity.ts:129-131` — not configured ⇒ `{ mode: "legacy", reason: "not_configured" }` (the live production state).
- `src/lib/db/identity.ts:137-144` — credential lookup in one transaction, `request.credential_hash` GUC set first.
- `src/lib/db/identity.ts:155-159` — no row ⇒ `legacy / not_migrated` (an unknown credential is **not** auto-registered).
- `src/lib/db/identity.ts:160-162` — `revoked_at || rotated_at` ⇒ `CredentialRevokedError`.
- `src/lib/db/identity.ts:164-177` — membership check under the claim ⇒ `WorkspaceMembershipError`.
- `src/lib/db/identity.ts:186-191` — success ⇒ `{ mode: "postgres", workspaceId, subjectId, legacyHash }`. **`subjectId` is the only person-shaped identifier in the system**, and it exists only in the Postgres branch (`:33`); the legacy branch (`:34-38`) has no subject at all.
- `src/lib/db/identity.ts:43-45` — `claimsJson(subjectId, workspaceId)` → `{"sub":…,"workspace_id":…}` — the claim shape a Supabase JWT would map onto.
- `src/lib/db/identity.ts:50-52`, `:62-64` — the SQL client and the "is a tenant DB available" gate.

**5. Admin path — `src/lib/db/admin.ts`**
- `src/lib/db/admin.ts:11-14` — `supabaseServiceRoleKey()` reads `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY`; it is the only module in `src/` allowed to name a service-role secret (`:1-7`).
- `src/lib/db/config.ts:64-67` — `supabaseJwtSecret()` reads `SUPABASE_JWT_SECRET`, explicitly commented **"Reserved for #54 (JWT subject verification)"** — the seam already reserved for this ticket.
- `src/lib/db/config.ts:53-62` — `supabaseUrl()` / `supabaseAnonKey()` exist but have **no consumer** today (`:52` "no consumer in #53").

**Summary of the gap:** a caller is identified by a hash of a key they minted themselves; no caller is ever identified as a *person* on the legacy path, and even on the Postgres path the person (`subjectId`) is bound to a credential, not to a session that the server issued.

---

## Postgres tenant store (PR #59)

Files: `supabase/migrations/0001_tenant_schema.sql`, `0002_rls_policies.sql`, `0003_roles.sql`; operator procedure `supabase/README.md:23-52`. Nothing in the app imports the SQL (`supabase/README.md:8-9`).

**Tables (all tenant tables, RLS enabled+forced):** `supabase/migrations/0001_tenant_schema.sql`
- `:32-40` `workspaces` — `id uuid` PK, `name text`, `region text` default `'ca-central-1'`, `legacy_key_hash text unique` (the KV namespace anchor), `created_at`. **There is no seat-count column and no owner column.**
- `:42-48` `workspace_members` — `workspace_id uuid` FK, `subject_id text`, `role text` default `'member'`, `created_at`, PK `(workspace_id, subject_id)`. **No seat/pending/invited status column; no invite token table; `role` is free text, not an enum.**
- `:50-57` `workspace_credentials` — `credential_hash text` PK, `workspace_id uuid` FK, `subject_id text`, `created_at`, `revoked_at`, `rotated_at`; indexes on workspace and subject (`:58-61`).
- `:65-74` `projects`, `:81-88` `audits`, `:94-103` `audit_issues`, `:107-114` `attachments`, `:120-128` `artifacts`, `:132-139` `artifact_summaries` — each tenant-scoped, each carrying a `payload jsonb` plus only the columns that carry meaning.
- `:100` — `issued_by text not null default 'auditor'` — the column that today holds the constant actor.

**What `src/lib/db/credentials.ts` issues and revokes**
- `src/lib/db/credentials.ts:62-88` — `revokeCredential(presentedCredential)`: sets `revoked_at = coalesce(revoked_at, now())` (`:70-73`); **never deletes the row** (`:59-61`), so tenant data survives; revoking twice is a no-op; unknown credential ⇒ `CredentialRegistryError` (`:84-86`).
- `src/lib/db/credentials.ts:92-165` — `rotateCredential(presented, next)`: the OLD row is marked **`revoked_at` AND `rotated_at`** (`:120-127`) and a NEW row is inserted for the same workspace/subject (`:147-152`); the old row is never deleted (`:90-91`); rotation onto an existing hash ⇒ `CredentialRegistryError` (`:161-163`).
- Consequence: `src/lib/db/identity.ts:160-162` treats `rotated_at` exactly like `revoked_at`, so **rotation kills the old credential outright** (no grace window).
- Both functions run on the tenant SQL client (`:64`, `:99`) — i.e. they only work when the Postgres path is live.

**What the RLS policies bind to — `supabase/migrations/0002_rls_policies.sql`**
- `:26-32` — three claim helpers read two transaction-local GUCs: `request.jwt.claims` → `app_claim_subject()` / `app_claim_workspace_id()`, and `request.credential_hash` → `app_claim_credential_hash()`.
- `:39-56` — `ENABLE` + `FORCE ROW LEVEL SECURITY` on all nine tables.
- `:62-68` — `workspaces`: `id = app_claim_workspace_id()`.
- `:77-85` — `workspace_members`: `subject_id = app_claim_subject() AND workspace_id = app_claim_workspace_id()` for select/insert/delete. **Consequence for seats:** the insert policy (`:80-82`) forbids the app role from inserting a membership row for *any other* subject, so a "workspace owner invites a third party" flow cannot be expressed under this policy as written.
- `:98-104` — `workspace_credentials`: keyed on the *presented* hash only (`app_claim_credential_hash()`), which is what makes a credential row visible to its own lookup (`:87-94`).
- `:109-124` — the six record tables get a uniform policy set: every predicate is `workspace_id = app_claim_workspace_id()`; the application SQL does **not** filter by workspace (`:106-108`).
- `supabase/migrations/0003_roles.sql:18-23` — role `auditorai_app` is `nosuperuser nocreatedb nocreaterole noinherit nobypassrls`; `:39-55` — USAGE on the schema, DML on the nine tables, EXECUTE on the three helpers. The role owns nothing, so the forced policies always apply.
- `src/lib/db/sql.ts:28-47` — the app asserts `current_user = auditorai_app` on every statement and refuses anything else (fail-closed).

**Which parts are active only when `TENANT_STORE=postgres`**
- `src/lib/db/config.ts:30-32` — `tenantStoreEnabled()` is `TENANT_STORE === "postgres"` (case-insensitive).
- `src/lib/db/config.ts:35-37` — `isDatabaseConfigured()` = enabled **AND** `TENANT_POSTGRES_URL` present; `POSTGRES_URL` is deliberately never read by the app (`:39-41`, `supabase/README.md:25-27`).
- `src/lib/db/identity.ts:62-64` — the injected test client also counts as "available".
- `src/lib/db/repository-factory.ts:22-35` — the factory returns `PostgresTenantRepository` only for `mode === "postgres"`; otherwise the legacy `Repository(getDataStore())` serves.
- `src/lib/db/config.ts:47-50` — `postgresUrlNonPooling()` returns `null` under `NODE_ENV === "test"`.
- **Consequence:** in production today (switch unset) the entire Postgres schema, the credential registry, the RLS policies and `subjectId` are dormant. The Supabase keys in `.env.example` are read by nothing except `src/lib/db/config.ts:53-62` and `src/lib/db/admin.ts:11-14`.

---

## Issuance path

Where a record is frozen/issued, what it stores, and where the constant actor is written.

**The issuance route** — `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts`
- `:55-156` — `POST` = issuance. `:74-79` capability-claim bound check; `:86-101` the evidence override must name a reviewer (`auditor_pseudonym`); `:118-140` evidence-binding gate; `:145-151` the freeze: `auth.repo.saveIssue(auth.ws, projectId, auditId, frozen, new Date().toISOString())`.
- `:132-140` — the only human attribution present at issuance is `EvidenceOverride.auditor_pseudonym` — **supplied by the caller in the request body**, not derived from a session.

**Legacy KV issuance** — `src/lib/persistence/issue-ledger.ts`
- `:33-54` — `saveIssue()`: revision = prior + 1 (`:41`), write-once conflict check (`:43-45`), and the record is built at `:46-51` with **`issued_by: "auditor"` hard-coded at `:49`**.
- `:56-71` — `getIssue` / `listIssues` (ordered by `artifactSeqOf`, `:68`).
- `:73-77` — issued revisions are never purged (no delete API).
- `:79-93` / `:98-124` — export / restore envelopes (rollback path; restore is write-once, `:114-120`).

**Postgres issuance** — `src/lib/db/tenant-store.ts`
- `:204-241` — `saveIssue()`: revision from `max(revision)` (`:212-216`), the record built at `:217-222` with **`issued_by: "auditor"` at `:220`**, inserted into `public.audit_issues` (`:223-238`) with `on conflict … do nothing` and a raised `IssueRevisionConflictError` on collision (`:239-241`).
- `:79` — `withClaim()` wraps every statement in the claim transaction.

**The record type** — `src/domain/types.ts:301-306`
- `AuditIssue { revision: number; issued_at: string; issued_by: "auditor"; result: AuditResult }` — `issued_by` is a **TypeScript string literal type**, so widening it to a user id is a compile-visible change for every consumer, not a one-line edit.

**Backfill** — `src/lib/db/migration.ts:266` — legacy rows without a string `issued_by` are migrated as `"auditor"`; `migration.ts:271-284` writes the same column into `public.audit_issues`. Historical rows therefore carry a constant and **cannot be retro-attributed**.

**The other persisted records carry no actor at all**
- `src/lib/persistence/artifact-trail.ts:34-54` — `saveArtifactTrailFor()` writes one row per artifact (`:48-51`); the artifact payload has no actor field.
- `src/lib/persistence/artifact-trail.ts:90-100` — `ArtifactSummary` (the retained record of a pruned trail) — fields `audit_id`, `ran_at`, `artifact_count`, `nodes`, `pruned_at`; **no actor**.
- `src/lib/persistence/artifact-trail.ts:68-73` — trail ordering by `artifactSeqOf`; `:87-105` — prune-then-summary.
- `src/lib/persistence/project-store.ts:19-21` (`saveProject`), `:35-37` (`saveAudit`), `:51-55` (`saveAttachment`), `:72-91` (`deleteAttachment`, which also repairs `Project.input_values` in the same operation) — **no actor field on any of them.**
- `src/lib/persistence.ts:100-201` — the legacy `Repository` class delegates to those hats (`saveIssue` at `:127-135`, `saveArtifactTrailFor` at `:175-181`).

**Where the constant/non-actor actor value is written today — the complete list**
1. `src/lib/persistence/issue-ledger.ts:49` — `issued_by: "auditor"` (legacy KV path).
2. `src/lib/db/tenant-store.ts:220` — `issued_by: "auditor"` (Postgres path).
3. `supabase/migrations/0001_tenant_schema.sql:100` — column default `not null default 'auditor'`.
4. `src/lib/db/migration.ts:266` — backfill fallback `"auditor"`.
5. `src/domain/types.ts:304` — the literal type `"auditor"` that permits no other value.
6. `src/domain/outcome-contracts.ts:7` — `DEFAULT_AUDITOR_PSEUDONYM = "auditor-a1"`, used by `src/lib/client.ts:41` and by the outcome-logging rows.

---

## Mutation surfaces

Every route/handler under `src/app/api/**` that mutates tenant state, with the exact write call. Auth column: **W** = `requireWorkspace` (tenant-scoped), **A** = `requireAdmin` (dev console, explicitly *not* tenant-scoped), **—** = unauthenticated.

| # | Route file:line | Method | Write call | Auth |
|---|---|---|---|---|
| 1 | `src/app/api/projects/route.ts:11` | POST | `auth.repo.saveProject` (`:22`) | W |
| 2 | `src/app/api/projects/[projectId]/route.ts:22` | PATCH | `auth.repo.saveProject` (`:34`) | W |
| 3 | `src/app/api/projects/[projectId]/audits/route.ts:23` | POST | `auth.repo.saveAudit` (`:45`) | W |
| 4 | `src/app/api/projects/[projectId]/audits/[auditId]/route.ts:33` | PATCH | `auth.repo.saveAudit` (`:86`) | W |
| 5 | `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:55` | POST | `auth.repo.saveIssue` (`:145`) | W |
| 6 | `src/app/api/projects/[projectId]/attachments/[attachmentId]/route.ts:24` | DELETE | `auth.repo.deleteAttachment` (`:29`) | W |
| 7 | `src/app/api/upload/route.ts:9` | POST (image branch) | `repo.saveAttachment` (`:26`) | W |
| 8 | `src/app/api/dev/runs/route.ts:12` | POST | dev session state | A |
| 9 | `src/app/api/dev/runs/[runId]/edit/route.ts:12` | POST | dev session state | A |
| 10 | `src/app/api/dev/runs/[runId]/step/route.ts:22` | POST | dev session state | A |
| 11 | `src/app/api/dev/runs/[runId]/finish/route.ts:16` | POST | `repo.saveArtifactTrailFor(devWorkspaceHash(), …)` (`:28-33`) | A |
| 12 | `src/app/api/dev/runs/[runId]/route.ts:25` | DELETE | dev session state | A |
| 13 | `src/app/api/dev/vault/sync/route.ts:8` | POST | vault files | A |
| 14 | `src/app/api/dev/discovery/run/route.ts:11` | POST | discovery job | A |
| 15 | `src/app/api/dev/discovery/jobs/[id]/cancel/route.ts:6` | POST | job cancel | A |
| 16 | `src/app/api/dev/harvest-stream/route.ts:17` | POST | stream start | A |
| 17 | `src/app/api/dev/harvest-stream/[id]/pause/route.ts:5` | POST | stream state | A |
| 18 | `src/app/api/dev/harvest-stream/[id]/resume/route.ts:5` | POST | stream state | A |
| 19 | `src/app/api/dev/harvest-stream/[id]/stop/route.ts:5` | POST | stream state | A |
| 20 | `src/app/api/dev/harvest-stream/secrets/route.ts:22` | POST | harvest secrets | A |
| 21 | `src/app/api/dev/harvest-stream/secrets/route.ts:52` | DELETE | harvest secrets | A |

Read-only routes (no mutation): `src/app/api/projects/route.ts:29` GET, `src/app/api/projects/[projectId]/route.ts:13` GET, `src/app/api/projects/[projectId]/audits/route.ts:52` GET, `src/app/api/projects/[projectId]/audits/[auditId]/route.ts:24` GET, `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:25` GET, `src/app/api/projects/[projectId]/attachments/[attachmentId]/route.ts:11` GET, plus the admin GETs under `src/app/api/dev/**`.

Unauthenticated public routes (by design, no tenant state): `src/app/api/jurisdictions/route.ts:6`, `src/app/api/jurisdictions/[jur]/stages/route.ts:11`, `src/app/api/inputs/[jur]/route.ts:11`.

Notes:
- Every tenant-scoped mutation reaches the store through **one** seam: `auth.repo` (produced at `src/lib/api.ts:117`), typed by `src/lib/db/tenant-repository.ts:19-70`. Threading an actor id means changing that interface, not 21 call sites.
- `src/app/api/upload/route.ts:19-21` explicitly notes "one store per request, never a second Repository built here" — that invariant must survive.
- `src/app/api/dev/runs/[runId]/finish/route.ts:5-6` states the dev console keeps the legacy KV repository by design and is "not tenant-scoped" — dev routes write under `devWorkspaceHash()` (`src/lib/devtab.ts:15-17`).
- `next.config.ts:10-43` keeps an explicit list of the API routes for `outputFileTracingIncludes` — any new route added by #54 should be registered there.

---

## Seat enforcement surfaces

**There is no invite, team, membership, or seat surface in the product today.**
- No route file under `src/app/api/**` mentions invite/seat/member/team (the only hits for those words across `src/` are inside `src/lib/db/**`, `src/lib/api.ts`, `src/lib/report.ts`, `src/domain/**` — none is a product route).
- The product pages are: `src/app/page.tsx` (landing), `src/app/projects/page.tsx`, `src/app/projects/[projectId]/page.tsx`, `src/app/projects/[projectId]/audits/[auditId]/page.tsx`, plus the dev console (`src/app/dev/**`) and the probe harness (`src/app/probe/**`). **There is no sign-in page and no account page** (`src/app/` contains only `_components`, `api`, `dev`, `fonts`, `probe`, `projects`).
- The only workspace-facing UI control on identity is `src/app/_components/reset-key.tsx:6-18` ("reset local workspace key").

**What already exists that a seat count could hang off**
- `public.workspaces` (`supabase/migrations/0001_tenant_schema.sql:32-40`) — the Workspace row; **no `seat_count` column**, no `owner_subject_id`.
- `public.workspace_members` (`:42-48`) — the membership edge with `role text not null default 'member'` (`:45`) and PK `(workspace_id, subject_id)` (`:47`); **no invited/pending state**, so an "invited but not yet signed in" member cannot be represented without a schema change.
- `src/lib/db/identity.ts:164-177` — the membership check (`workspace_members` row must exist for the claim's subject) is the only "is this person a member" logic in the codebase.
- `src/lib/db/credentials.ts:28-35` — `CredentialRecord` already carries `workspaceId` + `subjectId`; the subject model exists, just not the user model.

**Concrete surfaces that could enforce a seat count at invite** (each currently absent — the facts, not a proposal):
1. A workspace-scoped invite write to `public.workspace_members` — blocked by the RLS insert policy `subject_id = app_claim_subject()` (`supabase/migrations/0002_rls_policies.sql:80-82`), which permits only self-insertion under the `auditorai_app` role; inserting a *different* subject requires either a policy change (new migration file) or the service role (`src/lib/db/admin.ts:11-14`).
2. The existing product surface where a Workspace is identified — today only by the browser key (`src/lib/client.ts:19-26`), so there is no "current workspace" object a seat count could attach to in the UI.
3. The rate limiter (`src/lib/ratelimit.ts`, used at `src/lib/api.ts:90` and `:54`) is keyed on credential digest, not on workspace — it is a throttle, not a seat counter.

**Risk note:** a seat count enforced at invite is a *count of membership rows*; the schema has no column that records the allowed count, so the count would have to be added to `workspaces` (a 4th migration file, `supabase/migrations/0004_*.sql`, applied by the operator per `supabase/README.md:23-52`).

---

## Dependencies

From `package.json` (no `package.json` edit is in scope for discovery; the dependency set is quoted verbatim).

- Runtime `dependencies`: `ajv ^8.20.0`, `next ^15.5.0`, `pg ^8.23.1`, `react ^19.1.0`, `react-dom ^19.1.0`, `unpdf ^1.8.1`.
- **`@supabase/supabase-js` — NOT present. `@supabase/ssr` — NOT present.** No `@supabase/*` package of any kind is in `package.json`.
- No JWT library either: no `jose`, no `jsonwebtoken`, no `next-auth`, no `@clerk/*`, no `workos-node`.
- `devDependencies`: `@electric-sql/pglite ^0.5.11` (the offline Postgres), `@playwright/test ^1.62.1`, `@tailwindcss/postcss ^4.1.0`, `@types/node ^22.10.0`, `@types/pg ^8.23.1`, `@types/react ^19.1.0`, `@types/react-dom ^19.1.0`, `eslint ^9.20.0`, `tailwindcss ^4.1.0`, `tslib ^2.8.0`, `tsx ^4.23.12`, `typescript ^5.7.0`, `typescript-eslint ^8.20.0`, `vitest ^3.0.0`, `yaml ^2.9.0`.
- **Next.js `^15.5.0`** (App Router; `src/app/` layout at `src/app/layout.tsx`), **React `^19.1.0`**, **Node `>=22`** (`package.json` `engines`).
- **`middleware.ts` does not exist** — neither `middleware.ts` at the repo root nor `src/middleware.ts` (verified by direct `ls` of both paths; the `src/app` tree contains no middleware file either). So there is **no session-refresh hook** in the app today; any Supabase session cookie would have to be read/refreshed per request inside the route layer, or a new `middleware.ts` would have to be introduced.
- `tsconfig.json:21-23` — path alias `@/* → ./src/*`; `tsconfig.json:5` — `strict: true`; `tsconfig.json:25` — includes `**/*.ts` (so new tests are type-checked by `npm run typecheck`).
- `eslint.config.mjs:3-14` — `typescript-eslint` recommended; `no-unused-vars` is an **error** with `^_` ignore patterns (`:8-11`).

---

## Test conventions

- **Runner:** `vitest.config.ts` — `test.environment: "node"` (`:5`), `setupFiles: ["./tests/setup.ts"]` (`:6`), `include: ["src/**/*.test.ts", "tests/**/*.test.ts"]` (`:7`), `resolve.alias` `@ → ./src` (`:16-19`).
- **Offline guarantee:** `vitest.config.ts:9-14` blanks `POSTGRES_URL`, `TENANT_POSTGRES_URL`, `TENANT_STORE`, `SUPABASE_URL` for every suite; `src/lib/db/pg-client.ts` refuses to build a pool under `NODE_ENV === "test"` (referenced at `vitest.config.ts:10-12` and `src/lib/db/config.ts:9-12`).
- **Layout:** domain/behaviour suites in `tests/domain/`, route- and store-level suites in `tests/integration/`, contract suites in `tests/contract/`, Playwright specs in `tests/e2e/`, JSON fixtures in `tests/fixtures/`. A few unit suites also live beside the code in `src/lib/__tests__/` and `src/__tests__/` (`src/lib/__tests__/api-errors.test.ts`, `src/__tests__/discovery-jobs.mr6.test.ts`).
- **Global setup:** `tests/setup.ts:16-18` installs a throwing outcome sink (no test may write to `state/candidate-outcomes/`); `tests/setup.ts:20-34` warns about leaked files without deleting them.
- **How an API route test is written** (`tests/integration/candidate-review-route.test.ts`):
  - import the handler directly by name — `import { POST as postIssue } from "@/app/api/projects/[projectId]/audits/[auditId]/issues/route";` (`:8`);
  - build a plain `Request` with the header — `const H = { "x-workspace-key": KEY, "content-type": "application/json" };` (`:20`) and `new Request("http://local/api/…", { method, headers, body })` (`:23-29`);
  - the workspace hash is computed in the test with the production helper — `workspaceHash(KEY)` (`:21`);
  - the legacy store is injected in memory — `setDataStoreForTests(new MemoryStore())` (`:9` import; the pattern is at `tests/integration/tenant-store-cutover.test.ts:41-47`);
  - the route handler is then called directly and the `NextResponse` is inspected.
- **How the Postgres store is tested offline (pglite)** (`tests/integration/tenant-isolation.test.ts`):
  - `PGlite.create({ relaxedDurability: true })` (`:83`), then every file in `supabase/migrations` is executed in sorted order (`:55`, `:85-90`);
  - the client is injected with `setSqlClientForTests(...)` (`src/lib/db/sql.ts:70-72`), which makes `isTenantDatabaseAvailable()` true (`src/lib/db/identity.ts:62-64`) so the real resolution path runs;
  - generous timeouts on purpose: `vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })` (`:32`);
  - the suite asserts *which store answered* via `database_status.database_state === "postgres"` (`:9`) so it cannot pass vacuously against the legacy store (`:1-22`).
  - Other pglite suites: `tests/integration/tenant-rls.test.ts`, `tests/integration/kv-to-postgres-migration.test.ts`, `tests/integration/database-not-configured.test.ts`.
- **Commands** (`package.json` `scripts`): `npm run lint` → `eslint .`; `npm run lint:fix` → `eslint . --fix`; `npm run typecheck` → `tsc --noEmit`; `npm run test` → `vitest run`; `npm run build` → `next build`; `npm run ci` → `lint && typecheck && test && build`; `npm run ci:local` → `ci` plus the vault/evidence/eval-gate/harvest checks. A single suite runs with `npx vitest run <path>` (vitest is the only runner; `playwright.config.ts` covers `tests/e2e`).
- Repo rules that bind the implementer: `AGENTS.md` — pre-commit runs lint + typecheck + vault determinism + YAML parse; `node scripts/vault-sync.mjs --check` before push; never write the literal `[skip ci]`; stage only the files your ticket touched.

---

## Env surface

**Names already present in `.env.example`** (each read at call time, blank = unset):
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `AI_ENABLED`, `OPENCODE_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_EFFORT`, `AI_FALLBACK_BASE_URL`, `AI_FALLBACK_API_KEY`, `ADMIN_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `TENANT_STORE`, `TENANT_POSTGRES_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`.

**Existing accessors** (`src/lib/db/config.ts`): `tenantStoreEnabled()` `:30-32`; `isDatabaseConfigured()` `:35-37`; `postgresUrl()` `:42-44`; `postgresUrlNonPooling()` `:47-50`; `supabaseUrl()` `:53-55`; `supabaseAnonKey()` `:58-62`; `supabaseJwtSecret()` `:64-67` (**"Reserved for #54 (JWT subject verification)"**); `postgresPrismaUrl()` `:71-73`. Plus `supabaseServiceRoleKey()` in `src/lib/db/admin.ts:11-14`. Every accessor treats a blank value as unset (`src/lib/db/config.ts:18-21`).

**NEW env var names proposed for #54** (to be added to `.env.example`; all absent today):

| Proposed name | Purpose | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_AUTH_ENABLED` | Master gate for the sign-in UI. Absent/false ⇒ the product shows the plain "sign-in not configured" state and the legacy workspace-key path keeps working. | Browser-visible, so it must be `NEXT_PUBLIC_*`. |
| `NEXT_PUBLIC_SUPABASE_AUTH_EMAIL_ENABLED` | Email sign-in (password / magic link) on/off. | Presence ⇒ that provider is configured. |
| `NEXT_PUBLIC_SUPABASE_AUTH_GOOGLE_ENABLED` | Google sign-in on/off. | Set only after the operator configures the Google app; absent ⇒ button hidden, not an error. |
| `NEXT_PUBLIC_SUPABASE_AUTH_MICROSOFT_ENABLED` | Microsoft sign-in on/off. | Same shape as Google. |
| `SUPABASE_SEATS_DEFAULT` | Default seat count applied when a Workspace row is created (the per-Workspace count itself is a `workspaces` column). | Server-side; blank ⇒ a documented default. |
| `NEXT_PUBLIC_APP_URL` | The app's public origin, needed to build the OAuth redirect URL that must be allow-listed in the Supabase project. | No app-origin variable exists today; `VERCEL_*` is not referenced anywhere in `src/`. |

Already-sufficient names (no new var needed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), `SUPABASE_JWT_SECRET`, `SUPABASE_URL`.

**Constraint from the ticket body:** "The operator creates the Supabase project and its keys. Never create accounts or handle secrets: read them from env, with names listed in `.env.example`." — so the implementation may only *read* these names and may only *list* them in `.env.example`.

---

## Gaps, risks and open questions

**R1 — "Rotatable, revocable credentials" maps onto a *different* object than a user session.** The shipped credential lifecycle is `src/lib/db/credentials.ts:62-165`: revoke sets `revoked_at` and keeps the row and the data (`:70-73`); rotate marks the old row revoked+rotated and writes a new row for the same workspace/subject (`:120-127`, `:147-152`); `src/lib/db/identity.ts:160-162` then rejects the rotated credential as revoked, so **rotation is immediate and total** — there is no overlap window in which two credentials are valid. That lifecycle governs a **tenant credential** (a bearer key that stands for a subject), not a user's Supabase session. A Supabase session has its own lifecycle (refresh-token rotation, sign-out, `auth.admin.deleteUser`), which the repo has no notion of. **Open question for the architect:** does "rotatable, revocable" in #54 mean (a) the existing tenant credential lifecycle extended to named users, (b) the Supabase session lifecycle, or (c) both — and are they the same artifact?

**R2 — The whole credential lifecycle is dormant in production.** `src/lib/db/config.ts:30-37` means the Postgres path (and therefore `workspace_credentials`, `revokeCredential`, `rotateCredential`, `subjectId`) does not run unless the operator sets `TENANT_STORE=postgres` and `TENANT_POSTGRES_URL`. The orchestrator's constraint is that production behaviour must not change while the switch is off. **Consequence:** the "rotation path exists and has been exercised" half of G-5 (`:577-578`) can only be proven offline (pglite) unless the operator flips the switch — the proof is a test, not a deployment.

**R3 — The legacy workspace-key path cannot be retired by #54 alone, and must keep working.** The key is minted client-side (`src/lib/client.ts:19-26`), stored in `localStorage` (`:23`), sent as `x-workspace-key` (`:77`), and accepted by `src/lib/api.ts:79-89`. If #54 introduces sessions, the legacy key path is still the production path (switch off ⇒ `src/lib/db/identity.ts:129-131` ⇒ legacy store, `:34-38`). So two identity mechanisms will coexist, and the legacy branch of `TenantResolution` carries **no subject at all** (`src/lib/db/identity.ts:34-38`) — i.e. on the legacy path there is **no actor id to write**. Every "mutation carries an actor id" acceptance item is therefore unsatisfiable on the legacy path unless a fallback actor id is defined. **Open question:** what is the actor id of a legacy request — a constant, a derived hash, or "unknown"? Note the gap audit forbids a *constant* actor (G-1 `:527-528` "non-constant actor id that resolves to a user"), which forces the question.

**R4 — Places where an actor id cannot be resolved at all today.**
1. The legacy branch of `resolveTenant` (`src/lib/db/identity.ts:34-38`, `:129-131`, `:155-159`) — no subject.
2. The unauthenticated public routes (`src/app/api/jurisdictions/route.ts:6`, `src/app/api/inputs/[jur]/route.ts:11`, `src/app/api/jurisdictions/[jur]/stages/route.ts:11`) — no caller, no mutation either.
3. The dev-console surface (rows 8-21 of the mutation table) — `requireAdmin` returns only `{ ok: true }` (`src/lib/api.ts:47-71`), there is no subject, and `src/app/api/dev/runs/[runId]/finish/route.ts:5-6` states the dev console is deliberately not tenant-scoped; it writes artifacts under `devWorkspaceHash()` (`src/lib/devtab.ts:15-17`).
4. Historical records migrated from KV: `src/lib/db/migration.ts:266` writes `"auditor"` — a backfilled record cannot be attributed to a real person and cannot be re-attributed later without a rewrite of write-once rows (ADR-0004).
5. The `issued_by` literal type `"auditor"` (`src/domain/types.ts:304`) forbids storing anything else until it is widened — a compile-time blocker, not a runtime one.
6. The self-asserted `auditor_pseudonym` (`src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:86-101`, `src/lib/client.ts:39-42`) is *not* an actor id: it is a browser-supplied string with a shared default.

**R5 — The RLS membership policy blocks the invite write a seat count needs.** `supabase/migrations/0002_rls_policies.sql:80-82` allows `workspace_members` inserts only where `subject_id = app_claim_subject()`; under the `auditorai_app` role (`supabase/migrations/0003_roles.sql:18-23`) an owner therefore **cannot insert a membership row for a different subject**. An invite flow needs either a new policy (a 4th operator-applied migration, `supabase/README.md:23-52`) or the service role (`src/lib/db/admin.ts:11-14`), which bypasses RLS entirely. There is also no `seat_count` column on `workspaces` (`supabase/migrations/0001_tenant_schema.sql:32-40`) and no invited/pending state on `workspace_members` (`:42-48`).

**R6 — Two new runtime dependencies are implied and neither is installed.** No `@supabase/supabase-js` and no `@supabase/ssr` in `package.json`; no JWT-verification library either. `SUPABASE_JWT_SECRET` is explicitly reserved for "JWT subject verification" (`src/lib/db/config.ts:64-67`), which implies the design verifies a Supabase-signed JWT server-side. Note the collision risk with #47 ("Inventoried, pinned and scanned runtime dependencies") — the dependency set changes in the same release cycle.

**R7 — No `middleware.ts` exists.** There is no request-time hook where a Supabase session could be read/refreshed; every tenant route resolves identity inside `requireWorkspace` (`src/lib/api.ts:113`). Any session handling either lives in `requireWorkspace` or requires a new root `middleware.ts`.

**R8 — "Every mutation carries the actor's user id" touches the repository seam, not the routes.** All tenant writes go through `TenantRepository` (`src/lib/db/tenant-repository.ts:19-70`) with two implementations (legacy `src/lib/persistence.ts:100-201`, Postgres `src/lib/db/tenant-store.ts:72`+). The `saveIssue` signature (`src/lib/db/tenant-repository.ts:31-37`) and the record shape (`src/domain/types.ts:301-306`) are the two places an actor id must enter; the `AuditResult` payload (`src/lib/persistence/project-store.ts:35-37`) and the artifact trail (`src/lib/persistence/artifact-trail.ts:34-54`, `:90-100`) carry no actor today.

**R9 — The "issued record still freezes" property must survive the actor change.** Issuance is write-once by revision-in-key (`src/lib/persistence/issue-ledger.ts:30-45`; `supabase/migrations/0001_tenant_schema.sql:94-103`; `src/lib/db/tenant-store.ts:204-241`). Adding an actor id to the frozen record changes the frozen bytes — and `src/lib/persistence/issue-ledger.ts:114-120` compares frozen payloads byte-for-byte on restore, so a change in the actor field changes restore-conflict behaviour for already-issued lineages.

**R10 — The repo's own security record contradicts the shipped code (G-5 `:579`).** `docs/validation/security-review.md:17` still says "Anonymous workspaces, no accounts/PII; demo data only", and `docs/validation/security-review.md:19` gates the system at "acceptable for prototype deployment carrying non-sensitive data"; `:11` records the workspace access model as "Bearer-style `x-workspace-key`". G-5 requires that record to stop contradicting the code — a documentation change that belongs to this ticket.

**Open questions for the Griller / Architect**
1. Actor id on the legacy path — what is it, given G-1 forbids a constant?
2. Does the actor id live in the frozen record, beside it (a new column), or both?
3. Is a seat count a property of `workspaces` (a column) or of a plan/entitlement elsewhere? Who is allowed to set it?
4. Who can invite — workspace owner (`role` in `workspace_members.role`, `supabase/migrations/0001_tenant_schema.sql:45`) — and which role string values exist? The column is free text with default `'member'` and no enum.
5. Does an invited-but-not-signed-in member consume a seat (requires a pending state in `workspace_members`)?
6. Is email sign-in password, magic link, or OTP? The ticket says only "email".
7. Does #54 own the Google/Microsoft provider configuration, or only the code path (the operator configures the apps later, per the orchestrator brief)?

---

## Reusable assets

Existing helpers/modules to reuse rather than reinvent (name — path):

**Identity / tenant seam**
- `requireWorkspace()` — `src/lib/api.ts:73-123` — the single place a request's tenant identity is produced; the natural home for the actor id on `auth`.
- `resolveTenant()` — `src/lib/db/identity.ts:127-192` — the ONE place a tenant identity is produced (`:1-2`).
- `claimsJson(subjectId, workspaceId)` — `src/lib/db/identity.ts:43-45` — the claim shape (`sub`, `workspace_id`) a Supabase JWT would map onto.
- `TenantResolution` / `TenantSession` — `src/lib/db/identity.ts:32-38`, `src/lib/db/tenant-repository.ts:77-84` — the typed identity carriers.
- `createTenantRepository()` — `src/lib/db/repository-factory.ts:22-35` — the ONE place Postgres-vs-legacy is decided.
- `workspaceHash()` — `src/lib/persistence/store.ts:236-240` — the single credential-derivation point.
- `isTenantDatabaseAvailable()` — `src/lib/db/identity.ts:62-64`.
- `supabaseServiceRoleKey()` — `src/lib/db/admin.ts:11-14` — the only service-role reader.
- `supabaseUrl()` / `supabaseAnonKey()` / `supabaseJwtSecret()` — `src/lib/db/config.ts:53-67` — already-existing env accessors (the last one reserved for #54).

**Credential lifecycle**
- `revokeCredential()` / `rotateCredential()` — `src/lib/db/credentials.ts:62-88` / `:92-165` — the existing rotate/revoke semantics (never delete a row).
- `CredentialRegistryError`, `CredentialRevokedError` — `src/lib/db/credentials.ts:21-26`, `src/lib/db/errors.ts:31-36`.

**Errors / HTTP mapping**
- `ERROR_TABLE` + `serverError()` — `src/lib/api.ts:146-176` — where a new "not signed in" / "seat limit exceeded" error type would be mapped.
- `DatabaseUnavailableError` / `WorkspaceMembershipError` / `DatabaseNotConfiguredError` — `src/lib/db/errors.ts:10-45` — the house style for typed DB errors.

**"Not configured" notice pattern (the model for "sign-in not configured")**
- `DatabaseStatus` / `DatabaseCode` / `databaseNoticeText()` — `src/lib/db-notice.ts:16-69` — a plain, server-free module so the client page and a test can read the same wording (`:1-5`); the exact shape a "sign-in not configured" notice should reuse.
- `legacyDatabaseStatus()` / `postgresDatabaseStatus()` — `src/lib/db-notice.ts:37-44`.

**Persistence seam**
- `TenantRepository` interface — `src/lib/db/tenant-repository.ts:19-70` — where an actor parameter would be added.
- `Repository` (legacy) — `src/lib/persistence.ts:100-201`.
- `PostgresTenantRepository` — `src/lib/db/tenant-store.ts:72`.
- `IssueLedger.saveIssue()` — `src/lib/persistence/issue-ledger.ts:33-54`.
- `ProjectStore` — `src/lib/persistence/project-store.ts:14-91`.
- `ArtifactTrail` — `src/lib/persistence/artifact-trail.ts:28-139`.
- Key scheme owner — `src/lib/persistence/keys.ts:5-48`.
- `DataStore` seam + `MemoryStore` — `src/lib/persistence/store.ts` (`setDataStoreForTests` at `:232-234`).

**DB seam / offline testing**
- `SqlClient` interface + `setSqlClientForTests()` / `getInjectedSqlClient()` — `src/lib/db/sql.ts:11-14`, `:70-78`.
- `createPgliteSqlClient()` — `src/lib/db/pglite-client.ts:38`.
- `beginAppRoleTransaction()` / `assertAppRole()` — `src/lib/db/sql.ts:44-47`, `:28-38`.
- pglite harness pattern — `tests/integration/tenant-isolation.test.ts:79-90` (boot, apply `supabase/migrations/*.sql` in order, inject).

**Client / UI**
- `api()` / `adminApi()` transports — `src/lib/client.ts:76-82`.
- `ensureWorkspaceKey()` / `getWorkspaceKey()` / `useResetWorkspace()` — `src/lib/client.ts:14-26`, `:90-95` — the legacy credential path that must keep working.
- `ResetKeyLink` — `src/app/_components/reset-key.tsx:6-18`.
- `InlineNotice` — `src/app/_components/ui/inline-notice.tsx` — the existing notice component the "sign-in not configured" state would render (used at `src/app/projects/page.tsx:12`, `:57`, `:67`; the notice text is read at `:38`).
- `databaseNoticeText()` usage pattern in a page — `src/app/projects/page.tsx:22-38`.

**Operator-facing**
- `supabase/README.md:23-52` — the operator procedure for applying migrations and flipping the switch; any new migration file must be listed there.
- `supabase/migrations/0001-0003` — the existing schema/policy/role files a 4th file would extend.
- `scripts/migrate-kv-to-postgres.ts` + `src/lib/db/migration.ts` — the KV→Postgres backfill that would have to carry an actor (or explicitly not).

**Documentation that #54 must reconcile**
- `docs/validation/security-review.md:11`, `:19` — the record G-5 requires to stop contradicting the code.
- `docs/research/enterprise-gap-audit.md` G-1 (`:518-529`) and G-5 (`:569-580`) — the source acceptance sketches.

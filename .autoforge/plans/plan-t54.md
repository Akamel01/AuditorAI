# Plan v2 — Ticket #54 (named-user accounts, seats, actor id on every mutation and issued record)

Repo: `Akamel01/AuditorAI` · branch `oc/54` · base HEAD `c7c449e` (PR #59, Supabase Postgres tenant store).

**Authority (binding, in this order).**
1. `.autoforge/decisions/od-t54.md` — OD1..OD11 (settled).
2. `.autoforge/decisions/od-t54-fixups.md` — **OD12..OD20** (the orchestrator's resolution of
   `.autoforge/reviews/plan-critique-t54.md`, blockers B1–B8 and notes N1–N9). **Every OD12–OD20 is
   implemented by a named module below and mapped in *Critique resolutions*.**
3. The critique (read-only evidence) — B1..B8, N1..N9.
4. v1 of this plan (`.autoforge/plans/plan-t54.md` @ v1) and its work order.

Background only (skimmed): `.autoforge/discovery/report-t54.md`,
`.autoforge/requirements/grilling-t54.md`, `.autoforge/architecture/report-t54.md`.

**What v2 changed.** Nine defects from the critique are folded in; nothing else was re-opened.

| Critique | Fix | Where |
|---|---|---|
| B1 | No public self-serve sign-up; accounts are created **only** by invite acceptance (Auth Admin API, `email_confirm: true`). | M2, M9, M10 — OD12 |
| B2 | The actor never enters a payload document; `audits.produced_by` / `attachments.uploaded_by` are **columns**. | M1, M5, M7 — OD13 |
| B3 | Role is assigned at invite time; the app role has **no UPDATE privilege** on `workspace_members.role`; no role-change surface. | M7, M8, M10 — OD14 |
| B4 | The repository interface's actor parameter is **optional** (`actor?: ActorId`); the adapter derives a non-constant legacy actor when it is absent. | M1, M4, M5 — OD15 |
| B5 | The migration lands **before** every module that reads its columns; no module leans on the `SCHEMA_MISSING_STATES` fallback for a `0004` column. | wave order, M4 — OD16 |
| B6 | The migration module owns the migration-enumerating test. | M7 — OD17 |
| B7 | The application never creates a workspace or an owner; the operator provisions the first owner out of band. | M7, M8 — OD18 |
| B8 | `seat_count` is written only by the operator, out of band; the test asserts the **privilege shape**. | M7, M8 — OD19 |
| N1–N9 | TTL constant 14 d; the member list is filtered by `workspace_id`; the seat path never uses owner credentials; no backfill rewrites a historical `issued_by`; the write path has a runtime guard; `next.config.ts` dropped; a delete carries the actor; one interface, both adapters; a revoked member frees its seat. | M1, M2, M5, M6, M7, M8, M9, M12 |

Two deliberate deviations from the architecture (both forced by the OD, unchanged from v1):

1. **OD4 + OD5.3 ⇒ one table, not two.** A pending invitation is a `workspace_members` row with
   `status='pending'` and a placeholder subject. There is no `workspace_invites` table.
2. **OD4's role vocabulary is `owner | admin | member`** (the architecture used only `admin`).

---

## Objective and acceptance

The ticket: *"Sign-in with email, Google and Microsoft. Seat count per Workspace, enforced at invite. Every
mutation and issued record carries the actor's user id. Rotatable, revocable credentials. The operator creates
the Supabase project and its keys. Never create accounts or handle secrets: read them from env, with names
listed in .env.example."*

**What the ticket means here, after OD12–OD20.**

- *Sign-in with email, Google and Microsoft* — server-mediated (OD6). **There is no self-serve sign-up**
  (OD12): an account is created only when an invited person accepts the invitation; a sign-in attempt for an
  email with no invitation answers a plain notice and creates nothing.
- *Seat count per Workspace, enforced at invite* — `workspaces.seat_count`; a seat = an accepted member + a
  pending, unexpired invitation (OD4); the limit is written only by the operator (OD19).
- *Every mutation and issued record carries the actor's user id* — the actor id is `u:<uuid>` /
  `legacy:<16-hex>` / `admin:<digest>` (OD2), it never enters a payload document (OD13), and the constant
  `"auditor"` survives only as a **read** value (OD2, OD20-N5).
- *Rotatable, revocable credentials* — server-side generation; the browser only stores the issued key.
- *Never create accounts or handle secrets* — the implementer creates no account and handles no secret value;
  the product's only account-creation path is the invite acceptance (OD12), which uses the **existing**
  server-side service-role accessor (`src/lib/db/admin.ts`) — no new env name, no new secret in the repo.

**The full acceptance table** — AC1..AC24, each with its proving test and its source — is in
*Acceptance* at the end of this document.

---

## Tracker coverage

Every row of `.autoforge/discovery/tracker-index-t54.md` is mapped. Exactly one row is in scope:
**GH#54**, the frontier entry this plan executes. The table is unchanged from v1 (the critique proposed no
tracker change): GH#42, #44, #45, #46, #47, #48, #49, #50, #51, #53, #55, #56, #60, #62, the
`local:.scratch/readiness-framework/07` row, the `wayfinder:ops-residual/R1..R18` rows and the
`wayfinder:v2-agentic-platform/F2`, `wayfinder:v3-architecture-deepening/F4` and `wayfinder:v6-horizon/H3`
rows are all **out** — each with its reason recorded in v1's table (non-frontier, a different gap entry, a
different ticket, or an unrelated lane). Two rows move with the OD, not with the tracker:

- **GH#53** (the tenant store) — **in scope in part**: #54 extends it with migration `0004` and widens three
  of its policies (OD5). It does not re-decide the store.
- **GH#50** (the identity/tenant decision ticket) — #54 answers it for the Postgres path; the legacy
  browser-minted key stays until the `TENANT_STORE=postgres` cutover (OD1).

---

## Out of scope

Each exclusion with one reason. All are either a different ticket, a different gap entry, or a deliberate OD
decision.

| Excluded | Reason |
|---|---|
| **Public self-serve sign-up** (`signUpWithPassword`, `action:"signup"`) | **OD12**: the app has no open sign-up route. An account is created in exactly one place — the invite acceptance (M10) — through the Supabase Auth Admin API. |
| **A role-change surface** (promote/demote a member) | **OD14**: roles are assigned when the invite is created; the app role holds no UPDATE privilege on `workspace_members.role`; changing a role is an operator SQL operation (documented in `supabase/README.md`). |
| **The application creating a workspace or an owner** | **OD18**: the first `owner` is provisioned by the operator out of band. A subject with no membership row gets the existing `WorkspaceMembershipError` → 403, exactly as today. |
| **Magic-link / email-OTP sign-in** | OD6: email sign-in is **email + password** against `/auth/v1/token?grant_type=password`; magic link/OTP needs operator SMTP and is deferred. |
| **Email verification** | Not in G-1's acceptance sketch; needs operator SMTP. Follow-up ticket (grilling H7). |
| **Password reset / account recovery** | Not in the ticket body; follow-up ticket (grilling H8). |
| **Account deletion / PII purge / a user-id ↔ pseudonym mapping table** | OD7: #54 creates **no** mapping table, no PII store and no re-identification path. |
| **A first-credential `issue` action** on the credential route | The critique's scope check: `rotateCredential` already writes a new row, and the operator's first credential is provisioned out of band (the SQL in *Data model and migration*). The route offers `rotate` and `revoke` only. |
| **`next.config.ts` route registration** | The critique's N6: `API_ROUTES` only feeds `outputFileTracingIncludes`; there is no `vercel.json` and the new routes read no runtime files. The change bought nothing and dragged `policies/**` into the tracing. **Dropped from v1.** |
| **Dev-console actor threading** (the `/api/dev/*` routes and `requireAdmin`) | OD10: the dev console is admin-gated and deliberately not tenant-scoped (`src/app/api/dev/runs/[runId]/finish/route.ts:5-6`). It creates **no issued record**, so no record there needs an actor; `requireAdmin` still returns `admin:<digest>` so that a future dev route can stamp one. |
| **Audit trail, tombstones and per-firm export** | Tracker **#55** (G-3). #54 produces the actor id the trail will name; it builds no trail. The delete route carries the actor through the seam (OD20-N7) but persists no tombstone. |
| **Backups / point-in-time recovery** | Tracker **#56** (G-4). |
| **Schema validation at every trust boundary** | Tracker **#46** (G-6). #54's new request bodies are hand-checked — a written-down risk, not a new exception class. |
| **Dependency inventory, pinning and scanning** | Tracker **#47** (G-7). **OD8**: #54 adds **no** runtime dependency (no `@supabase/supabase-js`, no `@supabase/ssr`, no JWT library) — `node:crypto` + `fetch` with an injected `fetchImpl`. |
| **The legacy browser-minted workspace key** | It stays until the `TENANT_STORE=postgres` cutover. OD1/OD3: G-2 is satisfied on the Postgres path and **open** on the legacy path. |
| **WorkOS / enterprise SSO, author/reviewer separation, billing, blob storage** | Not in the ticket body (grilling H6, §5.2 C3, F2). |

---

## Module plan

Twelve modules, eight waves. **No file is touched by two modules** — `touches:` is the parallel-safety guard
and the work order's `shared_state` is empty. Modules are boundaries, not child sessions: M5 and M9 are large
enough to be split by an executor, as long as the `touches:` set and the acceptance criteria stay with the
module.

**Module boundary ≠ child-session boundary.** A worker may split a module into several child sessions
*inside* its boundary; the `touches:` set, the `blocked_by` edges and the acceptance criteria stay with the
module.

**Wave rule (OD15).** Every wave ends green: `npm run lint`, `npm run typecheck` and `npm run test` pass at
the **end of every wave**, not only at the end of the build. A worker that leaves a red wave does not finish.
That is why the repository-interface change (M4) is backward compatible when it lands: the actor parameter is
**optional**, the callers that have one pass it, and the adapter **derives** a non-constant legacy actor when
it is absent.

**Migration-before-reader rule (OD16).** M7 (`0004`) is in wave 1; every module that reads
`workspace_members.status | email | invited_by | expires_at | accepted_at | revoked_at` or
`workspaces.seat_count` is in a later wave (M4 wave 3, M5/M8/M11 wave 4). No module leans on the
`SCHEMA_MISSING_STATES` fallback (`src/lib/db/identity.ts:79`) for a `0004` column — that fallback is for a
missing tenant schema, not for a missing migration. A database without `0004` fails **closed**
(`DatabaseUnavailableError` → 503); the operator's procedure applies `0004` before flipping
`TENANT_STORE=postgres`.

### M1 — Foundation: the actor vocabulary, the claim contract, the config/notice seam

- **Purpose.** One place for the three nouns #54 introduces — the **actor id**, the **role** and the
  **configuration/notice wording** — so no module invents its own spelling.
- **`touches:`**
  - `src/domain/actor.ts` *(new)*
  - `src/lib/db/claim.ts` *(new)*
  - `src/domain/types.ts`
  - `src/lib/auth/config.ts` *(new)*
  - `src/lib/auth/notice.ts` *(new)*
  - `tests/domain/actor-id.test.ts` *(new)*
  - `src/lib/auth/__tests__/config.test.ts` *(new)*
- **Public interface.**
  ```ts
  // src/domain/actor.ts
  export type ActorKind = "user" | "workspace-credential" | "admin" | "unattributed";
  export type ActorId = `u:${string}` | `legacy:${string}` | `admin:${string}`;
  /** The READ union: the pre-#54 constant survives as a read value (historical rows only). */
  export type AuditActor = ActorId | "auditor";
  export function userActor(subjectId: string): ActorId;      // `u:${subjectId}`
  export function legacyActor(legacyHash: string): ActorId;   // `legacy:${legacyHash}`
  export function adminActor(digest: string): ActorId;        // `admin:${digest}`
  export function parseActorId(value: string): { kind: ActorKind; id: string } | null;
  export function isWrittenActor(value: string): value is ActorId;
  /** The write-site guard (OD20-N5): "auditor" is a READ value; a write throws. */
  export function assertWritableActor(value: string): ActorId;
  /** The subject of a PENDING invitation (no user yet): `pending:<16-hex>`. */
  export function pendingSubjectFor(email: string): string;

  // src/lib/db/claim.ts  (the claim document the tenant path presents)
  export type MemberRole = "owner" | "admin" | "member";
  export interface TenantClaim {
    sub: string; workspace_id: string; role: MemberRole | null; email: string | null;
  }
  export function tenantClaimJson(claim: TenantClaim): string;

  // src/lib/auth/config.ts  (server-only; reads env at CALL time, never at import)
  export interface AuthEnv {
    url: string | null; anonKey: string | null; jwtSecret: string | null;
    redirectOrigin: string | null;
    emailEnabled: boolean; googleEnabled: boolean; microsoftEnabled: boolean;
  }
  export function authEnv(): AuthEnv;
  export function authConfigured(env?: AuthEnv): boolean;
  export function enabledProviders(env?: AuthEnv): ("email" | "google" | "microsoft")[];

  // src/lib/auth/notice.ts  (a plain module, mirroring src/lib/db-notice.ts)
  export function authNoticeText(): string;                     // "sign-in is not configured"
  export function providerNoticeText(provider: string): string; // "this sign-in provider is not configured"
  export function tenantStoreNoticeText(): string;              // "sign-in requires the tenant store"
  export function noInvitationNoticeText(): string;             // "no invitation for this email"
  export function invitationPendingNoticeText(): string;        // "your invitation is pending — accept it"
  ```
  `src/domain/types.ts`: `AuditIssue.issued_by: "auditor"` → `AuditIssue.issued_by: AuditActor` (OD15 — the
  widening lands in the same module that introduces the actor type, so nothing breaks typecheck mid-build);
  `Project.updated_by?: AuditActor` and `Attachment.uploaded_by?: AuditActor` (both optional — historical rows
  genuinely lack them). **`AuditResult` gains nothing** (OD13 — no `produced_by`).
- **The change.** One new domain module owns the actor vocabulary of OD2 and nothing else writes an actor
  string. `userActor`/`legacyActor`/`adminActor` are the only constructors; `parseActorId` classifies a stored
  value (`"auditor"` → `unattributed`); `isWrittenActor` and `assertWritableActor` are the machine guards that
  no write path emits the constant (OD20-N5: the **read** union admits it, the **write** union does not, and the
  guard is a runtime check at the write site, not a type alone). `pendingSubjectFor` derives the placeholder
  subject of a pending invitation from the invited email with the same 16-hex derivation the repo already uses
  for `workspaceHash` (`src/lib/persistence/store.ts:236-240`), so the app and the schema agree on one
  representation. `src/lib/db/claim.ts` fixes the **claim document's field names** (`sub`, `workspace_id`,
  `role`, `email`) in one place: `0004`'s `app_claim_role()` / `app_claim_email()` read exactly those fields,
  and M4's resolver builds exactly those fields — the two cannot drift (this is M7's dependency on M1). The
  config module reads the five new env names at call time (never at import — the build must succeed with every
  variable unset, `src/lib/db/config.ts:4-6`) and **reuses** the existing `supabaseUrl()` /
  `supabaseAnonKey()` / `supabaseJwtSecret()` accessors; it adds no secret name and reads **no** service-role
  name (the secret-boundary scan allows that name in `src/lib/db/admin.ts` only,
  `tests/integration/secret-boundary.test.ts:168-176`). The notice module is plain, importable by a client page
  and by a test, exactly like `src/lib/db-notice.ts`.
- **Tests to write.**
  - `tests/domain/actor-id.test.ts` — `userActor("abc") === "u:abc"`; `legacyActor("0123456789abcdef") ===
    "legacy:0123456789abcdef"`; `adminActor("d") === "admin:d"`; `parseActorId("auditor")` →
    `{kind:"unattributed"}`; `parseActorId("u:x")` → `{kind:"user"}`; `isWrittenActor("auditor") === false`;
    `assertWritableActor("auditor")` **throws** while `assertWritableActor("u:x")` returns the value; two
    different legacy hashes produce two different ids (the non-constancy proof); `pendingSubjectFor` is
    deterministic, 16 hex chars, and differs for two different emails; `tenantClaimJson` emits exactly the four
    fields `sub`, `workspace_id`, `role`, `email`.
  - `src/lib/auth/__tests__/config.test.ts` — with no env set: `authConfigured() === false`,
    `enabledProviders() === []`; with the master switch + the email flag → `enabledProviders() === ["email"]`;
    with the Google flag but **no** redirect origin → Google is **not** offered; the module reads no
    service-role name (assert the file's source does not contain it — the same rule the secret-boundary scan
    enforces).
- **Acceptance criteria covered.** AC7, AC8, AC22.
- **`blocked_by`.** `[]` — this is the **only root of the DAG** (see *Open questions*, item 1).
- **Parallel-safe.** yes (nothing else exists yet).
- **Wave.** 0.
- **Implements.** OD2, OD13, OD15, OD20-N5.

### M2 — The Supabase Auth server core (no sign-up; the account-creation call)

- **Purpose.** The whole Supabase conversation, in one server-only module, with `fetch` injected for tests.
- **`touches:`** `src/lib/auth/supabase.ts` *(new)*, `src/lib/auth/__tests__/supabase.test.ts` *(new)*
- **Public interface.**
  ```ts
  export type AuthProvider = "email" | "google" | "microsoft";
  export interface AuthTokens {
    accessToken: string; refreshToken: string; expiresIn: number;
    subject: string; email: string | null;
  }
  export async function signInWithPassword(email: string, password: string,
    opts?: { fetchImpl?: typeof fetch }): Promise<AuthTokens>;
  /** The ONLY account-creation call in the product (OD12): the Auth Admin API. */
  export async function createUserWithPassword(email: string, password: string,
    opts?: { fetchImpl?: typeof fetch }): Promise<{ subject: string; email: string | null }>;
  export async function exchangeCodeForTokens(code: string, codeVerifier: string,
    opts?: { fetchImpl?: typeof fetch }): Promise<AuthTokens>;
  export async function refreshSession(refreshToken: string,
    opts?: { fetchImpl?: typeof fetch }): Promise<AuthTokens>;
  export async function revokeSession(refreshToken: string,
    opts?: { fetchImpl?: typeof fetch }): Promise<void>;
  export function providerAuthorizeUrl(provider: AuthProvider,
    opts: { redirectTo: string; codeChallenge: string }): string;
  export function pkceChallenge(verifier: string): string;   // S256, base64url
  export function verifyAccessToken(token: string, opts: {
    secret: string; issuer: string; audience: string; now?: number;
  }): { sub: string; email: string | null; exp: number } | null;
  ```
- **The change.** A thin `fetch` wrapper over the Supabase Auth REST API:
  `POST {url}/auth/v1/token?grant_type=password`,
  `POST {url}/auth/v1/token?grant_type=refresh_token`,
  `POST {url}/auth/v1/logout`,
  `GET {url}/auth/v1/authorize?provider=…&redirect_to=…&code_challenge=…&code_challenge_method=S256`, and
  `POST {url}/auth/v1/admin/users` with `email_confirm: true` — the **account creation** call. There is
  **no `signUpWithPassword`** (OD12): the product has no self-serve registration, so the only way an account
  comes into existence is `createUserWithPassword`, which M10's invite-acceptance route calls. That call
  authenticates with the **service-role key taken from the existing accessor**
  `supabaseServiceRoleKey()` (`src/lib/db/admin.ts:11`) — the module never names the env var itself, because
  the secret-boundary scan allows that literal in `src/lib/db/admin.ts` only. The anon key travels in the
  `apikey` header — **server-side only**; it never reaches a response body. The access token is verified
  **locally**: the header must declare `alg: "HS256"`, the HMAC-SHA256 signature is compared timing-safe
  (`node:crypto`, the same primitive the repo already uses at `src/lib/api.ts:57-58`), `exp` must be in the
  future, `aud` must contain the expected audience and `iss` must equal the expected issuer. Anything else →
  `null` (no session). No `@supabase/supabase-js`, no `@supabase/ssr`, no JWT library (OD8).
- **Tests to write.** `src/lib/auth/__tests__/supabase.test.ts` — (a) `verifyAccessToken`: one valid token
  (signed by the test with `node:crypto`) returns the subject; five negatives (alg `none`, tampered signature,
  expired, wrong audience, wrong issuer) return `null`; (b) `pkceChallenge` equals the base64url SHA-256 of the
  verifier; (c) `providerAuthorizeUrl` carries the provider, the redirect and the challenge; (d)
  `signInWithPassword` against an injected fake `fetchImpl` posts to
  `/auth/v1/token?grant_type=password` with the `apikey` header and maps the JSON body to `AuthTokens`;
  (e) `refreshSession` and `revokeSession` hit their endpoints; (f) `createUserWithPassword` posts to
  `/auth/v1/admin/users` with `email_confirm: true` and the service-role key — and **the module has no
  `signUpWithPassword` export at all** (the OD12 guard, asserted on the module's exports); (g) an upstream
  error is mapped to a named error, never a raw throw with a body.
- **Acceptance criteria covered.** AC2 (the transport half), AC4, AC5 (the account-creation half).
- **`blocked_by`.** `["M1"]` (it consumes `authEnv()`).
- **Parallel-safe.** yes.
- **Wave.** 1.
- **Implements.** OD12, OD6, OD8.

### M3 — The session cookie seam

- **Purpose.** One place that reads, writes and clears the `httpOnly` session, and owns the PKCE pair.
- **`touches:`** `src/lib/auth/session.ts` *(new)*, `src/lib/auth/__tests__/session.test.ts` *(new)*
- **Public interface.**
  ```ts
  export const SESSION_COOKIE = "auditorai.session";
  export const REFRESH_COOKIE = "auditorai.refresh";
  export const PKCE_COOKIE = "auditorai.pkce";
  export interface AuthSession {
    subject: string; email: string | null;
    accessToken: string; refreshToken: string; expiresAt: number;
  }
  export function readCookie(req: Request, name: string): string | null;
  export function readSession(req: Request): AuthSession | null;   // verifies the access token
  export function applySessionCookies(res: NextResponse, session: AuthSession): void;
  export function clearSessionCookies(res: NextResponse): void;
  export function newPkce(): { verifier: string; challenge: string };
  ```
- **The change.** The session lives in two `httpOnly` cookies (`auditorai.session` = the access token,
  `auditorai.refresh` = the refresh token), both `SameSite=Lax`, `Secure` in production, `Path=/`. The PKCE
  verifier lives in a third short-lived `httpOnly` cookie (`auditorai.pkce`, 10 minutes) and never reaches the
  browser's script. `readSession` verifies the access token with M2's `verifyAccessToken` against
  `SUPABASE_JWT_SECRET`; a missing, malformed, expired or wrongly-signed token yields `null` (the request then
  falls back to the credential actor — it is **never** an error and **never** an outage). The refresh token is
  only ever read here and sent to Supabase.
- **Tests to write.** `src/lib/auth/__tests__/session.test.ts` — the cookie flags (`HttpOnly`, `SameSite=Lax`,
  `Secure` when `NODE_ENV=production`, `Path=/`); `applySessionCookies` writes no token into the response
  **body**; `clearSessionCookies` expires both cookies; `readSession` returns `null` for a missing cookie, an
  expired token and a tampered token, and the session for a valid one; `newPkce` returns a fresh 43+ char
  verifier and its S256 challenge.
- **Acceptance criteria covered.** AC2 (the cookie half), AC4 (the negative half).
- **`blocked_by`.** `["M2"]`.
- **Parallel-safe.** yes.
- **Wave.** 2.
- **Implements.** OD6.

### M4 — The identity seam: resolution, request actor, typed errors, the repository interface

- **Purpose.** The ONE place a request's identity and its actor are produced (OD2, OD3), and the ONE place a
  typed error becomes an HTTP status.
- **`touches:`**
  - `src/lib/api.ts`
  - `src/lib/db/identity.ts`
  - `src/lib/db/errors.ts`
  - `src/lib/db/repository-factory.ts`
  - `src/lib/db/tenant-repository.ts`
  - `src/lib/auth/actor.ts` *(new)*
  - `src/lib/auth/__tests__/actor.test.ts` *(new)*
- **Public interface.**
  ```ts
  // src/lib/db/identity.ts
  export type TenantSessionIdentity { subject: string; email: string | null; }
  export type TenantResolution =
    | { mode: "postgres"; workspaceId: string; subjectId: string;
        subjectRole: MemberRole | null; sessionSubject: string | null; legacyHash: string }
    | { mode: "legacy"; legacyHash: string;
        reason: "not_configured" | "not_migrated" | "schema_not_applied" };
  export function claimsJson(subjectId: string, workspaceId: string,
    role?: MemberRole | null, email?: string | null): string;
  export async function resolveTenant(presentedCredential: string,
    session?: TenantSessionIdentity | null): Promise<TenantResolution>;

  // src/lib/api.ts
  export async function requireWorkspace(req: Request): Promise<
    { ok: true; ws: string; repo: TenantRepository; databaseStatus: DatabaseStatus;
      actor: ActorId; workspaceId: string | null } | { ok: false; res: NextResponse }>;
  export async function requireAdmin(req: Request): Promise<
    { ok: true; actor: ActorId } | { ok: false; res: NextResponse }>;

  // src/lib/auth/actor.ts
  export function actorForRequest(session: AuthSession | null, legacyHash: string): ActorId;

  // src/lib/db/errors.ts  (new classes, house style)
  export class NotSignedInError extends Error {};            // 401
  export class AuthNotConfiguredError extends Error {};       // 503
  export class ProviderNotConfiguredError extends Error {};   // 503
  export class TenantStoreRequiredError extends Error {};     // 409 (a notice, not an outage)
  export class SeatLimitExceededError extends Error {};       // 409
  export class NotWorkspaceAdminError extends Error {};       // 403
  export class NoInvitationError extends Error {};            // 401 (a plain notice, OD12)
  ```
  `src/lib/db/tenant-repository.ts`: the mutating methods gain a **trailing optional** actor —
  `saveProject(ws, project, actor?: ActorId)`, `saveAudit(ws, audit, actor?: ActorId)`,
  `saveIssue(ws, projectId, auditId, result, issuedAtIso, actor?: ActorId)`,
  `saveAttachment(ws, attachment, actor?: ActorId)`,
  `deleteAttachment(ws, projectId, id, actor?: ActorId)` (OD20-N7: a delete **is** a mutation and carries the
  actor like every other mutation), and `saveArtifactTrailFor(ws, identity, artifacts, actor?: ActorId)`.
  **Optional** is what keeps the wave green (OD15): the legacy `Repository` class still satisfies the
  interface structurally, so the interface change lands without breaking a single caller. `TenantSession`
  gains `role: MemberRole | null` and `email: string | null`.
- **The change.** `resolveTenant` keeps its current order (credential lookup → membership check) and gains one
  optional argument: the verified session. The **credential still selects the tenant** (OD3: the key channel is
  untouched); the session only identifies the person. The membership check stays on the **credential's**
  subject — unchanged, so no existing caller can start failing — and is tightened by one clause
  (`and status <> 'revoked'`, so a revoked member's next request is refused). That clause reads a `0004`
  column, which is why M7 is in an earlier wave (OD16); `0004` is **not** added to `SCHEMA_MISSING_STATES`,
  so a database without `0004` fails closed instead of silently degrading. When a session is present, a second
  lookup reads the **session subject's** membership row to obtain the role (`owner | admin | member | null`) and
  the email; that role is what the seat operations authorise, and it is DB-sourced, never asserted by the
  client. The claim document gains `role` and `email` (`claimsJson`, built from M1's `TenantClaim`), which
  `0004`'s policies read through `app_claim_role()` / `app_claim_email()`. `requireWorkspace` returns the
  request's `actor`: `userActor(session.subject)` when a valid session is present, otherwise
  `legacyActor(workspaceHash(key))` — never a constant, never a refusal (OD2, OD3). `requireAdmin` returns
  `adminActor(<16-hex digest of the presented admin key>)` (OD10). The new typed errors are mapped in the
  existing `ERROR_TABLE` (`src/lib/api.ts:146-161`): seat limit → **409**, not-a-workspace-admin → **403**,
  no-invitation → **401**, not-signed-in → 401, auth/provider not configured → 503, tenant-store required → 409.
  The seat/role write path reads **no** owner credential: it never touches `POSTGRES_URL` and never reads
  `DB_ALLOW_OWNER` (OD20-N3).
- **Tests to write.** `src/lib/auth/__tests__/actor.test.ts` — with a session: the actor is `u:<subject>`; with
  a session and a role row: the role is read from the DB row and carried in the claim; without a session: the
  actor is `legacy:<16-hex>` and `workspaceId` is `null`; `requireAdmin` returns `admin:<digest>`; the
  `ERROR_TABLE` maps each new error to its status (assert the HTTP status through `serverError`); the module's
  source contains neither `POSTGRES_URL` nor `DB_ALLOW_OWNER` (OD20-N3). The existing
  `tests/integration/tenant-store-cutover.test.ts`, `database-not-configured.test.ts`, `admin-auth.test.ts` and
  `tenant-isolation.test.ts` must stay **green unchanged**.
- **Acceptance criteria covered.** AC6 (the actor half), AC7, AC11 (the role plumbing), AC19 (the no-membership
  → 403 half), AC20.
- **`blocked_by`.** `["M1", "M3", "M7"]` (M7 lands first: the membership check reads `status`).
- **Parallel-safe.** yes — it owns `src/lib/api.ts` and `src/lib/db/identity.ts` **exclusively**; no other
  module may edit them (M8, M10, M11 consume them, they do not edit them).
- **Wave.** 3.
- **Implements.** OD2, OD3, OD5, OD15, OD16, OD18, OD20-N3.

### M5 — Actor propagation through the persistence seam (both adapters + the backfill)

- **Purpose.** Make the actor a **stored** fact on every record a mutation writes, and keep every payload
  document byte-identical.
- **`touches:`**
  - `src/lib/persistence.ts`
  - `src/lib/persistence/issue-ledger.ts`
  - `src/lib/persistence/project-store.ts`
  - `src/lib/db/tenant-store.ts`
  - `src/lib/db/migration.ts`
  - `tests/domain/actor-propagation.test.ts` *(new)*
  - `tests/domain/audit-issues.test.ts` *(existing — updated)*
  - `tests/domain/audit-workspace.test.ts` *(existing — updated)*
  - `tests/domain/persistence-contract-matrix.test.ts` *(existing — updated)*
  - `tests/domain/artifact-persistence.test.ts` *(existing — updated)*
  - `tests/domain/retention-policy.test.ts` *(existing — updated)*
  - `tests/integration/devtab.test.ts` *(existing — updated)*
  - `tests/integration/kv-to-postgres-migration.test.ts` *(existing — updated)*
- **Public interface.** The `TenantRepository` signatures are declared in M4; this module implements them:
  ```ts
  // src/lib/persistence/issue-ledger.ts
  async saveIssue(ws: string, projectId: string, auditId: string,
    result: AuditResult, issuedAtIso: string, actor?: ActorId): Promise<AuditIssue>;
  // src/lib/persistence/project-store.ts
  async saveProject(ws: string, project: Project, actor?: ActorId): Promise<void>;
  async saveAttachment(ws: string, attachment: Attachment, actor?: ActorId): Promise<void>;
  // src/lib/persistence.ts (the legacy Repository) and src/lib/db/tenant-store.ts
  // (PostgresTenantRepository) — the same optional parameter, forwarded.
  ```
  **Where the actor lives, per adapter (OD20-N8).**

  | Record | Postgres (authoritative after the cutover) | Legacy KV |
  |---|---|---|
  | the issued issue | the existing `audit_issues.issued_by` **column** | the existing `issued_by` **sibling field** of the frozen `result` |
  | the audit (draft) | the new `audits.produced_by` **column** (sibling of `audits.payload`) | **not stored** — the legacy audit document *is* the `AuditResult` (OD13 forbids a key inside it) |
  | the project | the new `projects.updated_by` **column** | the `Project.updated_by` document field |
  | the attachment | the new `attachments.uploaded_by` **column** (sibling of `attachments.payload`) | the `Attachment.uploaded_by` document field |
- **The change.** The actor is written **only** to columns/fields that sit **beside** a payload document, never
  inside one (OD13): `payload` is byte-identical whether or not an actor is present. The legacy adapter writes
  `issued_by` on the issue, `updated_by` on the project and `uploaded_by` on the attachment; the Postgres adapter
  writes the four actor columns. Both adapters take the **same optional parameter** (OD20-N8) and, when it is
  absent, **derive** `legacyActor(ws)` — `ws` is the 16-hex workspace hash on both paths
  (`src/lib/api.ts:89`), so the derived actor is `legacy:<16-hex>`, never a constant (OD15). When an actor *is*
  supplied, the write site calls `assertWritableActor` — the constant `"auditor"` is a read value only
  (OD20-N5). The KV→Postgres backfill stops writing the constant: it **overrides** the stored `"auditor"` with
  `legacy:<workspaceHash>` (the repo's existing `legacySubjectFor` convention, `src/lib/db/migration.ts:136`)
  and **preserves every other stored value**; **no backfill rewrites a historical `issued_by` that already
  carries a non-constant actor** (OD20-N4). The audit actor is not stored on the legacy path — the asymmetry is
  deliberate and is recorded in the ADR (OD13).
- **Tests to write.** `tests/domain/actor-propagation.test.ts` — the legacy and the Postgres adapter both
  persist the actor on the issue, the project and the attachment (the audit on the Postgres path only);
  **no write path emits `"auditor"`** (assert `isWrittenActor` on every written value, assert `assertWritableActor`
  throws for the constant, and grep the adapters for the literal); the frozen `result` payload is
  **byte-identical with and without the actor** (OD13); a pre-#54 lineage (`issued_by: "auditor"`) exports and
  restores as `{restored: 0, skipped: N}` and a mutated copy raises `IssueRevisionConflictError` (AC9); a second
  issuance raises the conflict and never rewrites revision *N*; the outcome sink (`tests/setup.ts:16-18`)
  records no write (AC10); the backfill writes `legacy:<hash>` and preserves a non-constant stored value
  (OD20-N4). The updated existing suites keep their assertions and add the actor argument.
- **Acceptance criteria covered.** AC6, AC7, AC8, AC9, AC10.
- **`blocked_by`.** `["M1", "M4", "M7"]` (the Postgres adapter writes the three `0004` actor columns).
- **Parallel-safe.** yes.
- **Wave.** 4.
- **Implements.** OD2, OD13, OD20-N4, OD20-N8.

### M6 — The mutation call sites pass the actor

- **Purpose.** The tenant mutations hand the actor to the seam. No behaviour beyond the actor.
- **`touches:`**
  - `src/app/api/projects/route.ts`
  - `src/app/api/projects/[projectId]/route.ts`
  - `src/app/api/projects/[projectId]/audits/route.ts`
  - `src/app/api/projects/[projectId]/audits/[auditId]/route.ts`
  - `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts`
  - `src/app/api/projects/[projectId]/attachments/[attachmentId]/route.ts`
  - `src/app/api/upload/route.ts`
  - `tests/integration/actor-routes.test.ts` *(new)*
  - `tests/integration/candidate-review-route.test.ts` *(existing — updated)*
- **Public interface.** No new exports. Each handler passes `auth.actor` into the repository call, e.g.
  `await auth.repo.saveProject(auth.ws, outcome.value, auth.actor);`. The one-store-per-request invariant of
  `src/app/api/upload/route.ts:19-21` survives.
- **The change.** Seven one-line edits plus the `auth.actor` field that M4 added. The delete route passes the
  actor too (OD20-N7) — it leaves no record, so nothing persists it (the tombstone is #55's trail, out of
  scope); the actor's *carriage* is the requirement and it is the same interface in both adapters. The
  browser-asserted `EvidenceOverride.auditor_pseudonym` keeps its current meaning and is **not** replaced by
  the actor (OD2: the resulting two-attribution ambiguity is documented in the ADR and deferred to a follow-up
  ticket — the plan does not resolve it silently).
- **Tests to write.** `tests/integration/actor-routes.test.ts` — for each of the **six write routes**: the call
  succeeds and the persisted record carries `auth.actor`; with a session cookie the actor is `u:<uuid>`, without
  one it is `legacy:<16-hex>`; for the **seventh route (the delete)**: the call still answers 200 and the rows
  are gone — there is no record left to assert an actor on, so the assertion is the 200 and the unchanged
  remaining rows (OD20-N7); the legacy path (no `TENANT_STORE`) still answers exactly as before (AC20); no route
  answers 401/403 because an actor is missing (OD3: the legacy path never refuses a mutation for want of an
  actor id).
- **Acceptance criteria covered.** AC6, AC20.
- **`blocked_by`.** `["M5"]`.
- **Parallel-safe.** yes.
- **Wave.** 5.
- **Implements.** OD2, OD20-N7.

### M7 — The migration `0004` (seats, membership state, RLS hardening) and the operator procedure

- **Purpose.** The one new schema file, the three RLS holes of OD5, the role/privilege shape of OD14/OD19, and
  the operator's procedure.
- **`touches:`**
  - `supabase/migrations/0004_seats_invites.sql` *(new)*
  - `supabase/README.md`
  - `tests/integration/migration-0004.test.ts` *(new)*
  - `tests/integration/tenant-rls.test.ts` *(existing — updated: it enumerates the applied migrations)
- **Public interface.** SQL only — no TypeScript export. The full DDL is in *Data model and migration* below;
  **it is text in this plan and is never applied by an agent** (`supabase/README.md:8-9`).
- **The change.** One file, applied by the operator after `0001 → 0002 → 0003`: `workspaces.seat_count`; the
  membership state columns (`status`, `email`, `invited_by`, `expires_at`, `accepted_at`, `revoked_at`); the
  role and status vocabulary constraints; the three actor columns (`projects.updated_by`, `audits.produced_by`,
  `attachments.uploaded_by`); two claim helpers (`app_claim_role()`, `app_claim_email()`) that reference no
  table (the design rule of `0002`); the column-level privilege revokes (the app role may **read**
  `seat_count` and may **never write** it, and may **never update** `workspace_members.role`); and the four
  `workspace_members` policies. `supabase/README.md` gains the file row, the apply step, the seat-allowance
  provisioning, the **first-owner** provisioning (OD18), the first-credential bootstrap and the re-run note.
  **OD17**: this module owns `tests/integration/tenant-rls.test.ts` — the only suite that asserts the applied
  migration list (`tests/integration/tenant-rls.test.ts:166-171`) — and updates that list to include
  `0004_seats_invites.sql`. The other suites that apply every `*.sql` from disk
  (`tests/domain/persistence-contract-matrix.test.ts:186`, `tests/integration/kv-to-postgres-migration.test.ts:54`,
  `tests/integration/database-not-configured.test.ts:48`, `tests/integration/tenant-isolation.test.ts:55`)
  assert **no** file list and stay green unchanged — `0004` is written so that they do (the backfill's
  membership insert is the claim subject with `role='member'`, which the new insert policy admits; nothing in
  the app UPDATEs `public.workspaces`, which the new column-level revoke touches; the widened select policy
  cannot leak because the isolation fixture's claim carries no `email`).
- **Tests to write.** `tests/integration/migration-0004.test.ts` (pglite) — the file applies cleanly after
  `0001 → 0002 → 0003`; applying it a **second** time raises nothing and leaves the same schema and the same
  policies (AC24); `workspaces.seat_count` exists with the default `1`; `workspace_members` carries `status`,
  `email`, `invited_by`, `expires_at`, `accepted_at`, `revoked_at` and the role/status vocabulary constraints;
  `projects.updated_by`, `audits.produced_by` and `attachments.uploaded_by` exist; the two claim helpers exist
  and reference no table; **the privilege shape** (OD19): `has_column_privilege('auditorai_app',
  'public.workspaces','seat_count','UPDATE')` is false, the same for `INSERT`, and
  `has_column_privilege('auditorai_app','public.workspace_members','role','UPDATE')` is false (a non-vacuous
  assertion — it does not rely on a superuser write attempt); the policies exist with the expected shape.
  `tests/integration/tenant-rls.test.ts` — the expected migration list becomes
  `["0001_tenant_schema.sql","0002_rls_policies.sql","0003_roles.sql","0004_seats_invites.sql"]` and every
  existing isolation assertion still holds.
- **Acceptance criteria covered.** AC11 (the column half), AC16, AC17 (the policy half), AC18 (the policy
  half), AC19 (the operator half), AC24.
- **`blocked_by`.** `["M1"]` — the migration's claim helpers read the `role` and `email` claim fields that M1's
  `src/lib/db/claim.ts` fixes, so the two cannot drift.
- **Parallel-safe.** yes.
- **Wave.** 1.
- **Implements.** OD5, OD14, OD16, OD17, OD18, OD19.

### M8 — The seat and invitation service

- **Purpose.** The seat arithmetic, the invite write, the acceptance and the member listing — one service, one
  place.
- **`touches:`** `src/lib/db/seats.ts` *(new)*, `tests/integration/seat-invite.test.ts` *(new)*
- **Public interface.**
  ```ts
  /** The invitation TTL, in days (OD20-N1). Named, exported, asserted by a test. */
  export const INVITE_TTL_DAYS = 14;

  export interface SeatContext {
    workspaceId: string; subjectId: string;
    role: MemberRole | null; email: string | null;
  }
  export interface SeatMember { subjectId: string; role: MemberRole; status: string; email: string | null; }
  export interface SeatSummary {
    workspaceId: string; seatCount: number; usedSeats: number;
    members: SeatMember[]; pendingInvites: { email: string; role: string; expiresAt: string | null }[];
  }
  export interface InviteResult { workspaceId: string; email: string; role: MemberRole; expiresAt: string; }
  /** The seat arithmetic (OD4 + OD20-N9): accepted members + pending UNEXPIRED
   *  invitations. A revoked member holds no seat. */
  export function seatsUsed(activeCount: number, pendingCount: number): number;
  export function canInvite(activeCount: number, pendingCount: number, seatCount: number): boolean;
  export async function seatSummary(client: SqlClient, ctx: SeatContext): Promise<SeatSummary>;
  export async function createInvite(client: SqlClient, ctx: SeatContext,
    email: string, role?: MemberRole): Promise<InviteResult>;   // throws SeatLimitExceededError / NotWorkspaceAdminError
  export async function acceptPendingInvite(client: SqlClient,
    subject: string, email: string): Promise<{ workspaceId: string } | null>;
  export async function findMembershipByEmail(client: SqlClient,
    email: string): Promise<{ workspaceId: string; status: string; role: MemberRole } | null>;
  ```
- **The change.** A seat = an **accepted member** + a **pending, unexpired invitation** (OD4). The count is
  `members(status='active') + members(status='pending' and expires_at > now())` — the filter lives **in the
  service**, not in the caller (OD20-N9): a `revoked` member holds **no** seat, and an expired pending
  invitation holds none. The limit is `workspaces.seat_count` (the app **reads** it; it never writes it —
  OD19). The check and the insert happen in **one transaction** (the `SqlClient` seam,
  `src/lib/db/sql.ts:11-14`, the role preamble at `:44-47`), so two concurrent invites cannot exceed the limit.
  A pending invitation is a `workspace_members` row with `status='pending'`,
  `subject_id = pendingSubjectFor(email)`, `role = 'member' | 'admin'` (**never** `owner` — OD14), `email`, the
  inviting actor in `invited_by`, and `expires_at = now() + INTERVAL '14 days'` (the exported
  `INVITE_TTL_DAYS`, OD20-N1). The deterministic placeholder makes a re-invite an **update of the same row**
  (no second seat). The inviter must be an `owner` or an `admin`; an `admin` may grant `member` only, an
  `owner` may grant `member` or `admin` (OD14 — the role is assigned **here, at invite time**, and the policy
  enforces it again in the database). `acceptPendingInvite` binds the pending row to the signed-in subject
  (`subject_id = <uuid>`, `status='active'`, `accepted_at = now()`, `expires_at = null`) — the row moves from
  "pending seat" to "active member", so the seat is counted once, and **the role is not written** (the app role
  cannot write it). **There is no `ensureWorkspaceForSubject`** (OD18): the app never creates a workspace and
  never creates an owner. Both the member list and the count are filtered by the caller's `workspace_id`
  (OD20-N2), so a member never sees another workspace's member rows; the only cross-workspace row a caller may
  see is its own pending invitation (the policy's email clause).
- **Tests to write.** `tests/integration/seat-invite.test.ts` (pglite) — the seat arithmetic (`seatsUsed`,
  `canInvite` at the boundary: `active+pending == seatCount` is refused, `== seatCount - 1` is allowed); with
  `seat_count = 2`: two invites succeed, the third raises `SeatLimitExceededError`; a plain member's invite
  raises `NotWorkspaceAdminError`; an admin inviter may grant `member` but **not** `admin`, an owner inviter may
  grant either, and **no** inviter can grant `owner` (OD14); the admin's insert of a member row for another
  subject succeeds under the owner/admin claim and raises under the member claim (AC18); **a member's own
  UPDATE cannot change `role`** and a member who self-promoted still cannot insert (the escalation proof the
  critique asked for); a member reads their own workspace's member list and **cannot read another workspace's**
  (AC17, OD20-N2); the app role holds **no** UPDATE/INSERT privilege on `workspaces.seat_count` (the privilege
  shape, AC16) while the operator's statement succeeds and updates exactly one row (the rows-updated
  assertion); an expired pending invitation consumes no seat and cannot be accepted; the acceptance binds the
  subject and the count does not double-count (AC14); **a revoked member consumes no seat** (OD20-N9); the
  pending row's `expires_at` equals `now() + INVITE_TTL_DAYS` exactly (OD20-N1, AC15); **a subject with no
  membership row and no invitation gets no workspace row and no owner row** (OD18, AC19); the file applied
  twice is a no-op (AC24).
- **Acceptance criteria covered.** AC11, AC12, AC13, AC14, AC15, AC16, AC17, AC18, AC19.
- **`blocked_by`.** `["M1", "M4", "M7"]`.
- **Parallel-safe.** yes.
- **Wave.** 4.
- **Implements.** OD4, OD18, OD20-N1, OD20-N2, OD20-N9.

### M9 — The sign-in surface (routes + page)

- **Purpose.** The server-mediated sign-in, the session lifecycle endpoints and the one page that offers them.
  **Sign-in only** — no sign-up (OD12): the email route is *invite-gated*.
- **`touches:`**
  - `src/app/api/auth/config/route.ts` *(new)*
  - `src/app/api/auth/email/route.ts` *(new)*
  - `src/app/api/auth/signin/[provider]/route.ts` *(new)*
  - `src/app/api/auth/callback/route.ts` *(new)*
  - `src/app/api/auth/signout/route.ts` *(new)*
  - `src/app/api/auth/me/route.ts` *(new)*
  - `src/app/sign-in/page.tsx` *(new)*
  - `src/app/_components/sign-in-form.tsx` *(new)*
  - `src/app/_components/ui/app-shell.tsx`
  - `tests/integration/auth-routes.test.ts` *(new)*
  - *(no `next.config.ts` — N6)*
- **Public interface.**
  | Route | Answer |
  |---|---|
  | `GET /api/auth/config` | `200 { configured: boolean; providers: ("email"\|"google"\|"microsoft")[] }` — booleans only, no secret, no token, no Supabase URL. |
  | `POST /api/auth/email` | body `{ email, password }` → `200 { user: { subject, email } }` + the session cookies; `401` + the plain notice when the email has **no invitation** (OD12); `401` on a wrong password; `409` when the tenant store is not live (a plain notice, not an outage); `503` when sign-in is not configured. |
  | `GET /api/auth/signin/[provider]` | `302` to the Supabase authorize URL + the PKCE cookie; `503` `ProviderNotConfiguredError` when the provider (or the redirect origin) is absent. |
  | `GET /api/auth/callback` | `?code=…` → exchange → cookies → bind the pending invitation → `302 /projects`. |
  | `POST /api/auth/signout` | revokes the refresh token at Supabase, clears the cookies, `204`. |
  | `GET /api/auth/me` | `200 { subject, email }` or `200 { subject: null }`. |
- **The change.** Six route handlers and one page. The browser never receives the Supabase URL, the anon key or
  a token: it reads booleans from `/api/auth/config`, posts credentials to `/api/auth/email`, and follows a
  redirect for the OAuth providers. **The email route is invite-gated (OD12)**: before it talks to Supabase it
  looks the email up through M8's `findMembershipByEmail` — no membership row → the plain notice
  "no invitation for this email" (`NoInvitationError`, 401) and **nothing is created**; a `pending` invitation →
  the plain notice "your invitation is pending — accept it to set up your account"; an `active` membership →
  the Supabase password grant. There is **no `action:"signup"` field** and no other way in. (The email route
  needs the tenant store, because the invitation *is* the gate: without it the route answers the plain
  "sign-in requires the tenant store" notice — `TenantStoreRequiredError`, 409 — and the rest of the product is
  untouched. Production behaviour while `TENANT_STORE` is unset is unchanged, because the sign-in surface is new
  and simply reports a notice — OD3.) The OAuth redirect is built server-side (the origin comes from
  `SUPABASE_AUTH_REDIRECT_ORIGIN`, never from the `Host` header), the PKCE verifier stays in an `httpOnly`
  cookie, and the callback exchanges the code server-side. When the auth env is absent, `/api/auth/config`
  answers `{configured:false, providers:[]}` and the page renders the plain notice from
  `src/lib/auth/notice.ts` through the existing `InlineNotice` component — no error, no redirect loop, and the
  rest of the product is untouched (OD11). The app shell gains one `Sign in` link (pointing at `/sign-in`) in
  the existing header nav — a single `next/link`, no new component, no layout change. `GET /api/auth/me` is an
  **added public endpoint** (not in the ticket body): it exists so the operator can learn a user's uuid for the
  out-of-band owner provisioning (OD18); it returns nothing but the subject and the email.
- **Tests to write.** `tests/integration/auth-routes.test.ts` — `/api/auth/config` in each env state
  (absent / email only / email+google / google without the redirect origin); `/api/auth/email` against an
  injected fake Auth server → `200` + `Set-Cookie` `HttpOnly` + **no token in the body**; **an email with no
  invitation → `401` + the plain "no invitation for this email" notice and no call to the Auth server**
  (OD12); an email with a pending invitation → the plain pending notice; a wrong password → `401`; sign-in not
  configured → `503` + the notice text; the tenant store not live → `409` + the plain notice;
  `/api/auth/signin/google` → `302` with the PKCE challenge and the verifier only in the cookie; an
  unconfigured provider → `503` + the notice text; `/api/auth/callback` with a fake code → `302` + cookies;
  `/api/auth/signout` → the fake server received the revoke call and the cookies are cleared; `/api/auth/me` →
  `{subject:null}` without a session; **the route module exposes no sign-up path** (no `signup` branch and no
  call to a signup endpoint — asserted on the source).
- **Acceptance criteria covered.** AC1, AC2, AC3, AC4, AC5.
- **`blocked_by`.** `["M2", "M3", "M8"]` (the email route is invite-gated through M8's lookup; the callback
  binds the pending invitation).
- **Parallel-safe.** yes.
- **Wave.** 5.
- **Implements.** OD6, OD9, OD11, OD12.

### M10 — The team surface (the invite API, the invite list, invite acceptance — where account creation lives)

- **Purpose.** Where a seat count is actually enforced and seen, and the **only** place an account is created.
- **`touches:`**
  - `src/app/api/workspaces/team/route.ts` *(new)*
  - `src/app/api/workspaces/team/accept/route.ts` *(new)*
  - `src/app/team/page.tsx` *(new)*
  - `src/app/_components/team-panel.tsx` *(new)*
  - `tests/integration/team-routes.test.ts` *(new)*
- **Public interface.**
  | Route | Answer |
  |---|---|
  | `GET /api/workspaces/team` | `200 { team: SeatSummary \| null; database_status: DatabaseStatus }` — `team: null` + the plain notice when the tenant store is not live. |
  | `POST /api/workspaces/team` | body `{ email, role?: "member" \| "admin" }` → `201 { invite }`; `409` `SeatLimitExceededError`; `403` `NotWorkspaceAdminError`; `409` `TenantStoreRequiredError` on the legacy path. |
  | `POST /api/workspaces/team/accept` | body `{ email, password }` → `200 { accepted: [{ workspaceId }] }` — **creates the account** (Admin API, `email_confirm: true`), binds the pending invitation and signs the invitee in; `401` + the plain notice when there is no pending invitation; `409` `SeatLimitExceededError`/`TenantStoreRequiredError`. |
- **The change.** Two route handlers over M8's service. The GET renders the allowance, the used seats, the
  member list and the pending invitations. The POST is **the invite surface where the seat count is enforced**
  — the only place the limit is checked (OD4) — and the only place a role is assigned (OD14: the inviter picks
  `member` or `admin`; `owner` is never offered and never accepted by the server). The **accept** route is the
  account-creation path (OD12): it proves a **pending, unexpired invitation exists for that email** (M8),
  creates the user through M2's `createUserWithPassword` (the Auth Admin API with `email_confirm: true`, using
  the existing service-role accessor), activates the membership row (M8's `acceptPendingInvite` — the role is
  preserved, never written) and signs the invitee in (M3's session cookies). If the account already exists, the
  route signs the existing user in instead of creating a second one. The team page reads the same endpoint and
  renders the plain "seats require the tenant store" notice when the tenant store is not live (OD11, state 3) —
  a notice, not an outage. The page and the panel are server components that fetch the endpoint; they hold no
  token and no Supabase credential.
- **Tests to write.** `tests/integration/team-routes.test.ts` — with the tenant store off: `GET` → `200` with
  `team: null` and the legacy `database_status`; `POST` → `409` with the plain message; with the tenant store
  on (pglite): `GET` → the allowance, the used seats and the member list; `POST` as an owner → `201`; `POST` at
  the limit → `409`; `POST` as a plain member → `403`; `POST` with `role:"admin"` as an owner → `201` and the
  invited role is `admin`; `POST` with `role:"owner"` → refused (the app never grants `owner`); `POST /accept`
  for an email with **no** invitation → `401` + the plain notice and **no account created** (OD12);
  `POST /accept` for a pending invitation → the account is created through the Admin API (the fake Auth server
  received `POST /auth/v1/admin/users` with `email_confirm: true`), the invitation is accepted, the seat count
  is unchanged and the session cookies are set.
- **Acceptance criteria covered.** AC5, AC11, AC12, AC13, AC14.
- **`blocked_by`.** `["M2", "M8", "M9"]`.
- **Parallel-safe.** yes.
- **Wave.** 6.
- **Implements.** OD4, OD12, OD14.

### M11 — The credential lifecycle surface

- **Purpose.** Server-side issuance, rotation and revocation — G-5's "issued and stored server-side; a rotation
  path exists and has been exercised; a revocation path exists and takes effect without data loss".
- **`touches:`**
  - `src/lib/db/credentials.ts`
  - `src/app/api/workspaces/credentials/route.ts` *(new)*
  - `src/lib/client.ts`
  - `tests/integration/credential-lifecycle.test.ts` *(new)*
- **Public interface.**
  ```ts
  // src/lib/db/credentials.ts
  export function generateCredentialValue(): string;                 // two UUIDs, the shape the browser used
  export async function issueCredential(workspaceId: string, subjectId: string,
    credentialValue: string): Promise<CredentialRecord>;
  // src/lib/client.ts
  export function setWorkspaceKey(key: string): void;                 // stores a server-issued key
  ```
  `POST /api/workspaces/credentials` — body `{ action: "rotate" | "revoke" }` → `200 { credential }` (the
  value is returned **once**) or `200 { revoked: true }`; `409` `TenantStoreRequiredError` on the legacy path.
  **There is no `issue` action** (the critique's scope check): the operator's first credential is provisioned
  out of band (the SQL in *Data model and migration*).
- **The change.** The credential **value** is now generated server-side (`generateCredentialValue`) and the
  browser only stores it (`setWorkspaceKey`) — it no longer mints the replacement, which is G-5's cited evidence
  (`src/lib/client.ts:19-26`). The existing registry semantics are reused **unchanged**:
  `revokeCredential` sets `revoked_at` and never deletes a row (`src/lib/db/credentials.ts:62-88`);
  `rotateCredential` marks the old row `revoked_at` **and** `rotated_at` and writes a new one (`:92-165`) —
  rotation is total, with no overlap window. `issueCredential` inserts a new row for a workspace + subject with
  the credential GUC set to the new hash (the policy is keyed on the presented hash, so the insert is visible
  to itself — the same trick `rotateCredential` uses at `:145`). **Rotation and issuance are refused on the
  legacy path**: the key's hash *is* the KV namespace (`src/lib/persistence/keys.ts:5-43`), so replacing it
  would orphan the workspace's data. That refusal is a named state, not an error.
- **Tests to write.** `tests/integration/credential-lifecycle.test.ts` (pglite + route) — rotate → the old
  credential is refused on the next request (`401`), the new one works, and every workspace row is still there
  (no data loss); revoke → `401` and the rows are still there; the rotated value is returned exactly once and
  is never stored in plaintext; on the legacy path → `409` + the plain message and the old key still works.
- **Acceptance criteria covered.** AC21.
- **`blocked_by`.** `["M4"]`.
- **Parallel-safe.** yes.
- **Wave.** 4.
- **Implements.** OD3 (the legacy path's refusal is part of "production behaviour unchanged").

### M12 — The env surface and the records that must stop contradicting the code

- **Purpose.** Declare the env names once, and bring the repo's own records in line with the shipped code
  (G-5's last clause, OD1).
- **`touches:`**
  - `.env.example`
  - `CONTEXT.md`
  - `docs/glossary.md`
  - `docs/validation/security-review.md`
  - `docs/adr/0020-named-user-identity-and-seats.md` *(new)*
  - `docs/adr/README.md`
  - `tests/integration/env-surface.test.ts` *(new)*
  - `tests/integration/security-record.test.ts` *(new)*
- **Public interface.** No code. The env names are listed in *Env surface* below; the ADR is
  `docs/adr/0020-named-user-identity-and-seats.md` (the next free number: `0019` is taken).
- **The change.** `.env.example` gains the new names with a comment each (the five auth names; the service-role
  key and the JWT secret are **already** there). `docs/validation/security-review.md:11` (the access model),
  `:17` ("Anonymous workspaces, no accounts/PII; demo data only") and `:19` (the deployment gate) are corrected
  to describe the named-user model — the gate judgement itself is the **operator's**, not the implementer's, so
  the line is re-worded to state the condition, not to widen the permission. `CONTEXT.md` and `docs/glossary.md`
  gain the new vocabulary (actor id, seat, invitation) and, per **OD1**, state that **G-2 is satisfied on the
  Postgres path and remains open on the legacy path** — *no document may claim G-2 is closed*. The new ADR
  records: the identity model; the actor vocabulary (OD2) and the deferred `auditor_pseudonym` ambiguity; the
  seat model and the seat-count semantics (OD4); **`INVITE_TTL_DAYS = 14`** (OD20-N1); the invite-only
  account creation (OD12) and the role-at-invite rule (OD14); the operator's provisioning steps — the seat
  allowance, the first owner, the first credential (OD18, OD19) — and the fact that the seat/role write path
  never uses owner credentials and that `DB_ALLOW_OWNER=1` voids the allowance (OD20-N3); and that **no backfill
  rewrites a historical `issued_by`** (OD20-N4).
- **Tests to write.** `tests/integration/env-surface.test.ts` — every env name read by
  `src/lib/auth/config.ts` appears in `.env.example`; **no** `NEXT_PUBLIC_SUPABASE_*` name other than the three
  allowed exists anywhere in the repo (the existing `tests/integration/secret-boundary.test.ts` also enforces
  this and must stay green). `tests/integration/security-record.test.ts` — the security record no longer claims
  "Anonymous workspaces, no accounts/PII" nor "Bearer-style `x-workspace-key`" as the access model; and a
  **repo-wide** assertion over `CONTEXT.md`, `docs/glossary.md`, `docs/validation/security-review.md` and
  `docs/adr/**` that **no document claims G-2 is closed** (the critique's verification gap 6).
- **Acceptance criteria covered.** AC22, AC23.
- **`blocked_by`.** `["M4", "M7"]`.
- **Parallel-safe.** yes — it lands last for content, not for safety.
- **Wave.** 7.
- **Implements.** OD1, OD9, OD12, OD19, OD20-N1, OD20-N3, OD20-N4.

---

## Critique resolutions

Every OD12..OD20 (the orchestrator's resolution of the critique) mapped to the module(s) that implement it and
the test(s) that prove it. **Nothing here is left implicit.**

| OD | Resolves | Implemented by | Proven by |
|---|---|---|---|
| **OD12** | B1 — no public sign-up; accounts are created only by accepting an invitation | **M2** (`createUserWithPassword` via the Auth Admin API with `email_confirm: true`; **no** `signUpWithPassword`), **M9** (`POST /api/auth/email` takes `{email, password}` only; the invite gate returns the plain "no invitation for this email" notice; the route has no signup branch), **M10** (`POST /api/workspaces/team/accept` — the account-creation path), **M12** (the ADR records the rule) | `src/lib/auth/__tests__/supabase.test.ts` (the Admin-API call; the module has no signup export), `tests/integration/auth-routes.test.ts` (no invitation → plain notice, nothing created; no signup branch in the source), `tests/integration/team-routes.test.ts` (accept → the account is created through the Admin API; no invitation → nothing created) |
| **OD13** | B2 — the actor id never enters the frozen payload | **M1** (no `AuditResult.produced_by`; the actor columns are separate), **M5** (`audits.produced_by` / `attachments.uploaded_by` / `projects.updated_by` are **columns**; `payload` stays byte-identical), **M7** (the three columns in `0004`) | `tests/domain/actor-propagation.test.ts` (the frozen `result` payload is byte-identical with and without an actor; the restore byte-compare still passes), `tests/integration/migration-0004.test.ts` (the three columns exist) |
| **OD14** | B3 — the role is assigned at invite time; there is no role-change surface | **M7** (the insert policy grants `admin` only to an `owner` claim, `member` otherwise, never `owner`; the app role gets **no UPDATE privilege** on `workspace_members.role`; no UPDATE policy can change a role), **M8** (`createInvite` takes the role and never writes one afterwards; `acceptPendingInvite` writes no role), **M10** (the invite body offers `member`/`admin` only) | `tests/integration/seat-invite.test.ts` (an admin inviter cannot grant `admin`; an owner can; nobody can grant `owner`; **a member's own UPDATE cannot change `role`**; a self-promoted member still cannot insert), `tests/integration/migration-0004.test.ts` (the privilege shape: no UPDATE privilege on `role`) |
| **OD15** | B4 — every wave must leave the repo green | **M1** (`issued_by` widened in the same module that introduces the actor type), **M4** (`actor?: ActorId` — **optional** on the interface; the legacy class still satisfies it), **M5** (the adapters derive `legacyActor(ws)` when the actor is absent — never a constant, never a required argument) | the per-wave gate in *Verification* (`npm run lint && npm run typecheck && npm run test` at the end of every wave), `src/lib/auth/__tests__/actor.test.ts` (the derived actor is `legacy:<16-hex>`) |
| **OD16** | B5 — the migration lands before any code that reads its columns | **M7** (wave 1), **M4** (wave 3), **M5**/**M8**/**M11** (wave 4) — the wave table; **M4** does not add `42703` to `SCHEMA_MISSING_STATES`, so a missing `0004` fails closed instead of degrading | the wave order in the work order (every `blocked_by` edge points at an earlier wave), `tests/integration/migration-0004.test.ts` (the columns exist), `src/lib/auth/__tests__/actor.test.ts` |
| **OD17** | B6 — the migration module owns the migration-enumerating tests | **M7** owns `tests/integration/tenant-rls.test.ts` (the only suite that asserts the applied migration list, `tests/integration/tenant-rls.test.ts:166-171`) | `tests/integration/tenant-rls.test.ts` — the expected list now names `0004_seats_invites.sql` and every isolation assertion still holds |
| **OD18** | B7 — one owner of the first-workspace-owner question | **M7** (the operator's out-of-band first-owner SQL in `supabase/README.md`), **M8** (**no** `ensureWorkspaceForSubject`; the app never creates a workspace or an owner), **M9** (a subject with no membership row gets the plain notice / 403) | `tests/integration/seat-invite.test.ts` (a subject with no membership row and no invitation gets **no** workspace row and **no** owner row), `tests/integration/team-routes.test.ts` |
| **OD19** | B8 — `seat_count` is written only by the operator, out of band | **M7** (`revoke update`/`revoke insert` on `public.workspaces` + the column-level grants; the operator's SQL), **M8** (the service only **reads** `seat_count`), **M12** (the ADR records the operator step and the `DB_ALLOW_OWNER=1` caveat) | `tests/integration/seat-invite.test.ts` (the **privilege shape**: `has_column_privilege('auditorai_app','public.workspaces','seat_count','UPDATE')` is false — not a superuser write attempt; the operator's statement succeeds and updates exactly one row), `tests/integration/migration-0004.test.ts` |
| **OD20-N1** | the invite TTL is a named, documented, tested constant | **M8** (`export const INVITE_TTL_DAYS = 14;` in `src/lib/db/seats.ts`), **M12** (the ADR names it) | `tests/integration/seat-invite.test.ts` (the pending row's `expires_at` equals `now() + INVITE_TTL_DAYS`; an invite past the TTL consumes no seat) |
| **OD20-N2** | the member list is filtered by the caller's `workspace_id` | **M8** (both the count and the list are narrowed by `workspace_id` in the service), **M7** (the select policy exposes only the caller's own **pending** invitation outside its workspace) | `tests/integration/seat-invite.test.ts` (two workspaces, two claims, two different row sets) |
| **OD20-N3** | the seat/role write path never uses the owner credentials | **M4** (the seat/role path reads no `POSTGRES_URL` and no `DB_ALLOW_OWNER`), **M8** (the service runs under the `auditorai_app` role only), **M12** (the ADR states it) | `src/lib/auth/__tests__/actor.test.ts` (the identity module's source names neither `POSTGRES_URL` nor `DB_ALLOW_OWNER`) |
| **OD20-N4** | no backfill rewrites a historical `issued_by` | **M5** (the backfill overrides the stored `"auditor"` with `legacy:<hash>` and **preserves every other stored value**) | `tests/domain/actor-propagation.test.ts` (a row with a non-constant stored `issued_by` keeps it after the backfill) |
| **OD20-N5** | the read type accepts the legacy literal; the write path is guarded at runtime | **M1** (`AuditActor` = the read union; `ActorId` = the write union; `assertWritableActor`), **M5** (the guard runs at every write site) | `tests/domain/actor-id.test.ts` (`assertWritableActor("auditor")` throws), `tests/domain/actor-propagation.test.ts` (no write path emits the constant) |
| **OD20-N6** | drop `next.config.ts` | **M9** no longer touches it (the v1 entry is deleted) | the M9 `touches:` list in the work order (no `next.config.ts`) |
| **OD20-N7** | a delete **is** a mutation and carries the actor | **M4** (`deleteAttachment(ws, projectId, id, actor?: ActorId)`), **M6** (the delete route passes `auth.actor`) | `tests/integration/actor-routes.test.ts` (the delete answers 200 and the remaining rows are unchanged — there is no record left to assert an actor on; the tombstone is #55's) |
| **OD20-N8** | one interface, both adapters, the same parameter | **M5** (the same optional `actor?: ActorId` in the legacy `Repository` and in `PostgresTenantRepository`; the per-adapter storage location is stated in M5's table) | `tests/domain/persistence-contract-matrix.test.ts` (the matrix asserts the actor location per adapter), `tests/domain/actor-propagation.test.ts` |
| **OD20-N9** | a revoked member does not consume a seat | **M7** (the `status` column), **M8** (the count filter lives in the service: `status='active'` + unexpired `status='pending'`) | `tests/integration/seat-invite.test.ts` (a revoked member holds no seat; the count drops) |

---

## Data model and migration

**One new migration:** `supabase/migrations/0004_seats_invites.sql`. It is **text in this plan**; the operator
applies it by hand, in order, after `0001 → 0002 → 0003` (`supabase/README.md:8-9`, `:19-21`). No agent ever
applies it.

### The DDL (exact)

```sql
-- AuditorAI tenant store, ticket #54 — seats, membership state, actor columns
-- and the RLS hardening of the three holes in 0002_rls_policies.sql.
--
-- Apply AFTER 0001 -> 0002 -> 0003. The operator applies this file by hand;
-- no agent ever applies it (supabase/README.md:8-9).
--
-- Re-runnable: every statement is idempotent (add column if not exists,
-- drop policy if exists + create policy, create or replace function), exactly
-- like 0002. A partial apply is repaired by running the file again.

-- ---------- 1. the seat allowance ----------
-- The allowance is the entitlement the OPERATOR provisions; the app enforces
-- it at the invite and may only READ it (OD19).
alter table public.workspaces
  add column if not exists seat_count integer not null default 1;

-- 1b. RLS HOLE 1 (OD5.1) + OD19: the app role may READ seat_count and may
-- never WRITE it. A table-level grant overrides a column-level revoke, so the
-- table grants are revoked first and only the columns the app needs are given
-- back. The OPERATOR (the platform's privileged owner role) keeps full
-- UPDATE/INSERT and provisions the allowance out of band.
revoke update on public.workspaces from auditorai_app;
grant  update (name, region) on public.workspaces to auditorai_app;
revoke insert on public.workspaces from auditorai_app;
grant  insert (id, name, region, legacy_key_hash) on public.workspaces to auditorai_app;

-- ---------- 2. membership state ----------
-- status: 'active'   = an accepted member (holds a seat)
--         'pending'  = an invitation (holds a seat until expires_at)
--         'revoked'  = the member's access ended (the seat is free again)
-- The primary key (workspace_id, subject_id) is UNCHANGED.
alter table public.workspace_members
  add column if not exists status      text        not null default 'active',
  add column if not exists email       text,
  add column if not exists invited_by  text,
  add column if not exists expires_at  timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists revoked_at  timestamptz;

-- 2b. the role vocabulary (OD14). NOT VALID: the new and updated rows are
-- checked from now on; the operator may VALIDATE it after inspecting the
-- historical rows (there are none outside 'member'/'admin'/'owner').
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'workspace_members_role_check'
       and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_role_check
      check (role in ('owner', 'admin', 'member')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'workspace_members_status_check'
       and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_status_check
      check (status in ('active', 'pending', 'revoked')) not valid;
  end if;
end
$$;

-- A pending invitation is a member row whose subject is a PLACEHOLDER
-- ('pending:<16-hex>', derived from the invited email by
-- src/domain/actor.ts:pendingSubjectFor) — there is no user yet. The
-- placeholder is deterministic, so a re-invite updates the same row instead
-- of consuming a second seat.
create index if not exists workspace_members_email_idx
  on public.workspace_members (email);
create unique index if not exists workspace_members_pending_email_uniq
  on public.workspace_members (workspace_id, email)
  where status = 'pending';

-- ---------- 3. the actor columns (OD13) ----------
-- The actor NEVER rides inside a payload document: it is a SIBLING column of
-- payload in the same table, so the frozen bytes of audits.payload and
-- audit_issues.payload are unchanged by the presence of an actor.
-- public.audit_issues.issued_by already exists (0001) and is already a
-- sibling of audit_issues.payload; no change.
alter table public.projects
  add column if not exists updated_by  text;
alter table public.audits
  add column if not exists produced_by text;
alter table public.attachments
  add column if not exists uploaded_by text;

-- ---------- 4. two more claim helpers ----------
-- Same shape as app_claim_subject(): they read the claims GUC and reference
-- NO table — the design rule of 0002 ("NO POLICY REFERENCES ANOTHER TABLE").
-- The field names are fixed in src/lib/db/claim.ts (M1).
create or replace function public.app_claim_role() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
create or replace function public.app_claim_email() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email' $$;

-- ---------- 5. the membership policies ----------
-- SELECT (RLS HOLE 2, OD5.2 + OD20-N2): a member reads the member list of
-- their OWN workspace. The ONLY row a caller may see outside its own
-- workspace is its OWN pending invitation (an invitee is not a member yet).
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members for select
  using (workspace_id = public.app_claim_workspace_id()
         or (email = public.app_claim_email() and status = 'pending'));

-- INSERT (RLS HOLE 3, OD5.3 + OD14): the inviter inserts a member row for
-- ANOTHER subject, with the role carried in the claim. 'admin' is granted only
-- by an OWNER; an admin inviter may grant 'member' only. 'owner' is NEVER
-- granted by the app. The self-insert branch (subject_id = the claim subject)
-- is the KV->Postgres backfill's legacy subject and carries 'member' only.
drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members for insert
  with check (workspace_id = public.app_claim_workspace_id()
              and role <> 'owner'
              and (
                (subject_id = public.app_claim_subject() and role = 'member')
                or (public.app_claim_role() = 'owner' and role in ('member', 'admin'))
                or (public.app_claim_role() = 'admin' and role = 'member')
              ));

-- UPDATE: the invitee binds its OWN pending invitation (status + subject_id
-- only). The ROLE is not writable: the app role holds no UPDATE privilege on
-- workspace_members.role (5b below), so no policy expression can change a
-- role. An OWNER administers the workspace's rows.
drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members for update
  using (workspace_id = public.app_claim_workspace_id()
         and (
           subject_id = public.app_claim_subject()
           or (email = public.app_claim_email() and status = 'pending')
           or public.app_claim_role() = 'owner'
         ))
  with check (workspace_id = public.app_claim_workspace_id());

-- DELETE: a member may leave (the seat is released); an owner may remove one.
drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members for delete
  using (workspace_id = public.app_claim_workspace_id()
         and (
           subject_id = public.app_claim_subject()
           or (email = public.app_claim_email() and status = 'pending')
           or public.app_claim_role() = 'owner'
         ));

-- ---------- 6. the column-level privileges ----------
-- 6a. OD14: the app role may NEVER update the role. A table-level UPDATE
-- grant overrides a column-level revoke, so the table grant is revoked and
-- only the columns the app really writes are given back. `role` is absent
-- from the list ON PURPOSE — that is the whole guarantee. Postgres has no
-- column-scoped policies, so the privilege (not a policy expression) is what
-- makes a role change impossible for the app role.
revoke update on public.workspace_members from auditorai_app;
grant  update (subject_id, status, email, invited_by, expires_at, accepted_at, revoked_at)
  on public.workspace_members to auditorai_app;

-- 6b. the grants for the new helpers.
grant execute on function public.app_claim_role()  to auditorai_app;
grant execute on function public.app_claim_email() to auditorai_app;
```

**What is deliberately NOT in `0004`:** no `workspace_invites` table (see the deviation note at the top), no
change to any primary key, no change to `public.workspace_credentials` (the lifecycle is reused as-is), no
`app_users` table, no change to `public.audit_issues.issued_by` (its `default 'auditor'` stays for historical
rows; the app always supplies an explicit value now), and **no UPDATE policy that can change a role**.

**On "(d) no UPDATE policy on `workspace_members.role`".** Postgres has no column-scoped policies: a policy is
per table and per command, so "an UPDATE policy on a column" does not exist as an object. The requirement is
therefore honoured in the two forms Postgres *can* honour, and both are in the DDL above: (i) the app role holds
**no UPDATE privilege** on `workspace_members.role` (6a) — a member physically cannot write it, whatever the
policy says; (ii) the single `workspace_members_update` policy contains **no expression mentioning `role`** —
it filters rows only, and `with check` pins `workspace_id`. The escalation the critique found (a member
self-promoting to `owner` through the app's own role-claiming loop) is closed by (i), and the test proves it
("a member's own UPDATE cannot change `role`"). If the orchestrator wants a guarantee that survives a future
blanket `grant update on public.workspace_members`, the one extra statement is a `BEFORE UPDATE` trigger that
raises when `old.role is distinct from new.role` — say so and it is added.

### The three RLS holes (OD5), one by one

| Hole | Today | Fix in `0004` | Test |
|---|---|---|---|
| **1** — `workspaces_update` lets any member UPDATE its own workspace row, so a `seat_count` column there would be raisable by the party it constrains (`supabase/migrations/0002_rls_policies.sql:70-73`). | table-level `UPDATE` granted to `auditorai_app` in `0003`. | `revoke update on public.workspaces from auditorai_app;` + `grant update (name, region) …` and the same for `INSERT` — a **column-level privilege**: the app role can no longer write `seat_count`; the privileged operator role still can (OD19). | AC16 (M8), AC24 (M7) |
| **2** — `workspace_members_select` shows a member only their own row (`0002:77-79`), so neither the count nor the team page can work. | self-subject select. | `using (workspace_id = app_claim_workspace_id() or (email = app_claim_email() and status = 'pending'))` — a member reads the member list of their **own workspace**; the only cross-workspace visibility is the caller's **own pending invitation**. The count **and** the member list are narrowed by `workspace_id` in the service (OD20-N2). | AC17 (M8) |
| **3** — `workspace_members` insert requires `subject_id = app_claim_subject()` (`0002:80-82`), so the app cannot insert a member row for another subject. | self-insert only. | `with check (workspace_id = app_claim_workspace_id() and role <> 'owner' and (… app_claim_role() = 'owner' …))` — the role travels in the claim (`app_claim_role()`) and is read from the actor's **own** membership row, never asserted by the client. The self-insert branch keeps the KV→Postgres backfill working. | AC18 (M8) |

### The operator-applied procedure (out of band — never by an app role)

Added to `supabase/README.md` (M7), in this order. **The operator's role**: the platform's privileged owner
credentials (`POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`, which the app **never** reads) or the Supabase SQL
editor. That role is **privileged** (it bypasses RLS), so these statements are not bound by the policies in
`0002`/`0004` — a plain table owner under `FORCE ROW LEVEL SECURITY` would match zero rows, which is why the
role is named here explicitly.

```bash
# 0. the operator's shell has the direct connection string; it is never in the repo
export POSTGRES_URL_NON_POOLING='<operator-supplied direct connection string>'

# 1. apply the #54 migration AFTER 0001 -> 0002 -> 0003 (never by an agent)
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f supabase/migrations/0004_seats_invites.sql

# 2. the seat allowance of a workspace (the entitlement). The app may only
#    READ it (OD19); this statement is the only way it is written.
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 \
  -c "update public.workspaces set seat_count = 25 where id = '<workspace-uuid>';"

# 2b. the default a NEW workspace gets (SEAT_COUNT_DEFAULT, default 1):
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 \
  -c "alter table public.workspaces alter column seat_count set default 7;"

# 3. the FIRST member of the workspace is its owner — provisioned OUT OF BAND
#    (the app never creates an owner or a workspace, OD18):
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 \
  -c "insert into public.workspace_members (workspace_id, subject_id, role, email, status, accepted_at)
      values ('<workspace-uuid>','<supabase-user-uuid>','owner','owner@firm.com','active', now());"

# 3b. the owner's FIRST credential (the app route cannot issue one): the key is
#     operator-generated and the row is keyed by the SAME 16-hex workspaceHash
#     the app computes (sha256(key) truncated to 16 hex chars):
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 \
  -c "insert into public.workspace_credentials (credential_hash, workspace_id, subject_id)
      values (left(encode(sha256('<operator-generated-key>'::bytea),'hex'),16),
              '<workspace-uuid>','<supabase-user-uuid>');"

# 4. flip the switch LAST (unchanged from #53):
#    TENANT_STORE=postgres
```

`GET /api/auth/me` surfaces the signed-in user's uuid so the operator can paste it into step 3.

**Re-runnability.** Every statement in `0004` is idempotent (`add column if not exists`, `create index if not
exists`, `drop policy if exists` + `create policy`, `create or replace function`, a guarded `add constraint`).
A partial apply (the table columns landed, the policies did not) is repaired by running the file again; the
pglite harness proves it (AC24 — `tests/integration/migration-0004.test.ts`). `revoke`/`grant` are idempotent by
construction. No statement drops or renames anything, so a re-apply can never lose data.

---

## Env surface

**No new `NEXT_PUBLIC_SUPABASE_*` name** (OD9): the existing secret-boundary scan
(`tests/integration/secret-boundary.test.ts:53-57`) permits only `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and that test must stay green.
Every new name is **server-side** and read at call time. **No new env var is required for the legacy path to
work** (OD3). **No new secret name either**: the account-creation path uses the **existing**
`SUPABASE_SERVICE_ROLE_KEY` (already in `.env.example`) through the **existing** accessor
`src/lib/db/admin.ts:11` — the only module in `src/` allowed to name it
(`tests/integration/secret-boundary.test.ts:168-176`).

| Env name | Default when absent | Observable degraded behaviour |
|---|---|---|
| `SUPABASE_AUTH_ENABLED` | absent ⇒ **off** | The sign-in surface is not configured: `GET /api/auth/config` → `{configured:false, providers:[]}`; `/sign-in` shows the plain notice "sign-in is not configured"; `POST /api/auth/email` → `503` with that message. **The product is otherwise exactly as today** (the workspace-key path, the legacy store, the projects list, the "database not configured" notice). |
| `SUPABASE_AUTH_EMAIL_ENABLED` | absent ⇒ email is **not offered** | `/api/auth/config` omits `"email"`; the sign-in page shows no email form. No error. |
| `SUPABASE_AUTH_GOOGLE_ENABLED` | absent ⇒ Google is **not offered** | `/api/auth/config` omits `"google"`; the button does not exist. With the flag set but the Supabase project lacking the Google app, `GET /api/auth/signin/google` → `503` with the plain message "this sign-in provider is not configured" (never a raw upstream error). |
| `SUPABASE_AUTH_MICROSOFT_ENABLED` | absent ⇒ Microsoft is **not offered** | same shape as Google. |
| `SUPABASE_AUTH_REDIRECT_ORIGIN` | absent ⇒ **no OAuth provider is offered** (even with its flag set) | There is no redirect target, so the OAuth handshake cannot be built. `providers` contains only `"email"`. The origin is read from configuration, never from the request's `Host` header. |
| `SEAT_COUNT_DEFAULT` | `1` | **Operator-side.** The app role may not write `seat_count` (OD19) and the app never creates a workspace (OD18), so this name has **no app-side reader**: it is the default the operator applies out of band (`alter table public.workspaces alter column seat_count set default N;`, step 2b above). The DDL's column default is `1`. |

Already-sufficient names, unchanged: `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, the anon/publishable key,
`SUPABASE_JWT_SECRET` (`src/lib/db/config.ts:53-67` — the JWT secret was already reserved for #54),
`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` (already in `.env.example`; the account-creation path).

**.env.example lines to add (exact):**

```
# Sign-in (Supabase Auth). OFF unless SUPABASE_AUTH_ENABLED=true; while it is
# off the product behaves exactly as today (the workspace-key path) and the
# sign-in page says sign-in is not configured. There is NO self-serve sign-up:
# an account is created only by accepting an invitation.
SUPABASE_AUTH_ENABLED=
# Email + password sign-in on/off (server-side). The browser learns what is
# offered from GET /api/auth/config, never from the environment.
SUPABASE_AUTH_EMAIL_ENABLED=
# Google sign-in on/off. Set it after the operator configures the Google app
# in the Supabase project; absent => the button is not offered.
SUPABASE_AUTH_GOOGLE_ENABLED=
# Microsoft sign-in on/off. Same shape as Google.
SUPABASE_AUTH_MICROSOFT_ENABLED=
# The app's public origin, used to build the OAuth redirect target. It must be
# allow-listed in the Supabase project. Absent => no OAuth provider is offered.
SUPABASE_AUTH_REDIRECT_ORIGIN=
# The seat allowance a NEW workspace gets (operator-side; the app may only
# read workspaces.seat_count). Apply it out of band:
#   alter table public.workspaces alter column seat_count set default N;
# Default: 1.
SEAT_COUNT_DEFAULT=
```

---

## Verification

**Per module** (run by the worker, in the module's own worktree):

```bash
npx vitest run <the module's test files>     # the module's own suites
npm run lint
npm run typecheck
```

| Module | The test command |
|---|---|
| M1 | `npx vitest run tests/domain/actor-id.test.ts src/lib/auth/__tests__/config.test.ts` |
| M2 | `npx vitest run src/lib/auth/__tests__/supabase.test.ts` |
| M3 | `npx vitest run src/lib/auth/__tests__/session.test.ts` |
| M4 | `npx vitest run src/lib/auth/__tests__/actor.test.ts tests/integration/tenant-store-cutover.test.ts tests/integration/database-not-configured.test.ts tests/integration/admin-auth.test.ts tests/integration/tenant-isolation.test.ts` |
| M5 | `npx vitest run tests/domain/actor-propagation.test.ts tests/domain/audit-issues.test.ts tests/domain/audit-workspace.test.ts tests/domain/persistence-contract-matrix.test.ts tests/domain/artifact-persistence.test.ts tests/domain/retention-policy.test.ts tests/integration/devtab.test.ts tests/integration/kv-to-postgres-migration.test.ts` |
| M6 | `npx vitest run tests/integration/actor-routes.test.ts tests/integration/candidate-review-route.test.ts` |
| M7 | `npx vitest run tests/integration/migration-0004.test.ts tests/integration/tenant-rls.test.ts` (pglite) |
| M8 | `npx vitest run tests/integration/seat-invite.test.ts` (pglite — slow: allow the 180 s hook timeout the existing pglite suites set) |
| M9 | `npx vitest run tests/integration/auth-routes.test.ts` |
| M10 | `npx vitest run tests/integration/team-routes.test.ts` |
| M11 | `npx vitest run tests/integration/credential-lifecycle.test.ts` |
| M12 | `npx vitest run tests/integration/env-surface.test.ts tests/integration/security-record.test.ts tests/integration/secret-boundary.test.ts` |

**Per-wave gate (OD15).** After **every** wave — not only at the end of the build — the worker runs the full
gate in the wave's worktree:

```bash
npm run lint
npm run typecheck
npm run test
node scripts/vault-sync.mjs --check    # vault determinism
```

- **`npm run test` runs the WHOLE suite at the wave gate** (not only the module's own files): a wave that
  leaves a red suite is not finished. The per-module command above is for the fast inner loop.
- **Vault determinism.** `state/vault-notes.json` must stay **byte-identical** to the committed tree. No module
  in this plan touches `state/` or `vault/`, so `--check` must pass untouched. **If a module changes `state/` or
  `vault/`** (nothing in this plan does), re-sync with `node scripts/vault-sync.mjs` — **never** the bare
  `scripts/vault-import.mjs` / `vault-export.mjs` (a parallel session's uncommitted journal edits would poison
  the commit). Run `node scripts/vault-sync.mjs --check` **before any push**.
- **Staging hygiene.** Stage only the files the module touched (`git add <paths>`), never `git add -A`; never
  write the literal `[skip ci]`.

**At the end of the ticket (one worker, after every module has landed):**

```bash
npm run ci          # lint + typecheck + test + build
node scripts/vault-sync.mjs --check    # vault determinism: state/vault-notes.json must stay byte-identical
npm run ci:local    # the full CI mirror (state validation, evidence, vault, eval gate, harvest mock)
```

Notes the executors must respect:

- **The build must succeed with every env var unset** — no import-time env read and no import-time network
  call in any new module (`src/lib/db/config.ts:4-6`).
- **No `npm ci` / `npm install`**: #54 adds no dependency, so `package.json` and `package-lock.json` stay
  untouched (OD8 — and this is what keeps #47's inventory clean).
- **The pre-commit hook** (`.githooks`) runs lint + typecheck + vault determinism + YAML parse; **stage only
  the files your module touched**, and never write the literal `[skip ci]`.
- **Regression contract** — these suites must stay green and unchanged in behaviour:
  `tests/integration/tenant-isolation.test.ts`, `tests/integration/tenant-rls.test.ts` *(except its migration
  list — M7 owns it)*, `tests/integration/database-not-configured.test.ts`, `tests/integration/secret-boundary.test.ts`,
  `tests/integration/tenant-store-cutover.test.ts`, `tests/integration/admin-auth.test.ts`,
  `tests/domain/audit-issues.test.ts`, `tests/domain/retention-policy.test.ts`,
  `tests/domain/persistence-contract-matrix.test.ts`, `tests/domain/artifact-persistence.test.ts`,
  `tests/integration/kv-to-postgres-migration.test.ts`.

---

## Acceptance

AC1..AC24. Each row names the test that proves it and its source (a ticket sentence or an OD number).

| # | Acceptance criterion (testable) | Test that proves it | Source |
|---|---|---|---|
| **AC1** | Sign-in offers exactly the configured providers. With the auth env absent the sign-in page says "sign-in is not configured" — a plain notice, never an error, never a 500. | `tests/integration/auth-routes.test.ts` (M9) — `/api/auth/config` → `{configured:false, providers:[]}`; master switch only → `{configured:true, providers:["email"]}`; Google/Microsoft appear only when their own env name is set. | ticket "Sign-in with email, Google and Microsoft"; OD6, OD11 |
| **AC2** | Email sign-in is email + password, server-mediated against the Supabase Auth REST API. The browser never receives a token, the anon key or the Supabase URL; the session is an `httpOnly` cookie. | `tests/integration/auth-routes.test.ts` (M9) + `src/lib/auth/__tests__/supabase.test.ts` (M2) — the fake Auth server receives `POST /auth/v1/token?grant_type=password`; the response body carries no token; the `Set-Cookie` is `HttpOnly`. | ticket; OD6 |
| **AC3** | Google/Microsoft sign-in is offered only when its env name **and** `SUPABASE_AUTH_REDIRECT_ORIGIN` are set; an unconfigured provider answers the plain "this sign-in provider is not configured" notice (503), never a raw upstream error. | `tests/integration/auth-routes.test.ts` (M9) — the provider is absent from `/api/auth/config`; with the flag set but the origin absent → 503 + notice; with both → 302 to the authorize URL carrying the PKCE challenge. | ticket; OD6, OD11 |
| **AC4** | The access token is verified server-side as HS256 against `SUPABASE_JWT_SECRET`. `alg=none`, a wrong signature, an expired token, a wrong audience and a wrong issuer are all rejected (no session). | `src/lib/auth/__tests__/supabase.test.ts` (M2) — five negative cases plus one positive case over a token the test signs itself. | OD8; OD6 |
| **AC5** | **No public self-serve sign-up.** An account is created **only** by the invite-acceptance path (the Auth Admin API, `email_confirm: true`). A sign-in attempt for an email with no invitation returns the plain notice "no invitation for this email" and creates nothing. | `tests/integration/auth-routes.test.ts` (M9) — no invitation → 401 + the plain notice, **no call to the Auth server**; the route source has no signup branch. `tests/integration/team-routes.test.ts` (M10) — accept → the fake Auth server receives `POST /auth/v1/admin/users` with `email_confirm: true`; no invitation → nothing created. `src/lib/auth/__tests__/supabase.test.ts` (M2) — the module has no `signUpWithPassword` export. | **OD12** (B1) |
| **AC6** | Every tenant-scoped mutation carries a non-constant actor id: the six tenant write routes persist it on the project, the audit, the attachment and the issued issue; the delete route carries it through the same seam. | `tests/integration/actor-routes.test.ts` (M6) + `tests/domain/actor-propagation.test.ts` (M5) — each of the six write routes is called and the persisted record carries the actor; the delete answers 200 with the remaining rows unchanged. | ticket "Every mutation and issued record carries the actor's user id"; OD2, OD20-N7 |
| **AC7** | The issued record names the actor, and the actor id is never the constant `"auditor"`: `u:<uuid>` when a session is present, `legacy:<16-hex>` on the credential-only path. No write path emits `"auditor"`. | `tests/domain/actor-propagation.test.ts` (M5) — both adapters write a non-constant actor; `isWrittenActor("auditor") === false`; `assertWritableActor("auditor")` throws at the write site. | OD2, OD10; OD20-N5 |
| **AC8** | The actor id is never written into a payload document: the frozen `AuditResult` bytes are identical with and without an actor, and the actor lives in sibling columns/fields (`issued_by`, `audits.produced_by`, `attachments.uploaded_by`, `projects.updated_by`). | `tests/domain/actor-propagation.test.ts` (M5) — the frozen `result` object is byte-identical with and without the actor; the four actor locations are asserted per adapter. | **OD13** (B2); OD2 |
| **AC9** | A pre-#54 lineage (`issued_by: "auditor"`) still restores byte-identically (skipped, not conflicting); a divergent restore still raises `IssueRevisionConflictError`. | `tests/domain/actor-propagation.test.ts` (M5) — export a lineage with the historical constant, restore it twice → `{restored:0, skipped:N}`; then restore a mutated copy → conflict. | OD2 (the restore byte-compare at `src/lib/persistence/issue-ledger.ts:114`) |
| **AC10** | The actor id is never written into the frozen `AuditResult` payload and never into the ADR-0009 outcome log (`state/candidate-outcomes/`). | `tests/domain/actor-propagation.test.ts` (M5) — the issued `result` JSON contains no actor field; the throwing outcome sink installed by `tests/setup.ts:16-18` records no write. | OD2, OD13 |
| **AC11** | A Workspace has a seat limit (`workspaces.seat_count`, default `1`) and the used seats = accepted members + pending unexpired invitations. A revoked member holds no seat and an expired invitation holds none. | `tests/integration/seat-invite.test.ts` (M8, pglite) — the count boundary: with `seat_count = 2`, one active member + one pending invite = 2 used; an expired pending invite counts 0; a revoked member counts 0. | ticket "Seat count per Workspace"; OD4, OD20-N9 |
| **AC12** | The seat limit is enforced **at invite**: an invite that would exceed the limit is refused with HTTP 409 (`SeatLimitExceededError`). | `tests/integration/seat-invite.test.ts` (M8) + `tests/integration/team-routes.test.ts` (M10) — the third invite of a 2-seat workspace raises; the route answers 409 with the plain message. | ticket "enforced at invite"; OD4 |
| **AC13** | Only a member whose role is `owner` or `admin` may invite; a plain `member` is refused with 403 (`NotWorkspaceAdminError`). An `admin` inviter may grant `member` only; an `owner` inviter may grant `admin`; nobody may grant `owner`. | `tests/integration/seat-invite.test.ts` (M8) + `tests/integration/team-routes.test.ts` (M10) — the role matrix is asserted in the service and through the route. | OD4; **OD14** (B3) |
| **AC14** | An invited person who accepts becomes an active member and consumes exactly one seat; an expired pending invitation consumes none and cannot be accepted. | `tests/integration/seat-invite.test.ts` (M8, pglite) — the acceptance binds `subject_id` to the signed-in uuid, flips `status` to `active`, and the seat count does not double-count. | OD4; OD12 |
| **AC15** | The invitation TTL is **14 days**, an exported named constant (`INVITE_TTL_DAYS`), named in the ADR, and asserted by a test: an invite past the TTL no longer consumes a seat. | `tests/integration/seat-invite.test.ts` (M8) — the pending row's `expires_at` equals `now() + INVITE_TTL_DAYS`; the ADR names the constant. | **OD20-N1** (N1) |
| **AC16** | **RLS hole 1 closed**: the app role holds **no** UPDATE/INSERT privilege on `workspaces.seat_count` (the privilege shape). The operator can write it. | `tests/integration/seat-invite.test.ts` (M8, pglite) — `has_column_privilege('auditorai_app','public.workspaces','seat_count','UPDATE')` is false (and `INSERT`); the operator's statement succeeds and updates exactly one row. `tests/integration/migration-0004.test.ts` (M7) — the grants are in the file. | OD5.1; **OD19** (B8) |
| **AC17** | **RLS hole 2 closed**: a member can read the member list of their own workspace, and cannot read another workspace's member list. Both the count and the list are filtered by `workspace_id`. | `tests/integration/seat-invite.test.ts` (M8, pglite) — two workspaces, two claims, two different row sets. | OD5.2; **OD20-N2** (N2) |
| **AC18** | **RLS hole 3 closed**: an owner may insert a member row for another subject with `role='member'` or `'admin'` (never `'owner'`); a plain member may not; and the app role has **no** UPDATE privilege on `workspace_members.role`, so no policy can change a role. | `tests/integration/seat-invite.test.ts` (M8, pglite) — the insert succeeds under the owner/admin claim and raises under the member claim; **a member's own UPDATE cannot change `role`**; a self-promoted member still cannot insert. | OD5.3; **OD14** (B3) |
| **AC19** | The application never creates a workspace and never creates an owner: a subject with no membership row and no invitation gets no workspace row, no owner row and the existing `WorkspaceMembershipError` → 403. The first owner is provisioned by the operator out of band. | `tests/integration/seat-invite.test.ts` (M8) — no invitation ⇒ no workspace row, no owner row; `supabase/README.md` carries the operator's first-owner SQL. | **OD18** (B7) |
| **AC20** | **Production behaviour is unchanged while `TENANT_STORE` is unset**: the legacy workspace-key path serves exactly as today (same header, same 401, same namespace, same responses, same status codes) and **no new env var is required**. | the existing `tests/integration/tenant-store-cutover.test.ts` and `tests/integration/database-not-configured.test.ts` stay green, plus `tests/integration/actor-routes.test.ts` (M6) — the legacy path still answers 200 and the actor is `legacy:<16-hex>`, never a refusal. | OD3; ticket |
| **AC21** | Credentials are rotatable, revocable and **server-side**: the browser no longer mints the replacement, rotation and revocation take effect on the next request without deleting any tenant row, and both are refused on the legacy path (the key hash *is* the KV namespace). | `tests/integration/credential-lifecycle.test.ts` (M11, pglite + route) — rotate → the old credential is refused, the new one works, the workspace's rows are untouched; revoke → 401 and the rows are still there; on the legacy path → the plain "requires the tenant store" state and the old key still works. | ticket "Rotatable, revocable credentials" |
| **AC22** | The env surface is declared: every new env name appears in `.env.example`, no new `NEXT_PUBLIC_SUPABASE_*` name exists, no secret value is in the repo, and the service-role name is read only by `src/lib/db/admin.ts`. | `tests/integration/env-surface.test.ts` (M12, new) — every name read by `src/lib/auth/config.ts` appears in `.env.example`; the existing `tests/integration/secret-boundary.test.ts` stays green (it fails on any new public Supabase name and on the service-role name outside the admin module). | OD9; OD8 |
| **AC23** | The repo's own records stop contradicting the code: `docs/validation/security-review.md`, `CONTEXT.md` and `docs/glossary.md` state the named-user model, and **no document claims G-2 is closed** — G-2 is satisfied on the Postgres path and open on the legacy path. | `tests/integration/security-record.test.ts` (M12, new) — the security record no longer claims "Anonymous workspaces, no accounts/PII" nor "Bearer-style `x-workspace-key`" as the access model; a repo-wide assertion over `CONTEXT.md`, `docs/glossary.md`, `docs/validation/security-review.md` and `docs/adr/**` finds no document claiming G-2 closed. | OD1 |
| **AC24** | The migration is re-runnable and the migration-enumerating test names it: applying `0004` twice succeeds and leaves the same schema and the same policies, and the applied-migration list is updated. | `tests/integration/migration-0004.test.ts` (M7, pglite) — the file is applied, then applied again; no error, and the seat/RLS assertions still hold. `tests/integration/tenant-rls.test.ts` (M7) — the expected list includes `0004_seats_invites.sql`. | OD16; **OD17** (B6) |

---

## Risks and rollback

Per module: what goes wrong, and what to do.

| Module | Risk | Rollback / response |
|---|---|---|
| **M1** | The actor type keeps the historical `"auditor"` member, so a reviewer reads it as "the constant survives". | Mitigation: `isWrittenActor` + `assertWritableActor` are the machine guards and a test asserts no writer emits it (M5). Rollback: delete the module — nothing else depends on it yet. |
| **M1** | A new env accessor reads env at import time → the build breaks with an empty env. | The accessors read at call time; `npm run build` with no env is the check. |
| **M1** | The config module names the service-role env var → the secret-boundary scan goes red. | The config module never names it; M2 calls the existing `supabaseServiceRoleKey()` accessor. |
| **M2** | A hand-rolled HS256 verifier has a subtle bug (e.g. accepting `alg=none`). | The verifier is a pure function with five negative cases (AC4). Rollback: replace the module behind the same interface (no other module changes). |
| **M2** | The account-creation call is reachable outside the invite path → a public sign-up reappears. | It is exported from a server-only module and called from exactly one route (M10's accept); the source-scan assertion in `tests/integration/auth-routes.test.ts` pins that. |
| **M3** | A cookie flag is wrong (`Secure` off in production, `SameSite=None`) → session leakage or CSRF. | The flags are asserted in the suite; `Secure` in production, `SameSite=Lax` always. |
| **M4** | Tightening the membership check with `status <> 'revoked'` breaks a suite that inserts rows without a status. | The column defaults to `'active'` and `0004` lands in an earlier wave (OD16). Rollback: drop that one clause. |
| **M4** | `requireWorkspace`'s return type change breaks a caller that destructures it. | The compiler points at every caller; the seven routes are M6's job. |
| **M4** | The database has no `0004` → the resolution fails closed with 503 instead of degrading. | Deliberate (OD16): the fallback is for a missing tenant schema, not a missing migration. The operator's procedure applies `0004` before flipping `TENANT_STORE=postgres`; the README says so. |
| **M5** | The actor leaks into the frozen `AuditResult` payload → the frozen bytes change → a pre-#54 restore raises a conflict. | The actor lives in sibling columns; AC8/AC9 assert the byte-compat. Rollback: revert the writer — the frozen records are untouched by the rollback. |
| **M5** | The backfill overwrites a legitimate `u:` actor, or keeps writing the constant. | The rule is exact: override `"auditor"` with `legacy:<hash>`, preserve every other stored value (OD20-N4); asserted by a test. |
| **M5** | The legacy audit record silently loses its actor. | Accepted and documented (OD13): the legacy audit document *is* the `AuditResult`. The Postgres path is authoritative after the cutover. |
| **M6** | A route forgets `auth.actor`. | The parameter is optional, so the compiler does **not** catch it — the mitigation is the route test (AC6), which asserts the persisted actor on all six write routes. |
| **M7** | `0004` is applied to a database whose `0001`–`0003` are not applied → the ALTER fails. | The operator's procedure applies them in order with `ON_ERROR_STOP=1`; the app's degradation path (`schema_not_applied`) covers a missing schema. |
| **M7** | The column-level `revoke update on public.workspaces` also removes an update the app needs. | The app never updates a workspace row; the two harmless columns are re-granted in the same file. |
| **M7** | The `revoke insert on public.workspaces` breaks the KV→Postgres backfill. | The four columns the backfill writes (`id`, `name`, `region`, `legacy_key_hash`) are re-granted in the same file; the pglite backfill suite proves it. |
| **M7** | The widened policies are too permissive. | The workspace predicate is retained in every policy, the email clause is limited to the caller's own **pending** invitation, and the role is DB-sourced. AC17/AC18 pin the boundary in pglite. Rollback: re-apply `0002`'s policies (the file is re-runnable). |
| **M8** | Two concurrent invites both pass the check. | The check and the insert are one transaction; the second transaction sees the first's committed row. |
| **M8** | A pending invitation holds a paid seat forever. | The expiry is a column evaluated at count time (no background job); an expired invitation is free and un-acceptable (AC15). |
| **M8** | The email clause in the select policy leaks the caller's own row from another workspace into the count. | The count **and** the list are narrowed by `workspace_id` in the service (OD20-N2). |
| **M9** | The OAuth callback shape differs from the assumption (Supabase returns `?code=` vs `?token_hash=`). | The callback accepts `?code=`; a `token_hash` shape is a one-line addition to the same handler. |
| **M9** | The invite gate needs the tenant store, so sign-in is unavailable while `TENANT_STORE` is unset. | Accepted and documented: the sign-in surface is new, and it answers a plain notice (409) rather than an error; the legacy product path is untouched (OD3). |
| **M10** | The team page breaks the legacy path (the legacy store has no members). | The GET answers `team: null` + the notice when the tenant store is not live; no legacy code path changes. |
| **M10** | The accept route creates a second account for an email that already has one. | The route signs the existing user in instead of creating one; the fake Auth server's call count is asserted. |
| **M11** | Rotation on the legacy path would orphan the workspace's KV data. | The route refuses with the named "requires the tenant store" state; the guard is asserted in the suite. |
| **M11** | The rotated credential is returned in a response body that a proxy logs. | The value is returned **once**, over TLS, in a `POST` response; it is never stored in a log, a cookie or the repo. |
| **M12** | The security record's gate line is widened by an implementer. | The gate judgement is the **operator's**; the wording states the condition, not the permission. |

**Whole-ticket rollback.** The change is additive in every direction, so the rollback is a revert, not a data
repair: (1) revert the app (the merge auto-deploys); (2) **leave `0004` applied** — it is a new column with a
default, a new set of membership columns, three new actor columns, a column-level privilege tightening and
widened policies; the pre-#54 app ignores all of it and rolling the schema back would only destroy the
operator's provisioned allowances; (3) the frozen records are untouched by any rollback — they are write-once,
and both the old (`"auditor"`) and the new (`u:` / `legacy:` / `admin:`) values stay readable, which is why the
read union admits the historical constant.

---

## Open questions for the orchestrator

1. **`blocked_by` on the DAG root.** A dependency DAG needs exactly one root, and M1 (the actor vocabulary, the
   claim contract, the domain types and the config/notice seam) is it: it depends on nothing and every other
   module depends on it. Inventing an edge for M1 would be a false dependency, so **M1 is the only module with
   `blocked_by: []`** — the same item v1 raised and the orchestrator has not answered. If the orchestrator wants
   a literally empty-free list, the cheapest fix is to fold M1 into M4 (M4 becomes the root); say so and it is
   done.
2. **"No UPDATE policy on `workspace_members.role`" in Postgres terms.** Postgres has no column-scoped
   policies. The plan implements the guarantee as (i) the app role holds **no UPDATE privilege** on the `role`
   column and (ii) the single UPDATE policy contains no `role` expression — the two forms Postgres can honour.
   The alternative (a `BEFORE UPDATE` trigger that raises on a role change) is one extra statement if the
   orchestrator wants a guarantee that survives a future blanket table grant; say so.
3. **`SEAT_COUNT_DEFAULT` has no app-side reader.** OD4 says the limit "defaulting from env
   `SEAT_COUNT_DEFAULT`", but OD19 forbids the app from writing `seat_count` and OD18 forbids the app from
   creating a workspace — so nothing in the app could apply the default. The plan declares the name in
   `.env.example` and documents the operator's `alter table public.workspaces alter column seat_count set
   default N;` as the way the value takes effect (the DDL's default is `1`). If the orchestrator wants the app
   to read the env (e.g. as a fallback when a workspace row is missing), say so and M8's service will use it.
4. **The legacy audit record carries no actor.** On the legacy path the audit document *is* the `AuditResult`,
   and OD13 forbids a key inside a payload document; so the audit actor is stored on the Postgres path only
   (`audits.produced_by`). The issue, the project and the attachment carry it on both paths. The Postgres
   adapter is authoritative for a migrated workspace; the asymmetry is recorded in the ADR.
5. **`GET /api/auth/me` is an added public endpoint** (not in the ticket body). It exists so the operator can
   learn a user's uuid for the out-of-band owner provisioning (OD18). It returns only the subject and the
   email. Keep or cut — cutting it makes step 3 of the operator procedure a manual lookup.

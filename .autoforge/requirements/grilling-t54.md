# Grilling — Ticket #54 (Named-user accounts, seats, actor id on issuance)

Repo: `Akamel01/AuditorAI` · branch `oc/54` · read-only pass · artifact only.

**Role.** Adversary of the ticket's own wording. I do not design and I do not plan. Every repo claim
carries `path:line`. Where I contradict the discovery report I say so and show the evidence.

**Method.** Read the ticket body, the gap-audit entries G-1/G-5, `CONTEXT.md` (canonical glossary),
`docs/glossary.md`, ADR-0004/ADR-0009, the tenant schema/RLS/roles, the identity + credential seam,
the issuance path, the env surface, the secret-boundary scanner, and the existing test suites.
Discovery's five "highest-risk findings" were re-verified line by line; four survive, one is
incomplete (F1 below).

---

## 0. Glossary check against `CONTEXT.md`

`CONTEXT.md` is the canonical glossary (`CONTEXT.md:1-5`). It already defines the tenant vocabulary
(`CONTEXT.md:260-288`): **Workspace** (`:262-264`), **Member** (`:266-268`), **Subject** (`:270-272`),
**Credential** (`:274-276`), **Legacy wire tokens** (`:278-281`).

Terms the ticket uses that `CONTEXT.md` does **not** define:

| Ticket term | Defined in `CONTEXT.md`? | Grilling consequence |
|---|---|---|
| "Workspace" | Yes — "the isolation boundary that owns one customer's data: the unit a credential grants access to" (`CONTEXT.md:262-264`) | **Ambiguous in the ticket.** This is the *tenant*, keyed by a credential — **not** "an organisation a firm buys seats for", which the gap audit says does not exist in code (`docs/research/enterprise-gap-audit.md:83`). See §5. |
| "seat" | **No.** Only `Subject` says "a person or seat" (`CONTEXT.md:270-272`) and `docs/glossary.md:13` repeats it | A seat is undefined: a purchasable unit? a membership row? a subject? It must be defined before "enforced at invite" is testable. |
| "actor id" | **No.** The glossary's person-shaped noun is **Subject** (`CONTEXT.md:270-272`) | The ticket introduces a second noun for a thing the glossary already has. Either "actor id" = `subject_id`, or it is a third thing. See §6. |
| "invite" | **No** | No invitation concept exists anywhere in `src/` (re-verified: no `user|account|seat|invite|session|login|signup|sso` model; the gap audit's ABSENCE record at `docs/research/enterprise-gap-audit.md:85-98` is still current) | The seat count is enforced at a surface that does not exist. |
| "user" / "named-user account" | **No** — `CONTEXT.md:270-272` says a Subject "is not yet an authenticated user — #54 supplies the named-user credential that makes it one" | The glossary *pre-commits* this ticket to producing exactly one new thing: a named-user credential. That is the strongest evidence of intended scope. |
| "session" | **No** | Nothing in the repo has a session concept. |
| "rotatable, revocable credentials" | **Yes**, but as **Credential** (`CONTEXT.md:274-276`) — "the bearer secret a client presents… rotatable and revocable, and revoking it never deletes the tenant's data" | The ticket's phrase is the glossary's **Credential**, *not* a Supabase auth session. Discovery read it the other way; the glossary is canonical, and it matters (§6, F3). |

**Decision (evidence).** Per `CONTEXT.md:270-272` and `CONTEXT.md:283-288`, "user" = a **Subject made
real by a named-user credential**; "actor id" must be a `subject_id` that resolves to such a user.
Per `CONTEXT.md:283-288` and `docs/glossary.md:16`, gap **G-2** ("the server derives tenant identity
from something the client cannot mint") "remains open until #54". **So #54 owns G-2 as well as G-1
and G-5** — even though `.autoforge/discovery/tracker-index-t54.md:8` assigns G-1+G-2+G-5 to #50
and `.autoforge/discovery/tracker-index-t54.md:11` lists #54 as "(G-1, G-5)". Contradiction to be
reconciled in the ticket text; the canonical glossary wins.

---

## 1. What the ticket literally asks for

The ticket body: *"Sign-in with email, Google and Microsoft. Seat count per Workspace, enforced at
invite. Every mutation and issued record carries the actor's user id. Rotatable, revocable
credentials. The operator creates the Supabase project and its keys. Never create accounts or handle
secrets: read them from env, with names listed in .env.example."*

Decomposed into individually testable requirements:

| # | Requirement | Testable statement | Anchors |
|---|---|---|---|
| **R1** | Email sign-in | A caller can sign in with an email address and obtain a session that identifies them | ticket body; `CONTEXT.md:270-272` |
| **R2** | Google sign-in, degrading | A Google sign-in path exists; when the operator has not configured the Google app, the product shows a plain "sign-in not configured" state — not an error, not a crash | ticket body; orchestrator brief; degradation precedent `src/lib/db-notice.ts:1-10` and `src/lib/api.ts:107-110` |
| **R3** | Microsoft sign-in, degrading | Same shape as R2 | ticket body; orchestrator brief |
| **R4** | A resolvable user identity, distinct from the workspace key | A signed-in caller has an id that resolves to a *user*, and that id is not the workspace credential | gap audit G-1 `:526`; `CONTEXT.md:270-272` |
| **R5** | A seat count exists per Workspace | Each Workspace has a seat count that can be compared against a limit | gap audit G-1 `:526-527`; ticket body |
| **R6** | The seat count is enforced at invite | An invite that would exceed the seat count is refused at the invite surface | gap audit G-1 `:526-527`; ticket body |
| **R7** | Every mutation carries the actor's user id | Every tenant-scoped mutating request resolves an actor user id and the record it writes carries it | gap audit G-1 `:527-528`; ticket body |
| **R8** | Every issued record carries the actor's user id | The frozen Audit Issue names the issuing user, and the name is **non-constant** | gap audit G-1 `:527-528`; ticket body |
| **R9** | The issued record still freezes | After the actor change, issuance remains write-once/immutable | gap audit G-1 `:528`; `CONTEXT.md:25-26`; ADR-0004 |
| **R10** | Credentials are rotatable and revocable | A credential can be replaced (rotation) and withdrawn (revocation) without deleting tenant data | ticket body; `CONTEXT.md:274-276`; gap audit G-5 `:577-579` |
| **R11** | The operator provisions; the app never provisions | The app never creates a Supabase project, never creates an account, never mints a credential into a secret it holds | ticket body; `supabase/README.md:8-9` ("No agent ever applies them"); `tests/integration/secret-boundary.test.ts:34-38` |
| **R12** | Env names are listed in `.env.example` | Every env name the app reads for this feature appears in `.env.example` | ticket body; `.env.example:1-45` |
| **R13** | Production behaviour is unchanged while the switch is off | With `TENANT_STORE` unset, the legacy workspace-key path serves exactly as today | orchestrator brief; `src/lib/db/config.ts:30-37`; `tests/integration/tenant-store-cutover.test.ts:57-80` |

**Ambiguities the ticket does not resolve, which the plan cannot fix:**

- R4/R7/R8 say "the actor's **user id**". §6 enumerates the readings.
- R5/R6 say "per **Workspace**" without saying which Workspace (§5).
- R10 says "credentials" without saying whether the object is the existing **Credential**
  (`CONTEXT.md:274-276`, `src/lib/db/credentials.ts:62-165`) or a Supabase session (§6, F3).
- R7 says "**every** mutation" — the repo has 21 mutating routes, 14 of them dev-console
  (`src/app/api/dev/**`, `requireAdmin` at `src/lib/api.ts:47-71`), and 3 unauthenticated public
  routes that mutate nothing (`src/app/api/jurisdictions/route.ts:6`,
  `src/app/api/jurisdictions/[jur]/stages/route.ts:11`, `src/app/api/inputs/[jur]/route.ts:11`).
  "Every mutation" is therefore **only satisfiable for tenant-scoped product mutations** (7 routes
  under `src/app/api/projects/**` and `src/app/api/upload`). The requirement must be scoped in
  writing or it is trivially false.

---

## 2. The gap entries restated as acceptance

### 2.1 G-1 → testable acceptance criteria

Source: `docs/research/enterprise-gap-audit.md:518-529`. Acceptance sketch at `:526-528`.

| # | Acceptance criterion (testable) | Maps to | Evidence anchor | Status |
|---|---|---|---|---|
| **A1** | Every user has a resolvable identity, distinct from the workspace key | R4 | gap `:526`; `CONTEXT.md:270-272` | Requires a subject that is a *user*, not `legacy:<hash>` (§6) |
| **A2** | A seat count exists | R5 | gap `:526-527`; no column on `workspaces` (`supabase/migrations/0001_tenant_schema.sql:32-40`) | Needs a schema/derivation decision (§5) |
| **A3** | The seat count is enforced at a product surface | R6 | gap `:526-527`; no invite surface exists in `src/` | Needs an invite surface + a counting path (§5, F2) |
| **A4** | Every mutation carries the actor's user id | R7 | gap `:527-528` | Needs a repository-seam change (`src/lib/db/tenant-repository.ts:19-70`) |
| **A5** | Every issued record carries the actor's user id | R8 | gap `:527-528`; `src/lib/persistence/issue-ledger.ts:49`, `src/lib/db/tenant-store.ts:220` | Needs the literal type widened (`src/domain/types.ts:304`) |
| **A6** | The actor id is **non-constant** and **resolves to a user** | R7+R8 | gap `:527-528` | The repo's own synthetic subject `legacy:<hash>` (`src/lib/db/migration.ts:136-138`) satisfies "non-constant" but **not** "resolves to a user" |
| **A7** | The issued record still freezes | R9 | gap `:528`; `src/lib/persistence/issue-ledger.ts:41-45`; `supabase/migrations/0001_tenant_schema.sql:94-103`; ADR-0004 | Adding an actor changes the frozen bytes; restore byte-compares (`src/lib/persistence/issue-ledger.ts:114`) — see F6 |

### 2.2 G-5 → testable acceptance criteria

Source: `docs/research/enterprise-gap-audit.md:569-580`. Acceptance sketch at `:577-579`.

| # | Acceptance criterion (testable) | Maps to | Evidence anchor | Status |
|---|---|---|---|---|
| **A8** | Tenant credentials are issued and **stored server-side** | R10 | gap `:577-578`; the browser-minted credential is `src/lib/client.ts:19-26`; the server-side registry exists (`src/lib/db/credentials.ts:62-165`) | The registry exists but is **dormant in production** (F7) and there is **no user-scoped issuance path** |
| **A9** | A rotation path exists **and has been exercised** | R10 | gap `:577-578`; `src/lib/db/credentials.ts:92-165` (old row revoked+rotated at `:120-127`, new row at `:147-152`) | Exercisable offline only via pglite; rotation is **total** — no overlap (`src/lib/db/identity.ts:160-162`) |
| **A10** | A revocation path exists and takes effect **without data loss** | R10 | gap `:578`; `src/lib/db/credentials.ts:62-88` (sets `revoked_at`, never deletes at `:70-73`) | Satisfied by the shipped code, but only on the Postgres path |
| **A11** | The repository's own security record no longer contradicts the shipped code | — | gap `:579`; `docs/validation/security-review.md:11` ("Bearer-style `x-workspace-key`"), `:17` ("Anonymous workspaces, no accounts/PII; demo data only"), `:19` ("Gate: acceptable for prototype deployment carrying non-sensitive data") | A documentation obligation **belonging to this ticket** — nothing else will do it |

### 2.3 Currency check of the gap audit's own evidence

The gap audit's evidence citations were written against commit `74072b0` (`docs/research/enterprise-gap-audit.md:5`). Re-checked at HEAD:

| Gap-audit citation | Line content at HEAD | Currency |
|---|---|---|
| G-1 evidence `src/lib/client.ts:10` | `const KEY_ITEM = "auditorai.workspace_key";` | **CURRENT** |
| G-1 evidence `src/lib/client.ts:22` | `k = crypto.randomUUID() + crypto.randomUUID().split("-")[0];` | **CURRENT** |
| G-1 evidence `src/lib/api.ts:59` | `{ error: "rate limit exceeded; retry shortly" },` | **STALE** — an unrelated rate-limit body. The substantive claim ("the server accepts it as proof of tenancy") now lives at `src/lib/api.ts:79-89` and `:113` |
| G-1 evidence `src/lib/persistence/issue-ledger.ts:49` | `issued_by: "auditor",` | **CURRENT** |
| G-5 evidence `src/lib/client.ts:10` | as above | **CURRENT** |
| G-5 evidence `src/lib/api.ts:30` | *(blank line)* | **STALE** — the header constant is now `src/lib/api.ts:31` (`WORKSPACE_HEADER = "x-workspace-key"`) |
| G-5 evidence `docs/validation/security-review.md:19` | `Gate: acceptable for prototype deployment carrying non-sensitive data.` | **CURRENT** |
| Area-1 body `src/lib/api.ts:56`, `:69` (`:75`, `:96`, `:106`) | rate-limit block / timing-safe compare | **STALE** — the boundary is now `src/lib/api.ts:79-89` |
| Area-1 `src/lib/client.ts:12` | `const AUDITOR_PSEUDONYM_ITEM = "auditorai.auditor_pseudonym";` | **CURRENT** |
| Area-1 ABSENCE record (`:85-98`) | no `user\|account\|seat\|invite\|session\|login\|signup\|sso` model in `src/` | **STILL CURRENT** — re-verified by direct grep over `src/**/*.ts(x)` |

**Consequence.** The gap audit's *facts* survive; four of its *citations* do not. The plan must not
quote `src/lib/api.ts:59` or `:30` as evidence. The gap audit itself is evidence-class 5
("docs … evidence intent, never a working control", `docs/research/enterprise-gap-audit.md:29`) — so
the acceptance criteria above must each be re-grounded on current `path:line`, which this document
does.

---

## 3. Hidden and adjacent requirements

What a paying firm's reviewer stops on that the ticket does not say. Status is my requirement
judgement, not a plan.

| # | Requirement | Status | Why / anchor |
|---|---|---|---|
| H1 | **A session exists and has a lifetime** (expiry + refresh + sign-out) | **IN-SCOPE** | Nothing in the repo has one; `requireWorkspace` resolves identity per request (`src/lib/api.ts:113`) with no state. Without it "sign-in" is not a thing. |
| H2 | **Invitation acceptance flow** — how an invited person becomes a Member | **IN-SCOPE** | R6 is enforced *at invite*; a seat that is never accepted either consumes a seat forever or is released — both are behaviour. `workspace_members` has no pending state (`supabase/migrations/0001_tenant_schema.sql:42-48`). |
| H3 | **Seat release** — a departing member frees a seat | **IN-SCOPE** | Otherwise a firm of 5 who loses 2 auditors has lost 40% of its licence. Requires the member-row lifecycle to be expressible. |
| H4 | **Removal of a user from a Workspace** | **IN-SCOPE** | `workspace_members_delete` exists (`supabase/migrations/0002_rls_policies.sql:83-85`) but is scoped to `subject_id = app_claim_subject()` — a member can delete **only their own** row. Removing *another* user is impossible under the app role (F2). |
| H5 | **Who owns a Workspace** (the only role allowed to invite) | **IN-SCOPE** | `workspaces` has no owner column (`supabase/migrations/0001_tenant_schema.sql:32-40`); `workspace_members.role` is free text defaulting to `'member'` with no enum (`:45`). Nobody can be given the authority to invite. |
| H6 | **Author/reviewer separation** | **OUT-OF-SCOPE** → no ticket exists; file one | The gap audit's area-1 bar demands it (`docs/research/enterprise-gap-audit.md:70-71`), but G-1's acceptance sketch does not and the ticket does not. `workspace_members.role` is the hook. |
| H7 | **Email verification** | **OUT-OF-SCOPE** → no ticket exists; file one | An unverified email is not a person a firm can invoice. Not in G-1's sketch. |
| H8 | **Password reset / account recovery** | **OUT-OF-SCOPE** → no ticket exists; file one | Not in the ticket body; a buyer's review stops on it. |
| H9 | **Account deletion / PII purge** | **NEEDS-DECISION** → operator decision **D3** | ADR-0009 already promises "retention TTL default 2 years, purge on auditor request" (`docs/adr/0009-candidate-outcome-logging.md:29-31`), and ADR-0009:4 keeps the real-identity mapping **outside** the log. #54 creates the first real user identity, so it decides whether a re-identifiable mapping exists at all. |
| H10 | **The legacy workspace-key path** — what actor id does it carry? | **NEEDS-DECISION** (§6) | Production runs it (`src/lib/db/config.ts:30-37`; `src/lib/db/identity.ts:129-131`), and its `TenantResolution` variant carries no subject (`src/lib/db/identity.ts:34-38`). G-1 forbids a constant actor (`:527-528`). The two cannot both hold on that path. |
| H11 | **The admin/dev console** (14 mutating routes) | **OUT-OF-SCOPE** as a feature; **IN-SCOPE** as a *scoping clause* | Deliberately not tenant-scoped (`src/app/api/dev/runs/[runId]/finish/route.ts:5-6`), writes under `devWorkspaceHash()` (`src/lib/devtab.ts:15-17`), and `requireAdmin` returns `{ ok: true }` with no subject (`src/lib/api.ts:47-71`). "Every mutation" must exclude these in writing. |
| H12 | **The append-only audit trail** | **OUT-OF-SCOPE** → **#55** | Tracker: `GH#55 … (G-3)`. Note the dependency: G-3's "each entry names a resolvable actor" (`docs/research/enterprise-gap-audit.md:552-553`) is *enabled* by #54's actor id — but #54 must not build the trail. |
| H13 | **Firm-facing audit export** | **OUT-OF-SCOPE** → **#55** | Same entry; G-3 acceptance `docs/research/enterprise-gap-audit.md:554`. |
| H14 | **Backups / PITR** | **OUT-OF-SCOPE** → **#56** | Tracker `GH#56 … (G-4)`. |
| H15 | **Schema validation at every trust boundary** | **OUT-OF-SCOPE** → **#46** | Tracker `GH#46 … (G-6)`. Note: #54 adds at least two new request bodies (invite, sign-in callback) which will be **unvalidated** — accepted, but it must be written down, not silently absorbed. |
| H16 | **Dependency inventory / scanning** | **OUT-OF-SCOPE** → **#47** | Tracker `GH#47 … (G-7)`. Consequence in F8: #54 lands unpinned/unaudited runtime dependencies. |
| H17 | **CSRF protection for the session cookie** | **IN-SCOPE** | A cookie-based session introduces CSRF where a bearer header today does not. No CSRF machinery exists in the repo. |
| H18 | **An existing workspace linked to a user account** ("claim your workspace") | **NEEDS-DECISION** (§4, A5) | The legacy workspace is anchored by `legacy_key_hash` (`supabase/migrations/0001_tenant_schema.sql:38`), a pure function of the namespace hash (`src/lib/db/migration.ts:20-22`, `:519-522`). A user id cannot be derived from it. |
| H19 | **A user in more than one Workspace** | **NEEDS-DECISION** | `workspace_members` PK is `(workspace_id, subject_id)` (`supabase/migrations/0001_tenant_schema.sql:47`) so multi-workspace is expressible, but the resolution path binds one credential to one workspace per request (`src/lib/db/identity.ts:186-191`). |
| H20 | **Email uniqueness across Workspaces** | **NEEDS-DECISION** | A Supabase auth user is global; the same person may be a member of two firms' workspaces. The seat count then double-counts or not, depending on §5's choice. |
| H21 | **The seat count is visible and settable by an owner** | **IN-SCOPE** (minimal) | "A seat count exists" (G-1 `:526`) is only meaningful if an owner can read it and change it. Both directions need a policy that today does not exist (F2, F3). |
| H22 | **The repo's own security record** | **IN-SCOPE** (A11) | `docs/validation/security-review.md:11`, `:17`, `:19` must stop saying "Bearer-style `x-workspace-key`" / "Anonymous workspaces, no accounts/PII" once #54 ships — and must not be updated *before* #54 ships, or they become false. |

---

## 4. Assumptions that must be tested

Each: the assumption → how a test would falsify it → the consequence if false. Tests marked
**(exists in this repo)** name a file already in the tree.

### A1 — Supabase Auth can be wired with **no build-time network dependency**

- **Assumption.** Importing and constructing the auth client never throws and never reaches the
  network when the env is unset, so `npm run build` succeeds with every variable unset.
- **Falsifier.** `npm run build` with an empty environment. The repo already guarantees this shape
  for its own accessors: "Every accessor reads the environment at CALL time: there is no import-time
  env read that throws and no import-time network call, so the build succeeds with every variable
  unset" (`src/lib/db/config.ts:4-6`, `:18-21`). A new `@supabase/ssr` / `@supabase/supabase-js`
  client constructed at module scope breaks that guarantee unless it is constructed lazily.
- **Consequence if false.** **The merge auto-deploys to production** (`supabase/README.md`, "The
  merge auto-deploys", `docs/deployment.md:5`). A build-time throw breaks the live MVP on merge, and
  the ticket's own "production behaviour unchanged" constraint (R13) fails at the deploy boundary
  rather than at the code boundary.
- **Also falsifiable by an existing test.** `vitest.config.ts:9-14` blanks `SUPABASE_URL`,
  `TENANT_POSTGRES_URL`, `TENANT_STORE` for **every** suite, so any module-level auth construction
  that throws will fail the whole suite. Existing file to extend: `tests/integration/database-not-configured.test.ts`.

### A2 — The actor id **can be resolved on the legacy path** (the path production runs)

- **Assumption.** Some non-constant actor id is available on a legacy (KV) request.
- **Falsifier (exists in this repo).** `tests/integration/tenant-store-cutover.test.ts:57-80` already
  asserts that with `TENANT_STORE` unset the legacy path serves; `src/lib/db/identity.ts:129-131`
  returns `{ mode: "legacy", legacyHash, reason: "not_configured" }` and the legacy variant of
  `TenantResolution` has **no subject field at all** (`src/lib/db/identity.ts:34-38`).
- **Consequence if false.** Every acceptance item A4/A5/A6 is unsatisfiable in production as
  shipped, and R13 ("production behaviour unchanged") collides head-on with G-1 ("non-constant actor
  id that resolves to a user", `:527-528`). This is the central unresolved conflict of the ticket.

### A3 — The seat count is **enforceable server-side** under the app role

- **Assumption.** The app can count members and refuse an over-limit invite using the
  `auditorai_app` role.
- **Falsifier (exists in this repo).** `tests/integration/tenant-rls.test.ts` boots pglite, applies
  every file in `supabase/migrations` in order (`:48-51`, `:83-90`), and runs statements as the
  non-bypass role. Two results falsify the assumption today:
  1. `select count(*) from workspace_members where workspace_id = $1` returns **only the caller's own
     row** — the select policy is `subject_id = app_claim_subject() and workspace_id =
     app_claim_workspace_id()` (`supabase/migrations/0002_rls_policies.sql:77-79`). The count is
     always 1 for the caller, never the workspace's size.
  2. Inserting a membership row for **another** subject fails — the insert policy is `with check
     (subject_id = public.app_claim_subject() and workspace_id = ...)` (`:80-82`).
  3. There is **no UPDATE policy on `workspace_members` at all** (`:76-85` creates only
     select/insert/delete), so "pending → accepted" and "seat released" are not expressible.
- **Consequence if false.** Seat enforcement needs either a new policy/`SECURITY DEFINER` function
  (a 4th operator-applied migration, `supabase/README.md:23-52`) or the service role
  (`src/lib/db/admin.ts:11-14`) — and the service role **voids the isolation guarantee**
  (`supabase/README.md`, "The role invariant"). The architect inherits a privilege decision, not a
  code change.

### A4 — `@supabase/supabase-js` / `@supabase/ssr` can be installed and pinned

- **Assumption.** The dependency can be added without breaking the offline test guarantee, the CI
  install, or the secret boundary.
- **Falsifier.** Two independent facts: (i) the registry **is** reachable from this box —
  `npm view @supabase/supabase-js version` → `2.118.0`, `npm view @supabase/ssr version` →
  `0.12.7`; but the box has **640 MB** of `node_modules` and **14 GB free at 98%** disk
  (`df -h`), and CI runs `npm ci` (`.github/workflows/ci.yml:18`, `:30`, `:44`, `:61`, `:73`,
  `:93`; `.github/workflows/ci-gates.yml:23`) which **fails unless `package.json` and
  `package-lock.json` are in sync** — so `package.json` without a lockfile update breaks every CI
  job. (ii) **`tests/integration/secret-boundary.test.ts`** (exists) will fail on the obvious
  approach: Rule 2 (`:158-164`) forbids **any** `NEXT_PUBLIC_SUPABASE_*` name outside the three
  allowed (`:53-57`), so the discovery's proposed `NEXT_PUBLIC_SUPABASE_AUTH_ENABLED` /
  `_GOOGLE_ENABLED` / `_MICROSOFT_ENABLED` names are violations as written; Rule 1 (`:148-152`)
  forbids a client module naming `SUPABASE_JWT_SECRET`; Rule 3 (`:153-157`) forbids a client module
  importing `src/lib/db/*`.
- **Consequence if false.** CI is red on the first push, or a client-side auth module silently
  widens the public-key surface the scanner exists to police.

### A5 — An existing workspace can be **linked** to a user account

- **Assumption.** A user who signs in can be attached to the workspace that already holds their data.
- **Falsifier (exists in this repo).** `tests/integration/kv-to-postgres-migration.test.ts` shows the
  linkage mechanism exactly: the workspace id is a **pure function of the legacy namespace hash**
  (`src/lib/db/migration.ts:20-22`), `workspaces.legacy_key_hash` is that hash
  (`supabase/migrations/0001_tenant_schema.sql:38`), and the membership row is created for the
  credential's synthetic subject `legacy:<hash>` (`src/lib/db/migration.ts:136-138`, `:491`, `:539-541`).
  Nothing in that chain produces a **user** id — the hash is one-way.
- **Consequence if false.** A user signs in, gets a brand-new empty Workspace, and sees none of
  their own work. Worse, the legacy data is still keyed `ws:<hash>:` (`src/lib/persistence/keys.ts:5-43`)
  and is now unreachable from the UI. For a paying firm this reads as **data loss**, and it is the
  single most likely first-day support ticket.

### A6 — The Supabase user id can serve as `workspace_members.subject_id` unchanged

- **Assumption.** A Supabase auth user id is an acceptable `sub` for the claim helpers and for the
  membership check.
- **Falsifier (exists in this repo).** `tests/integration/tenant-isolation.test.ts` and
  `tests/integration/tenant-rls.test.ts` prove the resolution path end to end; the membership
  check is a literal `where workspace_id = $1 and subject_id = $2` (`src/lib/db/identity.ts:170-172`)
  under the claim `{"sub":…,"workspace_id":…}` (`src/lib/db/identity.ts:43-45`, `:166-168`), and
  `app_claim_subject()` casts `sub` to text (`supabase/migrations/0002_rls_policies.sql:26`). A
  uuid passes; a **mismatched** id (e.g. an email, or a `sub` that is the *credential's* subject
  rather than the user's) makes every signed-in caller a non-member → HTTP 403
  (`src/lib/api.ts:160`).
- **Consequence if false.** Sign-in appears to work and then every tenant request 403s. A
  whole-product outage on the happy path.

### A7 — Absent Google/Microsoft provider configuration degrades to a plain state

- **Assumption.** An unconfigured provider produces a "sign-in not configured" notice rather than a
  thrown error or a 500.
- **Falsifier.** Not falsifiable offline — it needs a live Supabase project. The repo's precedent
  is the `database_not_configured` notice: one plain module, one wording function, one test
  (`src/lib/db-notice.ts:1-10`, `:52-69`; `tests/integration/database-not-configured.test.ts`).
- **Consequence if false.** The ticket's own stated degradation (orchestrator brief) is unproven,
  and the orchestrator's instruction "the operator configures the Google and Microsoft sign-in apps
  later" means the *default deployed state* is the degraded one — it must be the tested default.

### A8 — The issued record can carry an actor id **without breaking the restore path**

- **Assumption.** Widening `issued_by` and adding an actor field does not break restore.
- **Falsifier (exists in this repo).** `tests/domain/audit-issues.test.ts` exercises the ledger;
  the restore path compares the stored and restored issue **byte-for-byte** via
  `JSON.stringify(existing) === JSON.stringify(issue)` (`src/lib/persistence/issue-ledger.ts:114`)
  and raises `IssueRevisionConflictError` on any difference (`:117-119`).
- **Consequence if false.** A backup taken before #54 can no longer be restored — it raises a
  write-once conflict instead of skipping. That is a **recovery path silently broken** by a
  feature ticket, and it is invisible until the day it is needed.

---

## 5. The seat-count semantics decision

This is a requirements decision. Each choice below implies a different fulfilment story and breaks
different things. The plan cannot pick it; the operator or the domain owner must.

### 5.1 What counts against the limit

| Choice | Implies | What breaks |
|---|---|---|
| **S1 — active Members only** | A seat = a `workspace_members` row that has been accepted. The count equals the number of users who can sign in. | A firm that buys 10 seats and has 3 users cannot hold seats for 7 people who have not started yet; pre-hiring is penalised. Also, the "invite" moment consumes nothing, so a mass invitation does not need a seat limit — which arguably defeats "enforced at invite". |
| **S2 — invited-but-unaccepted only** | A seat = a pending invitation. | The actual users are unmetered: 50 accepted users behind 1 invitation is free usage. Needs an expiry clock and a reconciliation job. |
| **S3 — both (union)** — the standard commercial model | A seat = active member **+** pending invite. The count is `count(members) + count(pending)`. | Needs a pending state in `workspace_members` (a schema change: `supabase/migrations/0001_tenant_schema.sql:42-48` has no status column) **and** an expiry policy for abandoned invites, **and** the RLS fixes in §4/A3. Most correct, most work. |

**Grilling note.** R6 says the count is "enforced **at invite**". Under S1 the enforcement point is
meaningless (the invite consumes nothing); under S2 the enforced thing is the wrong thing; only
**S3** makes "enforced at invite" a coherent sentence. That is an argument for S3 — but it is the
operator's call, because S3 is also the option that costs the most to get wrong (an abandoned
invite holds a paid seat).

### 5.2 Where the count and the limit live

| Choice | Implies | What breaks |
|---|---|---|
| **C1 — a `seat_count` column on `workspaces`** | The limit is stored per workspace. Requires a **4th operator-applied migration** (`supabase/migrations/0004_*.sql`; the operator applies it by hand, `supabase/README.md:8-9`, `:23-52`). | **A privilege hole**: the `workspaces_update` policy is `using (id = app_claim_workspace_id())` with `with check (id = app_claim_workspace_id())` (`supabase/migrations/0002_rls_policies.sql:70-73`). Under the app role, **any member of a workspace can UPDATE that workspace row** — so any member can raise their own seat limit. The limit would be enforced by the party it constrains. |
| **C2 — derived: `count(members) [+ count(pending)]`** | No column, no migration, no drift between the limit and reality. But it needs the limit from somewhere → C2 needs C1 or C3 for the *limit*, and the *count* still needs the RLS fix (§4/A3). | The count is unreadable under the current select policy (`supabase/migrations/0002_rls_policies.sql:77-79`): a member sees only their own row. Needs a new policy, a `SECURITY DEFINER` count function, or the service role. |
| **C3 — a plan/entitlement elsewhere** | The commercially correct shape (per-plan seat allowance). | There is **no billing primitive at all** — the gap audit records the absence of any seat/subscription primitive (`docs/research/enterprise-gap-audit.md:100-107`), and no `stripe|subscription|billing` hit exists in `package.json` or `src/`. This is a new subsystem. |

**Grilling note.** C1 is the only one expressible with a single operator-applied migration, and it
ships the self-escalation hole of §5.2/C1 with it. C2+C1 is the cheapest coherent pair *if* the
update hole is closed (deny the app role updates to the limit column, or set it out of band).

### 5.3 Who may invite

| Choice | Implies | What breaks |
|---|---|---|
| **W1 — any Member** | `role` is decorative. | Any member can fill the workspace to its limit — the limit stops being a commercial control. |
| **W2 — a role on `workspace_members`** (`owner`/`admin`) | The natural fit: `role` already exists, free text, default `'member'` (`supabase/migrations/0001_tenant_schema.sql:45`). | There is **no owner**: `workspaces` has no owner column (`:32-40`), the role strings are unenumerated, `workspace_members` has **no UPDATE policy** (`supabase/migrations/0002_rls_policies.sql:76-85`) so a role cannot be changed, and the owner still cannot **read** the member list (`:77-79`) to see the count. W2 needs: a role vocabulary, an owner column or an owner rule, a member-list read path, and a role-update path. |
| **W3 — the operator only** | The service role provisions members (`src/lib/db/admin.ts:11-14`). | Not a product: a firm cannot onboard its own auditors. |

### 5.4 What happens at the limit

| Choice | Implies | What breaks |
|---|---|---|
| **L1 — refuse the invite** (typed error → HTTP status via `ERROR_TABLE`, `src/lib/api.ts:146-161`) | "Enforced" is literally true. | Needs a new error type in the house style (`src/lib/db/errors.ts:10-45`) and a redacted-vs-exposed message decision (`src/lib/api.ts:143`). |
| **L2 — queue / waitlist** | The invite is accepted and pending until a seat frees. | Needs a queue, an expiry, and an email — larger than the ticket. |
| **L3 — warn but allow** | "Enforced" is false. | Fails R6 and G-1's "enforced at a product surface" (`:526-527`). |

### 5.5 Does the operator admin bypass the limit?

This is the split between **entitlement** (how many seats a firm bought) and **enforcement** (how many
the app lets you use). It is the operator's commercial call — **decision D1** in §8.

- **O1 — the operator bypasses the limit** (the operator provisions seats; the app enforces the
  customer's own allowance). Implies the seat count is a *per-workspace allowance* that the operator
  sets, and enforcement is app-side. Requires C1/C3 and the update hole closed.
- **O2 — no bypass.** Implies the limit is purely a customer-side count and the operator has no
  runtime involvement at all — which makes "the operator creates the Supabase project and its keys"
  (ticket body) the *only* operator role, and makes seat provisioning a pure customer action.

**What each choice implies for the R-numbers.** S3+C1+C2+W2+L1+O1 fulfils R5 and R6 fully and R4/R7/R8
independently, and costs: 1 operator-applied migration, 1 new policy set, 1 invite surface, 1 accept
surface, and the actor-id work of §6. S1+C2+W1+L3+O2 fulfils R5 loosely and **fails** R6 outright.

---

## 6. The actor-id identity decision

### 6.1 Which id is "the actor's user id"?

| Choice | Implies | What breaks |
|---|---|---|
| **I1 — the Supabase user id used directly as `workspace_members.subject_id`** | Zero new schema: `subject_id` is `text` (`supabase/migrations/0001_tenant_schema.sql:45`) and the claim helper casts `sub` to text (`supabase/migrations/0002_rls_policies.sql:26`). The auth provider's uuid becomes the actor id in the audit record. | The provider's uuid is permanent in a permanently retained formal record (`CONTEXT.md:25-26`); it is not a stable human handle for the firm, and it makes "the real identity mapping lives outside the log" (`docs/adr/0009-candidate-outcome-logging.md:29-31`) hard to honour — the mapping is now *in* the record. |
| **I2 — an internal user row (mapping `supabase user id → internal user id`)** | The audit record carries an id the product owns: stable across provider changes, deletable, and able to carry the pseudonym mapping. | A new table + RLS policy + a migration (operator-applied) + a resolution step. More surface for the same requirement. |
| **I3 — reuse the existing `Subject`** | The glossary already says a Subject "is not yet an authenticated user — #54 supplies the named-user credential that makes it one" (`CONTEXT.md:270-272`). The minimal reading: `subject_id` becomes a user id. | Ties #54 to the Postgres path only: `subject_id` exists **only** in the Postgres branch of `TenantResolution` (`src/lib/db/identity.ts:33`, `:190`); the legacy branch has no subject (`:34-38`). |

**Grilling note.** I1 and I3 are the same decision wearing different names: "make `subject_id` a user
id". I2 is the only one that can carry the pseudonym mapping. The ticket does not choose, and the
choice has a different blast radius for §6.4.

### 6.2 What is the actor id on the legacy path, where no user exists?

Three readings, all bad in different ways:

- **L-a — there is no actor id on the legacy path**; `issued_by` becomes optional and legacy records
  keep the constant. Implies: G-1's A6 ("non-constant actor id that resolves to a user") is met on
  the Postgres path only, and the shipped product (legacy path) keeps a constant-signed record — the
  exact thing G-1 exists to stop (`docs/research/enterprise-gap-audit.md:522-524`: "every record is
  signed by a constant … leaves the firm's own professional liability attached to a record with no
  accountable author").
- **L-b — a synthetic non-constant id derived from the credential hash.** **The repo already has
  this convention**: `legacySubjectFor(hash)` → `legacy:<hash>`
  (`src/lib/db/migration.ts:136-138`), written as the workspace name, the membership subject and the
  credential subject (`:491`, `:521`, `:539-541`, `:559-561`). Using it satisfies "non-constant" and
  **fails** "resolves to a user". It is at least *honest*: `legacy:<hash>` says "an unattributed
  caller on this workspace" rather than pretending.
- **L-c — the legacy path refuses mutations** (reads only, or no actor ⇒ no write). Implies G-1 is
  fully met and **R13 is broken**: production would stop accepting writes the moment #54 merged.

**Correction to discovery.** The discovery report's finding #1 says the legacy variant "carries no
subject" — true of the *KV* branch (`src/lib/db/identity.ts:34-38`), but **incomplete**: the migrated
Postgres branch gives every legacy workspace a synthetic subject `legacy:<hash>`
(`src/lib/db/migration.ts:136-138`). There is therefore an existing, repo-sanctioned precedent for
"the actor id of a non-user caller", and it is a *third* concept between "constant" and "user".

### 6.3 What does an unauthenticated public route record?

Nothing — the three public routes mutate nothing (`src/app/api/jurisdictions/route.ts:6`,
`src/app/api/jurisdictions/[jur]/stages/route.ts:11`, `src/app/api/inputs/[jur]/route.ts:11`). But
**R7 must say so explicitly**, or the requirement is vacuously false on day one. If any public route
ever mutates, its actor id is by definition absent — the requirement needs a named third state
("unauthenticated") rather than a silent exception.

### 6.4 How do the current literal `"auditor"` and the ADR-0009 pseudonym interact?

Three distinct identity strings exist today, and they are not interchangeable:

1. **`"auditor"`** — the constant written into every issued record
   (`src/lib/persistence/issue-ledger.ts:49`, `src/lib/db/tenant-store.ts:220`), the DB column default
   (`supabase/migrations/0001_tenant_schema.sql:100`) and the backfill fallback
   (`src/lib/db/migration.ts:266`). It is a **type-level** constant: `issued_by: "auditor"`
   (`src/domain/types.ts:304`).
2. **The ADR-0009 pseudonym** — a *browser-self-asserted* string
   (`src/lib/client.ts:39-42`), defaulting to a **shared** value `"auditor-a1"`
   (`src/domain/outcome-contracts.ts:7`). Two different users share it. ADR-0009 §4 keeps the real
   identity mapping **outside** the log (`docs/adr/0009-candidate-outcome-logging.md:29-31`).
3. **`EvidenceOverride.auditor_pseudonym`** — a caller-supplied string in the request body, with the
   comment *"Named reviewer; a recorded claim (no account model exists)"*
   (`src/domain/types.ts:240-242`), validated for non-emptiness
   (`src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:86-101`) and **frozen into the
   issued record** as part of `AuditResult.evidence_override` (`src/domain/types.ts:295`,
   `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:132-140`).

**The collision that the ticket does not mention.** After #54, a frozen Audit Issue would carry
**both** the real actor user id (new) **and** a self-asserted pseudonym (the evidence override) — two
competing attributions on the one formal record a firm will show a regulator
(`CONTEXT.md:25-26`: "retained permanently as the formal record of what was reported"). A reviewer
reading `evidence_override.auditor_pseudonym` will read it as the reviewer. It is not. **A
precedence rule is required** (which field is the attribution, and what happens to the override's
pseudonym once a session exists).

**Can the pseudonym and the user id coexist on one record?** Technically yes — different fields.
Substantively, three sub-questions:
- On the **outcome log** (`state/candidate-outcomes/*.jsonl`, ADR-0009 §1) — **no**: ADR-0009 §1/§4
  make it a pseudonymous store and put the real mapping outside it
  (`docs/adr/0009-candidate-outcome-logging.md:18-20`, `:29-31`). Writing a user id there breaks the
  ADR. **OUT-OF-SCOPE** — but then the mapping must live somewhere, which is §8/D3.
- On the **issued record** — yes, but only with an explicit precedence rule (§6.4 above) and with the
  pseudonym's self-asserted nature stated on the record.
- On the **actor id itself** — no. The pseudonym is not an actor id: it is shared-by-default and
  unverified (`src/lib/client.ts:39-42`; `src/domain/outcome-contracts.ts:7`).

---

## 7. Risks and failure modes

Ranked by blast radius. Each: the concrete failure, then what it costs.

**K1 — The seat count is enforced by the party it constrains (or not at all).**
`workspaces_update` lets any member UPDATE their own workspace row
(`supabase/migrations/0002_rls_policies.sql:70-73`); `workspace_members_select` lets a member read
only their own membership row (`:77-79`); there is no `workspace_members` UPDATE policy (`:76-85`);
and the INSERT policy forbids inserting another subject (`:80-82`). Under the app role, a member can
therefore neither count the workspace nor invite anybody nor release a seat — but *can* raise a
`seat_count` column if one is added to `workspaces`. Blast radius: **the commercial control is
either decorative or absent**, and the failure is invisible until a firm notices it can buy 200
seats for the price of 10. Falsifiable by `tests/integration/tenant-rls.test.ts`.

**K2 — Sign-in works and every tenant request 403s.**
The membership check is `where workspace_id = $1 and subject_id = $2` under the claim
`{"sub":…}` (`src/lib/db/identity.ts:166-172`, `:43-45`); the credential binds a *subject*
(`src/lib/db/identity.ts:104`, `:190`). If the `sub` presented is not the id in
`workspace_members.subject_id`, every signed-in user is a non-member → 403
(`src/lib/api.ts:160`). Blast radius: **100% of tenant traffic, for all users, on the Postgres path**,
with a misleading error ("not a member") that sends the operator looking at RLS instead of at the
id mapping.

**K3 — A user signs in and sees an empty workspace (perceived data loss).**
The workspace is anchored by `legacy_key_hash` — a one-way hash of the namespace
(`supabase/migrations/0001_tenant_schema.sql:38`; `src/lib/db/migration.ts:20-22`, `:519-522`).
Nothing derives a user from it. Blast radius: **every existing user's first session**; and the
legacy data is still under `ws:<hash>:` (`src/lib/persistence/keys.ts:5-43`), unreachable from the UI.
This is the most likely first-day support ticket and the most expensive one to explain.

**K4 — The actor id has nowhere to go on the legacy path, so the shipped product still signs records
with a constant.** `TenantResolution`'s legacy variant has no subject
(`src/lib/db/identity.ts:34-38`), the legacy branch is production (`src/lib/db/config.ts:30-37`),
and G-1 forbids a constant (`:527-528`). Blast radius: **G-1 is closed on paper and open in the
deployed product** — exactly the "documented control that is not a working control" the gap audit
warns about (`docs/research/enterprise-gap-audit.md:29`).

**K5 — The frozen record's bytes change and the restore path starts raising conflicts.**
`src/lib/persistence/issue-ledger.ts:114` byte-compares stored vs restored issues; any difference
raises `IssueRevisionConflictError` (`:117-119`). Blast radius: **backups taken before #54 become
unrestorable**, and the failure surfaces during a data-loss incident — the worst possible moment.
Falsifiable by `tests/domain/audit-issues.test.ts`.

**K6 — A new `NEXT_PUBLIC_SUPABASE_*` env name breaks CI, or a client module leaks a secret name.**
Rule 2 of the scanner forbids any public Supabase name outside the three allowed
(`tests/integration/secret-boundary.test.ts:158-164`); Rule 1 forbids client modules naming
`SUPABASE_JWT_SECRET` (`:148-152`); Rule 3 forbids client modules importing `src/lib/db/*`
(`:153-157`). Blast radius: **CI red on first push** (cheap), or a secret name in a client bundle
(expensive). The scanner is not vacuous — it has a negative control
(`tests/integration/secret-boundary.test.ts:204-229`).

**K7 — CI install breaks because the lockfile was not updated with the dependency.**
`npm ci` fails when `package.json` and `package-lock.json` disagree; every workflow uses `npm ci`
(`.github/workflows/ci.yml:18`, `:30`, `:44`, `:61`, `:73`, `:93`). Blast radius: **all CI jobs, every
push** until the lockfile is regenerated.

**K8 — The seat/invite surfaces land with no schema validation.**
#46 (G-6) is out of scope, but #54 adds new request bodies (invite, accept, session callback) that
will be hand-checked. Blast radius: **whatever the invite body accepts** — the blast radius is the
membership table and the seat count.

**K9 — Google/Microsoft sign-in ships enabled and errors at click time.**
The operator configures the apps later (orchestrator brief); if the code path exists but the provider
is unconfigured, Supabase returns an error the app must translate into the plain "not configured"
notice. Blast radius: **a broken button on the sign-in page**, on the surface the ticket names first.

**K10 — The pseudo-attribution and the real attribution disagree on a formal record.**
`EvidenceOverride.auditor_pseudonym` is frozen into the issued record
(`src/domain/types.ts:295`; `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:132-140`)
and reads like the reviewer. Blast radius: **a document given to a regulator names the wrong person**
— a professional-liability event, which is the exact harm G-1 exists to stop
(`docs/research/enterprise-gap-audit.md:522-524`).

**K11 — The security record is updated before the code is deployed (or never).**
`docs/validation/security-review.md:11`, `:17`, `:19` still describe a bearer-key, anonymous,
demo-data system (A11). Blast radius: **a buyer's review reads a record that contradicts the code**
(G-5 `:579`) — the requirement fails on a document, which is cheap to fix and easy to forget.

**K12 — Historical rows cannot be re-attributed.**
Backfilled rows carry `"auditor"` (`src/lib/db/migration.ts:266`) and issued rows are write-once
(ADR-0004; `src/lib/persistence/issue-ledger.ts:41-45`). Blast radius: **every pre-#54 record stays
unattributed forever**; any claim of "every issued record names a user" must be scoped to
records issued after cutover.

---

## 8. Decisions needed from the operator

Exactly three. Everything else in this document is the architect's or the planner's job, and every
item I judged resolvable from the repository is listed in §8.2 with its citation.

### D1 — Seat entitlement: who sets the seat count, and does the operator admin bypass the limit?

- **Authority needed:** product/commercial owner (the operator sells seats per the destination bar,
  `docs/research/enterprise-gap-audit.md:8-9`) — **not** the architect.
- **The question.** (a) Is the seat count a per-Workspace allowance the **operator** provisions
  (service-role/admin path, `src/lib/db/admin.ts:11-14`), or a customer-set number the app
  enforces? (b) Does the operator admin bypass the limit (O1) or not (O2)? (c) What is the default
  seat count for a new Workspace? (d) Does a pending, unaccepted invitation consume a seat (S1/S2/S3)?
- **Why it cannot be resolved from the repo.** `docs/research/enterprise-gap-audit.md:83` records
  that "the map's 'workspaces' (an organisation a firm buys seats for) does not exist in code", and
  `:100-107` records the absence of any seat/subscription primitive. Nothing in `CONTEXT.md` defines
  a seat or an entitlement. The commercial model is not in the repository.
- **What it unblocks.** §5 entirely (the count semantics), and the choice between a stored allowance
  (C1) and a derived count (C2).

### D2 — Email sign-in mechanism, and the mail delivery path

- **Authority needed:** product owner (which mechanism) **and** operator (credential provisioning
  and cost — a Supabase project's built-in SMTP is heavily rate-limited, and a production-grade
  sender is a provider credential the agent may not create: `supabase/README.md:8-9`).
- **The question.** Is "email sign-in" **password**, **magic link**, or **OTP**? And if magic link or
  OTP: does the operator provision an SMTP provider (and accept its cost) before the feature is
  usable, or does the product ship with Supabase's rate-limited default?
- **Why it cannot be resolved from the repo.** The ticket says only "email"
  (`docs/research/enterprise-gap-audit.md:526` gives no mechanism either). R1 is untestable until
  the mechanism is named, and the *deliverability* of the flow is an operator-owned dependency that
  no test can satisfy.
- **What it unblocks.** R1's acceptance shape, R2/R3's callback surfaces, and whether H7 (email
  verification) and H8 (password reset) become in-scope consequences of the chosen mechanism.

### D3 — Does a re-identifiable mapping (user id ↔ ADR-0009 pseudonym) exist, and who may use it?

- **Authority needed:** compliance/business owner (a Canadian firm buying seats is subject to
  PIPEDA-style obligations) plus the operator for the deletion path.
- **The question.** ADR-0009 §4 promises "retention TTL default 2 years, purge on auditor request"
  and keeps "real identity mapping … outside the log"
  (`docs/adr/0009-candidate-outcome-logging.md:29-31`). #54 creates the first real user identity, so
  it decides whether: (a) a mapping table exists at all — if yes, it is a new PII store with its own
  RLS, migration and retention; (b) if no, the purge promise is fulfilled only by pseudonym, and a
  user cannot be purged from the outcome log by identity; (c) who may exercise re-identification, and
  is it recorded.
- **Why it cannot be resolved from the repo.** ADR-0009 states the promise but not the holder of the
  mapping; `CONTEXT.md` defines no user, seat or PII term. It is a liability position, not a code
  fact.
- **What it unblocks.** H9 (account deletion), the choice I1-vs-I2 in §6.1 (only I2 can carry the
  mapping), and whether #54 owns a PII store or explicitly does not.

### 8.2 RESOLVABLE-BY-EVIDENCE — dropped from the operator list

| Question | Resolution | Citation |
|---|---|---|
| Does #54 own G-2 (server-derived tenant identity)? | **Yes** — "remains open until #54" | `CONTEXT.md:283-288`; `docs/glossary.md:16` (tracker index says #50 — reconcile the ticket text) |
| Must the legacy wire tokens keep their names and meaning? | **Yes** | `CONTEXT.md:278-281`; `docs/glossary.md:15` |
| Must the issued record stay write-once after the actor change? | **Yes** | `CONTEXT.md:25-26`; ADR-0004; `src/lib/persistence/issue-ledger.ts:41-45` |
| May the actor id be a constant? | **No** | `docs/research/enterprise-gap-audit.md:527-528` (G-1 A6) |
| Must the "not configured" state be a plain notice, not an outage? | **Yes** | `src/lib/api.ts:107-110`; `src/lib/db-notice.ts:1-10`; `tests/integration/database-not-configured.test.ts` |
| May the agent create accounts / handle secrets / apply SQL? | **No** | ticket body; `supabase/README.md:8-9`; `tests/integration/secret-boundary.test.ts:34-38`, `:146-175` |
| Must `TENANT_STORE` remain the cutover switch? | **Yes** | `src/lib/db/config.ts:23-37`; `supabase/README.md` (operator procedure) |
| Is the "not a member" denial 403 and redacted? | **Yes** | `src/lib/api.ts:160`; `src/lib/db/errors.ts:31-36` |

---

## 9. Recommended scope for the plan

The smallest set of R-numbers that delivers the ticket's stated value **with production behaviour
unchanged** (R13), and the R-numbers explicitly deferred.

### 9.1 IN — the minimum that delivers the ticket's value

| R | Why it is in |
|---|---|
| **R1** | "Sign-in with email" is the ticket's first sentence. Without it there is no user to be the actor. |
| **R2, R3** | The ticket names three methods. The *degrading* half is explicitly required by the orchestrator brief and is the default deployed state; R2/R3 are cheap once R1's surface exists. |
| **R4** | The hinge of the whole ticket: a resolvable **user** identity distinct from the workspace key (`CONTEXT.md:270-272`). |
| **R7, R8** | "Every mutation and issued record carries the actor's user id" — the ticket's third sentence, and the gap-audit's band-1 blocker (`docs/research/enterprise-gap-audit.md:522-524`). |
| **R9** | Explicit in G-1 (`:528`). Non-negotiable — the issued record is the firm's formal record (`CONTEXT.md:25-26`). |
| **R10** | The ticket's fourth sentence, and G-5's rotation+revocation acceptance (`:577-579`). |
| **R11, R12** | The ticket's operational constraints; R12 is also the cheapest possible acceptance test (`grep` of `.env.example` vs the accessors). |
| **R13** | The orchestrator's hard constraint. |
| **A11** | G-5's last clause (`:579`) — a documentation obligation with no code. Cheap, and it is *in* this ticket by the gap audit's own words. |

### 9.2 CONDITIONAL — in only if the corresponding decision lands

| R | Condition |
|---|---|
| **R5, R6** (seat count) | Only if **D1** lands. These carry K1 (the privilege hole) and the migration dependency. If D1 does not land in time, R5/R6 are the correct things to defer — they are a *commercial* control, not the *identity* control, and the ticket's own blocker (a record signed by a constant) is R7/R8. |

### 9.3 OUT — explicitly deferred, and to where

| R / requirement | Deferred to |
|---|---|
| H2 invitation acceptance flow (beyond the seat check) | Follow the seat decision; if D1 is deferred, H2 goes with it |
| H6 author/reviewer separation | **new ticket** (none exists) — gap-audit area-1 bar only (`docs/research/enterprise-gap-audit.md:70-71`) |
| H7 email verification, H8 password reset | **new ticket** (none exists) |
| H9 account deletion / PII purge | Blocked on **D3**; then a new ticket (or #54 if D3 says it is in) |
| H12 audit trail, H13 firm-facing export | **#55** (G-3) |
| H14 backups / PITR | **#56** (G-4) |
| H15 schema validation at trust boundaries | **#46** (G-6) — but #54's own new bodies must not be *new* exceptions |
| H16 dependency inventory / scanning | **#47** (G-7) — #54 must still pin and lock its new dependency (K7) |
| H13/H12 exports, WorkOS SSO | **#41** (parent map, "Decided so far") |
| The dev console (14 routes) as an *authenticated* surface | **out of scope** — it is deliberately not tenant-scoped (`src/app/api/dev/runs/[runId]/finish/route.ts:5-6`); R7 must scope it out in writing |

### 9.4 The plan's first three questions (not answers — questions)

1. **Which actor-id reading** (§6.1) and **which legacy-path actor** (§6.2, L-a/L-b/L-c)? R7/R8 are
   unimplementable until both are chosen, and R13 collides with L-c.
2. **Which env names** — noting that Rule 2 of `tests/integration/secret-boundary.test.ts:158-164`
   forbids new `NEXT_PUBLIC_SUPABASE_*` names, so the discovery's proposed
   `NEXT_PUBLIC_SUPABASE_AUTH_*` set is not admissible without editing that scanner.
3. **Does R5/R6 land this ticket** (D1) — and if yes, which §5 combination, given that `workspaces`
   has no seat column (`supabase/migrations/0001_tenant_schema.sql:32-40`), `workspace_members` has no
   pending state (`:42-48`) and no UPDATE policy
   (`supabase/migrations/0002_rls_policies.sql:76-85`), and any new migration is operator-applied
   (`supabase/README.md:8-9`).

---

## Appendix — corrections to the discovery report

| # | Discovery claim | Verdict |
|---|---|---|
| 1 | "No actor id exists on the live path… the legacy `TenantResolution` variant carries no subject (`src/lib/db/identity.ts:34-38`)" | **Incomplete.** True of the KV branch, but the migrated Postgres branch assigns every legacy workspace a synthetic subject `legacy:<hash>` (`src/lib/db/migration.ts:136-138`, `:491`, `:539-541`). There is already a precedent for "the actor id of a non-user caller", and it is not one of the three options discovery named. |
| 2 | "The RLS policy blocks the invite a seat count needs (`supabase/migrations/0002_rls_policies.sql:80-82`)" | **Understated.** The INSERT policy is only one of three blockers: the SELECT policy prevents counting members (`:77-79`), there is no UPDATE policy on `workspace_members` (`:76-85`), and the `workspaces_update` policy lets any member edit their own workspace row (`:70-73`). |
| 3 | "Rotatable, revocable credentials maps onto a credential object, not a session" | **Correct, and stronger than stated**: `CONTEXT.md:274-276` defines **Credential** exactly as the ticket's phrase and explicitly separates it from a user ("Subject — … not yet an authenticated user — #54 supplies the named-user credential", `:270-272`). The glossary, not the discovery, is the authority. |
| 4 | "No `@supabase/supabase-js`, no `@supabase/ssr`, no JWT library installed; no `middleware.ts`" | **Confirmed** (`package.json:26-33`; no `middleware.ts` at repo root, `src/`, or `src/app/`). Added: the registry is reachable (`npm view @supabase/supabase-js version` → `2.118.0`), but `npm ci` requires a lockfile sync and Rule 2 of `tests/integration/secret-boundary.test.ts:158-164` forbids new `NEXT_PUBLIC_SUPABASE_*` names. |
| 5 | "The actor id must enter through the repository seam… `AuditIssue.issued_by` is the literal type `"auditor"`" | **Confirmed** (`src/domain/types.ts:304`; written at `src/lib/persistence/issue-ledger.ts:49` and `src/lib/db/tenant-store.ts:220`; default `supabase/migrations/0001_tenant_schema.sql:100`; backfill `src/lib/db/migration.ts:266`; byte-compare on restore `src/lib/persistence/issue-ledger.ts:114`). **Added:** three test files carry the literal and will fail to compile — `tests/domain/audit-workspace.test.ts:77`, `tests/integration/kv-to-postgres-migration.test.ts:103` and `:464`. |
| 6 | (not in discovery) | **The frozen record already carries a second, self-asserted attribution** — `EvidenceOverride.auditor_pseudonym`, frozen into the issue (`src/domain/types.ts:240-242`, `:295`; `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:132-140`). A precedence rule is required (K10). |
| 7 | (not in discovery) | **The gap audit's own `src/lib/api.ts` citations are stale** (`:30`, `:56`, `:59`, `:69`) — re-ground them (K-table in §2.3). |
| 8 | (not in discovery) | **The ticket's scope contradicts the tracker index about G-2.** `CONTEXT.md:283-288` and `docs/glossary.md:16` say G-2 stays open "until #54"; `.autoforge/discovery/tracker-index-t54.md:8` gives G-2 to #50 and `:11` gives #54 only G-1+G-5. Reconciled in favour of `CONTEXT.md` (§0). |
| 9 | (not in discovery) | **The discovery's proposed env names would fail an existing repo test** — `tests/integration/secret-boundary.test.ts:158-164` (Rule 2). |

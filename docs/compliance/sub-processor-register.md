# Sub-processor register

**Scope:** every third party that can receive customer data in the current
architecture, with the region each one is pinned to — or, where the region is
not pinned, that fact stated plainly rather than guessed.

**Owner:** the operator. The commercial ruling on the model gateway is theirs
(see *Escalation* below); this register records what the code does and what is
not yet known.

**Customer data** — a workspace's project inputs, drawings, attachments, audit
results and artifacts.

## Vocabulary

In this register, the ticket's **Workspace** is exactly one row of
`public.workspaces` in the tenant store, and that row is exactly what
`docs/research/enterprise-gap-audit.md` calls a **tenant**. The equivalence is
stated once, here; the other documents of this set do not restate it.

## Sub-processors

| Processor | Purpose | Data categories | Region | Transfer note |
|---|---|---|---|---|
| **Vercel** (Hobby free tier — ADR-0001) | Hosts and serves the Next.js application; runs the server routes that read and write tenant data | Application code and build output; request and response bodies (project inputs, drawings, audit results); server logs and deployment metadata | `iad1` — pinned in `docs/deployment.md:5` | US hosting region. Tenant data crosses to the US on every request; the deployment region is not restricted to Canada. |
| **Upstash / Vercel KV** (current tenant store) | The KV store the tenant repository writes to — `KvRestStore` over the REST protocol (`src/lib/persistence/store.ts:86`); also holds the non-tenant discovery namespace | Project inputs, audit results, issue revisions, artifact trails, attachment payloads (inline data-URLs), discovery ledger and queue state | **Not pinned** — no region fact for the KV endpoint exists anywhere in the repository (free tier, region not recorded) | Not attested for Canadian residency: the endpoint's region is unknown from the repository. Migrated workspaces leave it; unmigrated workspaces and the discovery subsystem stay on it. |
| **Supabase** (new tenant store) | The tenant store: Postgres with row-level security enabled and forced on all nine tenant tables, reached as the non-bypass `auditorai_app` role | Workspaces, memberships, hashed credential records, projects, audits, issues, attachments, artifacts, artifact summaries | `ca-central-1` — pinned in `supabase/migrations/0001_tenant_schema.sql:1` and as the `workspaces.region` default (`supabase/migrations/0001_tenant_schema.sql:34`) | Tenant data stays in Canada under the operator's Supabase project. The region is a property of the project the operator creates — the application code cannot enforce it. |
| **OpenCode Zen** (model gateway) | The optional LLM adapter behind the `AiAdapter` seam — `ZenAiAdapter`, base URL default `https://opencode.ai/zen/v1` (`src/lib/ai.ts:75`); OFF by default | Project inputs and drawings transmitted as model prompts; bounded candidate findings, rationales and evidence summaries come back | **UNVERIFIED** — no service was contacted from this worktree, so no region is confirmed | Unknown until the operator rules. If the AI gate is open in Production (see below), project material leaves the deployment for this gateway. |

### Not customer-data processors (recorded so the omission is deliberate)

- **Discovery search providers** (e.g. Brave Search, `src/discovery/providers/brave-search.ts:46`)
  receive search queries built from ODD-cell topics. They receive no tenant data.
- **Any OpenAI-compatible endpoint set in `AI_BASE_URL` / `AI_FALLBACK_BASE_URL`**
  (`.env.example:11,16`) becomes an additional processor that this register
  cannot name. The base URL is operator-configurable; the register lists the
  default only.

## AI gateway — interim posture (ticket #53)

**The AI path is controlled by environment only, and #53 adds no enforcement of
any kind to it.** The one control that exists is the existing environment gate:
the adapter resolves to the live Zen adapter only when `AI_ENABLED=true` **and**
`OPENCODE_API_KEY` is set (`src/lib/ai.ts:674-677`); otherwise it resolves to the
offline adapter. There is no per-tenant flag, no allow-list, no region check and
no record of what left the deployment.

**The consequence is plain:** when both variables are set, project inputs and
drawings are transmitted to the OpenCode Zen gateway (base URL default
`https://opencode.ai/zen/v1`, `src/lib/ai.ts:75`; transmission at
`src/lib/inference.ts:70` and `src/lib/inference.ts:114`).

**Interim posture:** until the operator rules, `AI_ENABLED` and
`OPENCODE_API_KEY` **must remain unset in Production**. That is a condition the
operator holds, not a guarantee the code provides.

**The gateway's data-handling region is UNVERIFIED.** No service was contacted
from this worktree, so no region and no sub-processor terms are confirmed. This
register does **not** assert that tenant data cannot reach the gateway; it
states what the code does, what the operator must hold, and what is not yet
known.

## What ticket #53 does not close

**G-2 remains open.** The browser still mints the workspace key itself —
`crypto.randomUUID()` twice, stored client-side under `auditorai.workspace_key`
(`src/lib/client.ts:19-26`) — and the server still derives the tenant from the
presented key. The gap audit's G-2 requirement, *"the server derives tenant
identity from something the client cannot mint"*, **remains open** and is **not
closed** by this ticket; it is the work of #54 (a named-user credential). #53
adds the credential registry — rotatable and revocable, never deleting tenant
data — but it does not change the client credential path.

The legacy wire tokens are unchanged and are not renamed: the KV namespace
prefix `ws:<hash>`, the request header `x-workspace-key` and the browser
storage item `auditorai.workspace_key` keep their names and their meaning.

## Escalation

**QUESTION-1 (open operator ruling).** May the AI path carry customer data to
the OpenCode Zen gateway, and under what sub-processor terms? The options are
(A) no, (B) yes under the terms recorded here, (C) yes but only for
non-customer data. This is a commercial decision that no agent can bind — see
`.autoforge/plans/plan-t53.md` §7.3 and §7.5 (escalation list) and
`.autoforge/requirements/grilling-t53.md` §G.1. Until it is answered, the
interim posture above stands.

**ACTION-1 (operator action, not a question).** Apply
`supabase/migrations/0001` → `0002` → `0003` to the live project and repoint
`POSTGRES_URL` at the `auditorai_app` role **before** the merge reaches
Production (the merge auto-deploys). Procedure:
[`supabase/README.md`](../../supabase/README.md); ordering:
[`docs/deployment.md`](../deployment.md).

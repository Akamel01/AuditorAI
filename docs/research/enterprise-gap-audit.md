# Enterprise-readiness gap audit of AuditorAI — 21 October 2026

**Ticket:** `Akamel01/AuditorAI#42` — Research: enterprise-readiness gap audit of AuditorAI today.
**Parent map:** `Akamel01/AuditorAI#41` — Map: AuditorAI to enterprise production — Canada first.
**Audit date:** 2026-10-21. **Commit audited:** `74072b0b3b437c658a7a74cae4c9529d9228b318` (branch `oc/42`, cut from `main`).
**Method:** read-only inspection of the repository at that commit. No production code was changed. Nothing outside this document was written.

**Destination used as the bar** (from #41): AuditorAI sold as paid seats to road-safety audit firms with
enterprise-level completeness and performance — accounts, workspaces and roles; per-tenant data
isolation; an immutable audit trail tying every finding to its evidence; claims bounded by the ODD
matrix; production SLOs, backups and incident runbooks; and the security controls an enterprise
buyer's review expects. Canada first, then the UK and US, then the UAE. Final professional
responsibility stays with the qualified auditor; the product never claims otherwise.

---

## How to read this document

**Verdicts.** Exactly one verdict per area: `yes`, `partly` or `no`. `partly` always carries a
qualifier — `(below bar)`, `(subset)` or `(internal-only)` — naming which clause of the area's bar
fails, which subset is excluded, or which internal surface holds the control. An area that cannot be
assessed is `no`: absence of evidence is absence of a control.

**Evidence classes, in descending authority.** (1) a live deployed surface, admissible only where a
check is recorded below; (2) production-reachable code — a `file:line` a request can actually reach;
(3) an automated test, which corroborates but never substitutes for code; (4) configuration, schema
or policy, which evidences a *declared* control only; (5) docs, ADRs and validation records, which
evidence intent or a claim the repository makes about itself, never a working control. A document
citation is tagged `[intent]` or `[claim]`.

**Not production-reachable.** `src/app/dev/**` and `src/app/api/dev/**` are an internal console
behind one shared `ADMIN_KEY`; `scripts/**`, `state/**`, `vault/**` and `.autoforge/**` are
developer tooling and internal records. A control that exists only on those surfaces is at best
`partly (internal-only)`, and never `yes`.

**Absence** is a positive claim and is cited with two independent searches — one by concept, one by
structure — plus the nearest miss:

```
ABSENCE: <what is missing> — no match for <concept pattern> under <searched paths>
  (search 1: `<concept search>` → 0 hits; search 2: `<structural search>` → 0 files)
  nearest miss: <file:line> provides <partial capability> but not <the missing part>
```

**Live check record** (read-only `GET`s; no credentials, no writes, no repeated probing; performed
2026-10-21T11:14:13Z–2026-10-21T11:14:15Z):

| UTC timestamp | Method + path | Status |
|---|---|---|
| 2026-10-21T11:14:13Z | `GET https://auditorai-gamma.vercel.app/` | 200 |
| 2026-10-21T11:14:14Z | `GET https://auditorai-gamma.vercel.app/api/jurisdictions` | 200 |
| 2026-10-21T11:14:14Z | `GET https://auditorai-gamma.vercel.app/api/projects` (no credential) | 401 |
| 2026-10-21T11:14:14Z | `GET https://auditorai-gamma.vercel.app/api/dev/health` (no credential) | 401 |
| 2026-10-21T11:14:15Z | `GET https://auditorai-auditor-ai1.vercel.app/` | 200 |

These establish that the deployed MVP answers, that a workspace-protected route rejects an
unauthenticated request with 401, and that the dev health surface is not public. They do **not**
establish that any control works end to end in the deployed MVP, and no such claim is made below.

**Scope.** This document audits the product. It is not legal advice, and it asserts no legal
requirement. It proposes no infrastructure design: it names the missing control, not a vendor or an
architecture. It does not restate road-safety-audit practice from `docs/research/`.

---

## 1. accounts and roles

Verdict: no

**What the bar needs.** Named users, a seat count, at least an author/reviewer separation, and an
actor identity on every mutation.

**What exists.** The only identity in the product is a bearer key the browser mints for itself and
keeps in `localStorage` (`src/lib/client.ts:10`, `src/lib/client.ts:22`); the server accepts it as
proof of tenancy (`src/lib/api.ts:59`, `src/lib/api.ts:69`). A display label for outcome logging
exists separately (`src/lib/client.ts:12`) and is a pseudonym, not an account. The `role` strings
in the codebase are LLM message roles and document-classification roles, never user roles
(`src/lib/ai.ts:287`, `src/lib/eval-run.ts:180`, `src/discovery/classifier.ts:24`). Issued records carry a constant actor:
`src/lib/persistence/issue-ledger.ts:49` writes `issued_by: "auditor"`.

**Note on vocabulary.** "Workspace" means three different things in this repository — the tenant-ish
key namespace, the browser bearer key, and the *Audit Workspace* working set of `CONTEXT.md`. The
map's "workspaces" (an organisation a firm buys seats for) does not exist in code.

```
ABSENCE: named user accounts, seats, invitations, roles and sessions — no match for
  \b(user|account|seat|invite|invitation|session|login|signup|sso)\b under src/
  (search 1: `rg -n -i "\b(user|account|seat|invite|invitation|session|login|signup|ssow|sso)\b" src/`
   → 0 hits for an account model; every hit is incidental — a URL filter in
   src/discovery/qualifier.ts:27, a keychain account parameter in src/discovery/keychain.ts:17,
   "road user" vocabulary, or an LLM message role; search 2:
   `find src -type d \( -name auth -o -name users -o -name accounts -o -name sessions -o -name billing
   -o -name tenants -o -name orgs \)` and
   `find src -type f \( -name "auth*" -o -name "user*" -o -name "session*" -o -name "tenant*" -o -name "seat*" \)`
   → 0 files)
  nearest miss: src/lib/api.ts:56 establishes a *workspace* boundary, and
  src/lib/client.ts:12 stores an auditor pseudonym — neither is an account, a seat, or a role.
```

Also absent: any seat or subscription primitive.

```
ABSENCE: seat counting and commercial entitlement — no match for (stripe|subscription|billing) under src/
  (search 1: `rg -ln "stripe|subscription|billing" package.json src/` → 0 hits; search 2:
   `find src -type d -name "billing"` → 0 files)
  nearest miss: src/lib/api.ts:56 rate-limits per workspace key, which bounds usage but records no
  named user and no seat.
```

---

## 2. tenant isolation

Verdict: partly (below bar)

**What the bar needs.** Isolation enforced server-side, non-bypassable, tested, and survivable
against credential compromise.

**What exists.** Every workspace-scoped product route authenticates server-side through one helper
(`src/lib/api.ts:56`), and the key's SHA-256 prefix becomes the storage namespace
(`src/lib/persistence/store.ts:236`, `src/lib/persistence/keys.ts:5`). The failing clause is
**server-established identity**: the credential is minted by the browser
(`src/lib/client.ts:22`), hashed into the namespace at `src/lib/api.ts:69`, and the credential
*is* the tenant. It is client-supplied, never rotated and never revoked, and it grants total access
to that tenant's records once leaked. Namespacing is not authorisation. No cross-tenant
read/write isolation test exists; the only negative-tenant assertion in the suite covers restore.

```
ABSENCE: a test proving one tenant cannot read another's records — no match for
  (cross-tenant|tenantIsolation|otherWorkspace|workspaceB) under src/ and tests/
  (search 1: `rg -n -i "cross-tenant|tenantIsolation|otherWorkspace|workspaceB|workspace_b" src/ tests/`
   → 0 hits; search 2: `find tests src -type f \( -name "*tenant*" -o -name "*isolation*" \)` → 0 files)
  nearest miss: tests/domain/retention-policy.test.ts:169 asserts that a restore from one workspace
  into another is rejected — the only negative-tenant assertion in the suite, and it covers restore,
  not reads or writes.
```

**Deployment evidence.** The live check above shows an unauthenticated `GET /api/projects` returns
401 (`2026-10-21T11:14:14Z`). That 401 is produced by `requireWorkspace` inside the route handler
(`src/lib/api.ts:56`); the repository has no middleware, so this is route-level enforcement, not
edge enforcement.

---

## 3. audit trail

Verdict: partly (below bar)

**What the bar needs.** Durable, append-only, actor-attributed, tamper-evident, exportable.

**What exists.** Three partial records, each failing a different clause:

- **Issued revisions are write-once and never purged** — `src/lib/persistence/issue-ledger.ts:74`
  documents that the class exposes no delete API. That is the strongest single control in the area.
- **Actor attribution is a constant** — `src/lib/persistence/issue-ledger.ts:49` writes
  `issued_by: "auditor"`, so the frozen record names no person.
- **The artifact trail is pruned on rerun** — `src/lib/persistence/artifact-trail.ts:39` calls
  `src/lib/persistence/artifact-trail.ts:87`, keeping the latest trail plus a summary.
- **The candidate outcome log lives on local disk** — `src/domain/outcomes.ts:22` points at
  `state/candidate-outcomes/`, which is gitignored (`.gitignore:49`) and therefore ephemeral on a
  serverless deployment.

Write-once storage is not tamper-evidence: nothing chains or hashes revisions, so an operator with
store access can overwrite a key without leaving a trace.

```
ABSENCE: a tamper-evident or chained audit log, and an export a firm can take away — no match for
  (audit_log|auditlog|prev_hash|hash_chain|merkle) under src/
  (search 1: `rg -ln "audit_log|auditlog|prev_hash|hash_chain|merkle" src/` → 0 hits; search 2:
   `find src -type f -iname "*audit*"` → 2 files, src/domain/audit-workspace.ts and
   src/domain/pipeline/nodes/evidence-use-audit.ts — the per-audit working set and a pipeline node,
   neither of which is an audit log)
  nearest miss: src/domain/audit-workspace.ts:1 describes the "audit workspace" working set, and
  src/lib/persistence/issue-ledger.ts:80 exports issue lineage and
  src/lib/persistence/issue-ledger.ts:98 restores it — a class-level export, exercised only by a test
  (tests/domain/retention-policy.test.ts:143) and never exposed on a product route.
```

**Out of scope, stated explicitly:** `state/discovery-ledger.json`, `state/decision-registry.json`,
`state/agent-registry.json`, `state/artifact-registry.json` and `vault/**` are internal records of
how the product and its corpus were built. They are not a firm's audit trail. The repository's own
vocabulary is narrower than the destination's: "immutable" here means write-once numbered revisions
(`PRODUCT.md:29` `[intent]`), which is not the map's "immutable audit trail tying every finding to
its evidence".

---

## 4. evidence grounding

Verdict: partly (below bar)

**What the bar needs.** Every finding bound to resolvable evidence, with the binding *enforced* at
issuance and preserved in the frozen record.

**What exists.** The binding is real and enforced in flight: unresolved evidence ids abort the run
(`src/domain/pipeline/nodes/evidence-links.ts:33`), and the registry is the standard-source corpus
(`state/evidence-registry.json`, compiled by `scripts/compile-evidence.mjs`). The failing clause is
**enforcement at issuance**: hallucination failures annotate rather than block
(`src/domain/pipeline/nodes/hallucination-check.ts:100` returns an annotated item, never a removal),
and the issuance route freezes the draft without consulting evidence or capability state
(`src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:43`).

**Stated explicitly, because it is easy to misread:** the evidence registry is the *source* of
evidence, not the *grounding mechanism*. Its existence says nothing about whether a finding is bound
to it. Separately, `evidence_grounding` as a judge dimension in `src/lib/eval-gates.ts:21` is a
sample-scoring metric, not a runtime control; the two are different subjects and are reported
separately.

---

## 5. the ODD gate

Verdict: partly (below bar)

**What the bar needs.** No issued issue, report or buyer-visible claim may assert a capability
outside an `in` cell whose input floor is satisfied.

**What the gate does today — three things, all inside the run:**

1. **Stage eligibility blocks out-of-domain selection** — `src/domain/pipeline/nodes/stage-select.ts:47`
   and `src/domain/pipeline/nodes/stage-select.ts:55` raise `OddOutsideDomainError`.
2. **Claim stamping** — `src/domain/odd.ts:99` allows claims for `in` cells, while
   `src/domain/odd.ts:102` and `src/domain/odd.ts:106` withhold them for the other statuses; the
   stamp rides on the result (`src/domain/pipeline/result.ts:101`).
3. **Input-floor invalidation** — `src/domain/pipeline/result.ts:103` records
   `odd_floor_satisfied`, and the report text carries the limitation
   (`src/lib/report.ts:16`, `src/lib/report.ts:18`).

**The failing clause.** The bounding is at *result* and *report* level. Issuance does not consult it:
`src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:43` freezes the draft without
reading `odd_status` or `odd_floor_satisfied`, so an audit whose capability claim was invalidated
can still be issued and frozen. The claim is annotated, not bounded.

**Trap avoided.** `status: "in"` in `policies/odd.json` means *a fixture proves this mapping*. It
does not mean the cell is healthy, that the claim is bounded, or that the product is
enterprise-ready.

---

## 6. evaluation harness coverage per jurisdiction and stage

Verdict: no

**What the bar needs.** Every cell the Canada-first map implies must be covered: an `in` cell with
at least one fixture, a passing archived scorecard, and a scorecard fresh under the 7-day doctrine.

**The doctrine.** `docs/validation/eval-gates.md:36` sets a freshness maximum age of 7 days for
Tier-1 scorecards; `src/lib/eval-gates.ts:21` sets the corpus pass mark at 0.9.

**The matrix.** `policies/odd.json` declares 16 cells: 5 `in`, 10 `mapped_unproven`, 1
`structurally_absent`. The 5 `in` cells are UK `uk:S1`, US `us-fhwa:preliminary-design`, US
`us-fhwa:final-design`, International `int:preliminary-design` and Canada `ca-tac:planning`. The
other 11 carry no fixtures at all.

**The scorecards.** The newest archive directory is `state/eval-scorecards/2026-09-08T01-52-05-000Z/`,
but the scorecards inside it carry the internal `run_id` `2026-08-25T19-54-07-248Z` — **57 days
old** against a 7-day doctrine. Reading the JSON, not the folder name, is what exposes this. Nine
of the eleven archived scorecards pass cleanly (`passes_corpus_mark: true`,
`regression_vs_prior.regression: false`, `tier2_review_required: false`), so for those cells the
*only* clause they fail is freshness. Two do not:
`state/eval-scorecards/2026-09-08T01-52-05-000Z/GF-12.json` and
`state/eval-scorecards/2026-09-08T01-52-05-000Z/GF-16.json` both record
`regression_vs_prior.regression: true` and `tier2_review_required: true`, and they belong to the
`us-fhwa:preliminary-design` and `int:preliminary-design` cells. Those two cells need a re-judge,
not only a re-run.

**Covered cells: 0 of 16.** Per jurisdiction (Canada first, then UK, US, UAE, International):
Canada 0, UK 0, US 0, UAE 0, International 0. No cell satisfies all three clauses: 3 fail only on
freshness, 2 fail on freshness and additionally on the regression and tier-2 clause, and 11 fail
because no fixture exists.

```
ABSENCE: scorecards for the 11 cells that are not `in` — no match for (GF-|fixture_id) under
  state/eval-scorecards/ for those cells' fixtures
  (search 1: `rg -ln "GF-" state/eval-scorecards/` → scorecards exist for 11 fixture ids only, and
   those 11 belong to the 5 `in` cells; search 2: `python3 -c "…"` over the 16 cells' fixture_ids in
   policies/odd.json → 11 cells have an empty fixture list)
  nearest miss: state/eval-scorecards/2026-09-08T01-52-05-000Z/GF-10.json is a passing Canada
  planning scorecard, but it is 57 days old.
```

**Trap avoided.** `state/readiness-report.json` is a generated snapshot and is not evidence of
current coverage; coverage was re-derived from `policies/odd.json` plus the scorecard JSON. The CI
freshness gate passes on filesystem mtime rather than on the internal `run_id`, so a fresh clone
looks fresh; the age reported above is the run age.

---

## 7. performance (p50/p95 per audit stage)

Verdict: no

**What the bar needs.** A recorded p50 and p95 per audit stage, from a named measurement, on a named
run, with the method stated.

**What exists.** No per-stage latency is recorded anywhere in the audit pipeline. The defensible
definition of "audit stage" is the 13 registered pipeline nodes — `AG-PROJECT`,
`AG-STAGE-SELECT`, `AG-MANIFEST`, `AG-RULES`, `AG-FINDINGS`, `AG-QUESTIONS`, `AG-AI-CANDIDATES`,
`AG-HALLUCINATION-CHECK`, `AG-EVIDENCE-USE-AUDIT`, `AG-ADJUDICATION`, `AG-EVIDENCE-LINKS`,
`AG-REPORT`, `AG-PERSIST` (`src/domain/pipeline/types.ts:16` lists all thirteen ids;
`src/domain/pipeline/registry.ts:27` maps the twelve synchronous ones, with `AG-PERSIST` behind the
persist step) — and none of them times itself.

**The finding is `unmeasured`, not `slow`.** The product's performance is unknown, not bad. No
number is reported here, and no number should be inferred.

```
ABSENCE: per-audit-stage latency instrumentation — no match for
  (performance\.now|hrtime|elapsedMs|durationMs|histogram) in the audit pipeline
  (search 1: `rg -n "performance\.now|hrtime|latency|elapsedMs|durationMs|histogram" src/` → the only
   latency hits are harvest-provider pings, in three files: the dev console provider panel
   (src/app/dev/mission-control/_components/provider-health.tsx:18), the dev console harvest
   visualisation (src/app/dev/mission-control/_components/ai-harvest-viz.tsx:37) and the admin health
   route (src/app/api/dev/health/route.ts:41); search 2: `rg -n "Date\.now" src/lib src/domain` → the only
   clock read is the rate-limiter window, src/lib/ratelimit.ts:52)
  nearest miss: src/app/api/dev/health/route.ts:41 measures provider ping latency — a different
  subject (corpus-provider reachability), not audit-stage latency.
```

**Trap avoided.** The deterministic path (AI off by default) is not the production path, so timing
it would describe a path a paying firm would not use. Other timings in the repository — UI page-load
probes, KV limit measurements, harvest run records — measure different subjects and are not quoted
here as audit-stage performance.

---

## 8. security (secrets, authz, input validation, dependency risk)

Verdict: no

The area verdict is the **worst** of the four sub-verdicts, by rule stated in advance: *the area
verdict is the worst sub-verdict*.

| Sub-question | Sub-verdict | Why |
|---|---|---|
| Secrets | `partly (below bar)` | Keys are held in the macOS keychain for corpus work (`src/discovery/keychain.ts:17`), the admin gate reads `ADMIN_KEY` from the environment and compares it in constant time (`src/lib/api.ts:30`, `src/lib/api.ts:52`). But the tenant credential lives in browser `localStorage` (`src/lib/client.ts:10`), is minted client-side (`src/lib/client.ts:22`), and has no rotation, no revocation and no server-side session. |
| Authz | `no` | Possession of the key is the whole authorisation model (`src/lib/api.ts:59`): there is no per-action, per-user or per-role authorisation anywhere, and issued records carry a constant actor (`src/lib/persistence/issue-ledger.ts:49`). |
| Input validation | `partly (below bar)` | The upload path is genuinely well validated — size cap (`src/lib/extract.ts:7`, `src/lib/extract.ts:19`) and PDF magic-byte check (`src/lib/extract.ts:28`) — and policy packs are schema-validated with Ajv (`src/domain/packs.ts:138`). But request bodies on the API are hand-validated with no schema library, and three product routes are unauthenticated by design (`src/app/api/inputs/[jur]/route.ts:11`, `src/app/api/jurisdictions/route.ts:6`, `src/app/api/jurisdictions/[jur]/stages/route.ts:11`). |
| Dependency risk | `no` | Five runtime dependencies, no scanner, no update automation. |

```
ABSENCE: dependency scanning and update automation — no match for
  (dependabot|renovate|snyk|npm audit) under package.json and .github/
  (search 1: `rg -n -i "dependabot|renovate|snyk|npm audit" package.json .github/` → 0 hits; search 2:
   `ls .github/` → only `workflows`, with no `dependabot.yml`; the six workflows are ci, ci-gates,
   deploy, discovery-harvest, eval and opencode, none of which scans dependencies)
  nearest miss: package.json:26 pins `ajv` — a runtime dependency with no scanner behind it, and the
  only dependency a reviewer can currently inventory by reading the file.
```

**The repository's own stated limit** (a claim about itself, not a control):
`docs/validation/security-review.md:19` gates the system as "acceptable for prototype deployment
carrying non-sensitive data" `[claim]`, and `docs/validation/security-review.md:20` states that rate
limiting "is mandatory before any public or multi-user use" `[claim]`. That second line has drifted
from the code: the limiter is now KV-backed with a deliberate fail-open fallback
(`src/lib/ratelimit.ts:44`). The drift is itself a finding — the security record does not describe
the shipped system.

**Live evidence.** The deployed MVP rejects an unauthenticated workspace request with 401
(`2026-10-21T11:14:14Z`) and keeps the dev health surface private
(`src/app/api/dev/health/route.ts:15`, live check `2026-10-21T11:14:14Z`). No credential was used
in any check, and no secret value appears in this document.

---

## 9. backups and restore

Verdict: no

**What the bar needs.** A scheduled, monitored, off-platform backup of the tenant data store, a
restore that has been exercised, and a stated RPO and RTO.

**What exists.** Class-level export and restore primitives for issued issues, which are write-once
safe: `src/lib/persistence/issue-ledger.ts:80` and `src/lib/persistence/issue-ledger.ts:98`. They
are invoked only from a test (`tests/domain/retention-policy.test.ts:143`). There is no job, no
schedule, no drill, no monitoring, and no RPO or RTO statement.

```
ABSENCE: a backup job, a restore drill, and an RPO/RTO statement — no match for
  (backup|snapshot|restore) as a scheduled operation, and no match for \b(rpo|rto)\b
  (search 1: `find src scripts .github -type f \( -iname "*backup*" -o -iname "*snapshot*" \)` → 0 files;
   `rg -ln -i "\brpo\b|\brto\b" docs/ src/` → 0 hits; search 2: `ls .github/workflows/` → six
   workflows (ci, ci-gates, deploy, discovery-harvest, eval, opencode), none of them a backup job)
  nearest miss: src/lib/persistence/issue-ledger.ts:80 exports issue lineage — the primitive a backup
  would use, exercised only by tests/domain/retention-policy.test.ts:143.
```

**Trap avoided.** `scripts/vault-sync.mjs`, `scripts/compile-evidence.mjs` and
`scripts/tier1-archive.mjs` back up *repository* artifacts. That is developer-tooling backup, not
customer-data backup, and it does not let a tenant be restored.

```
ABSENCE: an incident runbook — no match for (runbook|incident) under docs/
  (search 1: `find docs -iname "*runbook*" -o -iname "*incident*"` → 0 files; search 2:
   `rg -ln -i "on-call|escalation|postmortem" docs/ --glob '!docs/RSA-Documents/**'` → 1 file,
   docs/architecture/discovery-architecture.md, whose line 57 is an escalation-gate heading about
   human-in-the-loop approvals rather than an incident runbook)
  nearest miss: docs/architecture/discovery-architecture.md:57 — an escalation-gate heading — and
  docs/deployment.md:3, which documents the deploy target: how code ships, not how to respond to a
  customer-impacting failure.
```

---

## 10. observability

Verdict: no

**What the bar needs.** A product-reachable health and readiness surface, structured logging, error
tracking, metrics, dashboards and alerting, so a team detects failures before a customer does.

**What exists.** The only health and readiness routes are admin-gated dev surfaces
(`src/app/api/dev/health/route.ts:15`, `src/app/api/dev/readiness/route.ts`) and the product API
has no health route at all. Logging is scattered `console.error` / `console.log`
(`src/lib/api.ts:121` and elsewhere), with no structured logger.

```
ABSENCE: structured logging, error tracking, metrics, dashboards and alerting for the product —
  no match for (pino|winston|bunyan|opentelemetry|sentry|prom-client|statsd) under src/ and package.json
  (search 1: `rg -ln "prom-client|statsd|opentelemetry|sentry|datadog" package.json src/` → 0 hits;
   `rg -n "\"pino\"|\"winston\"|\"bunyan\"" package.json` → 0 hits; search 2: `ls .github/workflows/`
   → six workflows, `rg -ln -i "alert" .github/workflows/` → 0 hits)
  nearest miss: src/app/dev/mission-control/_components/provider-health.tsx:18 renders provider
  reachability — a dev console for the corpus pipeline, not for the product a customer uses.
```

**Trap avoided.** `/dev/mission-control` (readiness meters, provider health, KPI strips) looks like
an operations dashboard and `state/harvest-verify/` looks like telemetry. Both are internal: the
console is behind the shared admin key and the records are corpus-pipeline artefacts. Neither
observes the product.

---

## 11. data residency

Verdict: no

**What the bar needs.** A residency control: pinned storage and processing regions, a
sub-processor register, a transfer mechanism, or a per-jurisdiction deployment.

**What the repository evidences.** Production runs on Vercel Hobby, region `iad1`
(`docs/deployment.md:5` `[claim]`); persistence is an environment-configured Upstash/Vercel KV
endpoint whose region is not pinned anywhere in the repository; the AI adapter, when enabled, sends
project material to an external model gateway (`src/lib/ai.ts:611` reads `OPENCODE_API_KEY`), and
it is off by default (`src/lib/ai.ts:51`).

```
ABSENCE: any residency policy, sub-processor register, region selection or per-jurisdiction
  deployment — no match for (residency|gdpr|pipeda|data residency) under src/, policies/ and docs/
  (search 1: `rg -ln -i "residency|gdpr|pipeda|data residency|eu region" src/ policies/ docs/
   --glob '!docs/research/enterprise-gap-audit.md'` → 0 hits;
   search 2: `find . -maxdepth 3 -type f \( -iname "*residency*" -o -iname "*sub-processor*" \)` → 0 files)
  nearest miss: docs/deployment.md:5 names the single region fact the repository has (`iad1`); it is
  a hosting detail, not a residency control.
```

**Stated plainly:** *no residency requirement is asserted here; whether one applies to a given buyer
is a legal and commercial question outside this audit.* This document names the missing control
(region pinning, a sub-processor register, per-jurisdiction storage), not a legal duty. This is not
legal advice.

---

## 12. accessibility

Verdict: partly (below bar)

**Assumption, stated as such:** the bar is **WCAG 2.2 Level AA**. The repository states no level
anywhere; WCAG 2.2 AA is the defensible default for a product whose own deliverables face public
sector accessibility expectations. This is an assumption of this audit, not a fact about the repo.

**What exists.** Product surfaces carry semantic structure and accessible names: the landing page
(`src/app/page.tsx:262`, `src/app/page.tsx:128`), the project list
(`src/app/projects/page.tsx`), the project page (`src/app/projects/[projectId]/page.tsx:327`) and
the audit page (`src/app/projects/[projectId]/audits/[auditId]/page.tsx:625`). The failing clause is
**conformance evidence**: there are no automated accessibility assertions and no documented
statement of conformance.

```
ABSENCE: automated accessibility assertions and a conformance statement — no match for
  (axe-core|jest-axe|@axe) under package.json, tests/ and src/
  (search 1: `rg -ln "axe-core|jest-axe|@axe" package.json tests/ src/` → 0 hits; search 2:
   `ls tests/e2e/` → flow.spec.ts, harvest-buttons.spec.ts, probe-h5-divergence.spec.ts,
   probe-h5-loading.spec.ts — no accessibility specification)
  nearest miss: src/app/page.tsx:262 sets `role="img"` with an `aria-label` on the plan view —
  semantics are present, assertions are not.
```

**Trap avoided.** The presence of `aria-label` attributes is not conformance, and their absence in a
code sample is not a failure. `src/app/probe/**` contains accessibility strings but is a probe
surface, not the product. This document does not claim that any level is met.

---

## Ranked gaps

Ranking rule: bands in order — **band 1** stops the first sale, **band 2** blocks a jurisdiction the
map names (Canada → UK → US → UAE → International), **band 3** blocks a claim the product makes,
**band 4** is operational toil. Within a band, severity of buyer-visible risk first, then smaller
size first. `Size`: **XS** ≤1 file, no dependency, no schema; **S** ≤3 files; **M** ≤8 files or one
schema/migration or one new runtime dependency; **L** more than 8 files, or new infrastructure, or a
cross-cutting change to the persistence key scheme, the auth model or the pipeline.

Each entry carries its **Band** label — the ordering label the ranking rule requires, printed so a
reviewer can check the order rather than re-derive it — followed by the six content fields: Area,
Why now, Evidence, Acceptance sketch, Size. The three band-4 severities differ (failure detection,
then conformance evidence, then an unmeasurable SLO), so the size tie-break is not reached inside
band 4; within band 1 the entries are ordered by the severity of the buyer-visible risk and, where
two severities are comparable, by the smaller size first.

### G-1 — Named-user accounts with seat counts and an actor id on every issuance
- **Band:** band 1 — blocks the first sale

- **Area:** accounts and roles
- **Why now:** A firm cannot buy a seat for a person who does not exist, and every record is signed
  by a constant. This blocks the first sale outright and leaves the firm's own professional
  liability attached to a record with no accountable author.
- **Evidence:** `src/lib/client.ts:10`, `src/lib/client.ts:22`, `src/lib/api.ts:59`, `src/lib/persistence/issue-ledger.ts:49`
- **Acceptance sketch:** every user has a resolvable identity, distinct from the workspace key; a
  seat count exists and is enforced at a product surface; every mutation and every issued record
  carries a non-constant actor id that resolves to a user; the issued record still freezes.
- **Size:** L — a cross-cutting change to the auth model and the persistence key scheme.

### G-2 — Server-established tenant identity with rotatable, revocable credentials
- **Band:** band 1 — blocks the first sale

- **Area:** tenant isolation
- **Why now:** The credential is the tenant, so a leaked browser key is total access to that firm's
  work, and it can never be rotated or withdrawn. A buyer's security review stops here.
- **Evidence:** `src/lib/api.ts:56`, `src/lib/api.ts:69`, `src/lib/persistence/store.ts:236`, `src/lib/client.ts:22`
- **Acceptance sketch:** the server derives tenant identity from something the client cannot mint;
  a credential can be rotated and revoked without deleting tenant data; a test asserts that one
  tenant's credential cannot read another tenant's project.
- **Size:** L — cross-cutting: auth model plus the persistence key scheme.

### G-3 — Durable, actor-attributed, tamper-evident audit trail with a firm-facing export
- **Band:** band 1 — blocks the first sale

- **Area:** audit trail
- **Why now:** The destination promises an immutable audit trail tying every finding to its
  evidence. Today the strongest record is write-once but unsigned, the per-run artifact trail is
  pruned, and the outcome log lives on ephemeral local disk. A firm that cannot export its own
  audit history cannot meet its own retention obligations.
- **Evidence:** `src/lib/persistence/issue-ledger.ts:74`, `src/lib/persistence/issue-ledger.ts:49`, `src/lib/persistence/artifact-trail.ts:39`, `src/lib/persistence/artifact-trail.ts:87`, `src/domain/outcomes.ts:22`
- **Acceptance sketch:** the trail survives a redeploy and a rerun; each entry names a resolvable
  actor; a tamper-evident link exists between entries and a verification routine detects a
  modified record; a product route exports a firm's own history.
- **Size:** L — a cross-cutting change to the persistence key scheme and the record format.

### G-4 — Scheduled tenant-store backup with a rehearsed restore and a stated RPO and RTO
- **Band:** band 1 — blocks the first sale

- **Area:** backups and restore
- **Why now:** The only restore path is exercised by a test. A firm asking "what happens if the
  data is lost" gets no answer, and no answer is a no-sale.
- **Evidence:** `src/lib/persistence/issue-ledger.ts:80`, `src/lib/persistence/issue-ledger.ts:98`, `tests/domain/retention-policy.test.ts:143`
- **Acceptance sketch:** a tenant-data backup runs on a schedule to durable storage outside the
  primary store; a restore drill has been performed and its outcome recorded; the RPO and RTO are
  written down and are true of the implementation.
- **Size:** M — one scheduled job, one drill record, one documented RPO/RTO.

### G-5 — Provisioned, rotatable and revocable secrets for tenant credentials
- **Band:** band 1 — blocks the first sale

- **Area:** security (secrets, authz, input validation, dependency risk)
- **Why now:** The tenant credential is generated in the browser and kept in `localStorage`, with no
  server-side session, no rotation and no revocation. The repository's own security review scopes
  the system to non-sensitive prototype data, which is a state a paying firm cannot accept.
- **Evidence:** `src/lib/client.ts:10`, `src/lib/client.ts:22`, `src/lib/api.ts:30`, `docs/validation/security-review.md:19`
- **Acceptance sketch:** tenant credentials are issued and stored server-side; a rotation path
  exists and has been exercised; a revocation path exists and takes effect without data loss; the
  repository's own security record no longer contradicts the shipped code.
- **Size:** M — credential lifecycle plus the record that describes it.

### G-6 — Schema validation at every trust boundary, with the public surfaces enumerated
- **Band:** band 1 — blocks the first sale

- **Area:** security (secrets, authz, input validation, dependency risk)
- **Why now:** Only the upload path and the policy packs are schema-validated. Every other request
  body is hand-checked, and three product routes are unauthenticated by design. A buyer's review
  expects one validation story, not three exceptions.
- **Evidence:** `src/lib/extract.ts:28`, `src/domain/packs.ts:138`, `src/app/api/inputs/[jur]/route.ts:11`
- **Acceptance sketch:** every route that accepts a body validates it against a schema before use; a
  test asserts an invalid body is rejected on each route; every unauthenticated route is listed
  with the reason it is public.
- **Size:** M — the product route set plus a schema per request shape.

### G-7 — Inventoried, pinned and scanned runtime dependencies
- **Band:** band 1 — blocks the first sale

- **Area:** security (secrets, authz, input validation, dependency risk)
- **Why now:** A buyer's review expects a maintained, scanned dependency set. There is no scanner
  and no update automation, so the inventory is a line in `package.json` that nobody checks.
- **Evidence:** `package.json:26`
- **Acceptance sketch:** a scheduled scan reports advisories for runtime dependencies; a
  documented triage path exists for a finding; the runtime dependency set is enumerated in one
  place.
- **Size:** S — one workflow, one document, no new runtime dependency.

### G-8 — Region-pinned persistence with a sub-processor register
- **Band:** band 1 — blocks the first sale

- **Area:** data residency
- **Why now:** The only region fact in the repository is the hosting region. A Canadian firm whose
  data may sit in an unpinned store, and whose project material may reach a third-party model
  gateway, cannot complete its own vendor review.
- **Evidence:** `docs/deployment.md:5`, `src/lib/ai.ts:611`, `src/lib/ai.ts:51`
- **Acceptance sketch:** the persistence region is pinned and documented; a sub-processor register
  lists every third party that can receive customer data, including the model gateway; a decision
  is recorded on whether the AI path may carry customer data at all.
- **Size:** S — configuration plus one register, no schema change.

### G-9 — Fresh Tier-1 evaluation coverage for every jurisdiction and stage cell
- **Band:** band 2 — blocks a jurisdiction the map names

- **Area:** evaluation harness coverage per jurisdiction and stage
- **Why now:** Canada is the first jurisdiction to sell in, and two of its three cells have no
  fixture at all. Even the five mapped cells are covered only by a scorecard that is 57 days old
  against a 7-day doctrine, and two of them also carry a regression and a tier-2 review flag, so the
  harness currently certifies nothing.
- **Evidence:** `docs/validation/eval-gates.md:36`, `src/lib/eval-gates.ts:21`
- **Acceptance sketch:** every cell the map implies has a fixture and a scorecard whose internal
  `run_id` is within the freshness window; no covered cell carries a regression or a tier-2 review
  flag; the check reports the internal `run_id` age rather than a file timestamp; Canada cells are
  covered first.
- **Size:** L — fixtures and judged runs across jurisdictions, plus a corrected freshness check.

### G-10 — Capability claims bounded at issuance, not only in the report text
- **Band:** band 3 — blocks a claim the product makes

- **Area:** the ODD gate
- **Why now:** The product's own claim language is that claims stay inside the declared ODD. Today
  an audit whose capability was invalidated can still be issued and frozen, so the claim is
  annotated rather than bounded — the difference between a limitation line and a guarantee.
- **Evidence:** `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:43`, `src/domain/pipeline/result.ts:101`, `src/lib/report.ts:16`
- **Acceptance sketch:** issuance refuses, or blocks the freeze with an explicit override path, when
  the capability status is not `in` or the input floor is unsatisfied; the issued record carries the
  capability status it was bounded by; a test asserts a below-floor audit cannot be issued silently.
- **Size:** S — one route, one condition, one test.

### G-11 — Evidence binding enforced at issuance, not only in flight
- **Band:** band 3 — blocks a claim the product makes

- **Area:** evidence grounding
- **Why now:** Evidence grounding is the product's core professional promise, and it is enforced
  during the run but not at the moment the record is frozen. A finding can be flagged as
  unsupported and still be issued.
- **Evidence:** `src/domain/pipeline/nodes/evidence-links.ts:33`, `src/domain/pipeline/nodes/hallucination-check.ts:100`, `src/app/api/projects/[projectId]/audits/[auditId]/issues/route.ts:43`
- **Acceptance sketch:** an unresolved evidence id or an auto-flagged hallucination blocks issuance
  unless a named reviewer records an explicit, attributable override; the override is visible in
  the issued record.
- **Size:** S — one route condition plus one override record.

### G-12 — Product-reachable health and readiness, structured logs and failure alerting
- **Band:** band 4 — operational toil

- **Area:** observability
- **Why now:** A firm paying for a seat needs to know the service is up and who to call, and the
  team needs to learn about a failing audit before the customer does. The only health surface is an
  admin-gated internal console.
- **Evidence:** `src/app/api/dev/health/route.ts:15`, `src/lib/api.ts:121`
- **Acceptance sketch:** a product-reachable readiness endpoint reports dependency state without
  exposing tenant data; product logs are structured and carry a correlation id; an alert fires on
  a failing audit, a failing provider or a storage outage.
- **Size:** M — one route, one logging path, one alert rule.

### G-13 — Accessibility conformance evidence against WCAG 2.2 AA
- **Band:** band 4 — operational toil

- **Area:** accessibility
- **Why now:** Public-sector road-safety clients face accessibility expectations, and the
  repository's semantics are unverified. A conformance statement is an evidence question, not a
  rewrite: the barrier is the absence of assertions and of a statement.
- **Evidence:** `src/app/page.tsx:262`, `src/app/projects/[projectId]/page.tsx:327`
- **Acceptance sketch:** an automated accessibility check runs in CI over the product surfaces and
  fails the build on a serious violation; a written statement records the level the product claims
  and the method used to check it.
- **Size:** M — a check, a spec, and the fixes it surfaces.

---

### G-14 — Per-stage latency measurement with a recorded p50 and p95
- **Band:** band 4 — operational toil

- **Area:** performance (p50/p95 per audit stage)
- **Why now:** The map's destination includes production SLOs, and an SLO needs a measured
  distribution. Nothing is recorded today, so the product's speed is unknown and cannot be
  promised or defended. The gap is measurement, not speed.
- **Evidence:** `src/domain/pipeline/types.ts:16`, `src/domain/pipeline/registry.ts:27`
- **Acceptance sketch:** a measurement over a named run reports a p50 and a p95 for each of the
  thirteen stages, with the method stated; the measured run is one a paying firm would use; the
  figures are reproducible from a recorded run id.
- **Size:** S — instrumentation in the pipeline runner plus one report.
## Operator decisions required

Two questions are commercial or legal rather than engineering, so this audit states them and does
not answer them.

1. **Third-party model-gateway transmission of customer project material.** The AI adapter is off
   by default (`src/lib/ai.ts:51`), but enabling it sends project inputs and drawings to an
   external gateway (`src/lib/ai.ts:611`). Whether a paying firm may accept that — and under what
   sub-processor terms — is the operator's call, and it bears on G-8.
2. **Whether real customer data may be held during the gap window.** The repository scopes itself to
   non-sensitive prototype data (`docs/validation/security-review.md:19`). The operator sets the
   commercial posture: accept a documented risk window for a first Canadian firm, or hold
   onboarding until the band-1 gaps close.

---

## Method, limits and what this audit did not check

- **Inspected:** `src/`, `policies/`, `contracts/`, `state/`, `scripts/`, `docs/`, `tests/`,
  `.github/workflows/` and the deployed MVP's public and unauthenticated responses, at commit
  `74072b0b3b437c658a7a74cae4c9529d9228b318`.
- **Not checked:** authenticated product flows, the behaviour of the AI path, and the deployed
  behaviour of any control. The live check covers only what the recorded requests show; a code-level
  control is not a deployed guarantee, and no statement here should be read as one.
- **Not in scope:** the corpus and discovery pipeline as a product, the corpus harvest itself, code
  quality, and road-safety-audit practice.
- **Repository self-claims quoted as claims, never as controls:** `PRODUCT.md:29`,
  `docs/validation/security-review.md:19`, `docs/validation/security-review.md:20`,
  `docs/deployment.md:3`, `docs/deployment.md:5`, `docs/validation/eval-gates.md:36`.

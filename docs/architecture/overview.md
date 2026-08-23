# AuditorAI — Product Architecture (approved)

Vocabulary: Module / Interface / Implementation / Depth / Seam / Adapter / Leverage /
Locality per the codebase-design discipline.

## 1. Module map

```text
src/
  domain/                      ← THE deep core (framework-independent)
    types.ts                     canonical vocabulary as types (CONTEXT.md-aligned)
    packs.ts                     policy-pack loading + ajv validation + evidence integrity
                                 gate; file io injectable (PackIo)
    input-states.ts              §27 input-state derivation shared by client checklist
                                 and the AG-MANIFEST node (one level→missing-state table)
    project-edits.ts             pure project create/patch policy (stage gate, no-silent-
                                 detach merge); routes parse → call → respond
    finding-review.ts            reviewer-status actions + PATCH payload shape (ADR-0003)
    engine.ts                    runAudit(): thin compatibility facade over pipeline.runAll
    pipeline/                    registry-driven audit graph
      registry.ts                  DESCRIPTORS (node_class, reads/writes, edges) + NODE_FNS;
                                   BATCH_NODES = every node but AG-PERSIST
      pipeline.ts                  runAll / runNode / runNodeAsync dispatch + write-scope
                                   gate (assertWriteScope) over declared `writes`
      result.ts                    assembleAuditResult(): slice preconditions + limitations
      layout.ts                    longest-path layering of descriptors (dev tab reuses it)
      nodes/                       one module per AG-* node
policies/<jur>/pack.json       ← versioned jurisdiction knowledge (data, not prompts);
                                 stage caveats are pack data too (framework.stage_limitation_note)
lib/
  inference.ts                 LLM transport core: chatComplete, CircuitBreaker,
                               FailoverEndpoint, budget+repair-once loop (runInferenceLoop)
  ai.ts                        AiAdapter seam; OFF by default; ZenAiAdapter composes
                               inference.ts; ajv boundary validation of candidates;
                               adapter registry behind getAiAdapter()
  evidence.ts                  evidence-registry access (getEvidence/tryGetEvidence); shared
                               by packs, pipeline nodes and scripts
  persistence.ts               DataStore{put,get,getMany,keys,delByPrefix} seam +
                               Memory/KvRest adapters + Repository — sole owner of the key
                               scheme (static key/prefix helpers); StoreUnavailableError;
                               resettable singleton for tests
  report.ts                    AuditResult → Markdown (deterministic)
  intake.ts                    image-intake policy: caps, magic-byte sniff, dedupe, count cap
  extract.ts                   document intake: limits, magic-byte checks, PDF text extraction
  client.ts                    browser workspace/admin keys over a single send() core
  api.ts                       route helpers (workspace+admin auth, rate limits, typed ERROR_TABLE)
app/                          ← delivery adapters only (Next.js routes/pages; pages import
                                 domain policy modules instead of inlining rules)
scripts/lib/                  ← frontmatter.mjs + paths.mjs: shared vault parsing/validation/
                                 emission; gen-node-contracts reads state/graph-state.json as
                                 single source; evidence-id resolution enforced; npm run vault
```

## 2. Deep modules & seams

| Seam | Interface | Adapters | Why here |
|---|---|---|---|
| Policy source | `getPack(jur)`, `listJurisdictions()` | files under `policies/` via injectable `PackIo` | jurisdictions are data; adding one = adding a pack |
| Evidence | `getEvidence(id)` / `tryGetEvidence` | `state/evidence-registry.json` | provenance centralized; one lookup used by packs, nodes, scripts |
| Persistence | `Repository` over `DataStore{put,get,getMany,keys,delByPrefix}` | `MemoryStore`, `KvRestStore` (Upstash/Vercel-KV REST) | free-tier KV now, DB later; zero caller changes |
| AI reasoning | `AiAdapter.generateCandidates()` via `getAiAdapter()` registry | `OffAiAdapter` (default), `ZenAiAdapter` | determinism without AI; bounded artifacts only, schema-checked at the boundary |
| LLM transport | `chatComplete`, `runInferenceLoop` (breaker/failover/budget/repair) | composed inside live adapters | resilience written once below the reasoning seam |
| Input intake | `extractText(File)` docs; `buildImageAttachment` images | PDF/TXT/MD; PNG/JPEG/WebP | uploads never persisted raw; extraction failures surface explicitly |

Depth check (deletion test): delete `src/domain/pipeline/` and every guarantee — stage
eligibility, input states, rule shaping, wording discipline, artifact trail, deterministic
reports — vanishes for all five jurisdictions at once. `engine.ts` alone is now an ~20-line
shell delegating to `pipeline.runAll`; the depth moved inward. Delete the `Repository` key
helpers and every store address in the app breaks → the key scheme has exactly one home.
Delete `api.ts` helpers and complexity merely moves into every route → they are thin by design.

## 3. Audit execution flow

```text
Project (metadata + stage_selection + input_values)
  → POST /audits route: adapter enabled ? runAllLive : engine.runAudit
  → batch fold over registry BATCH_NODES (runAllArtifacts):
      each node: fn(state, ctx) → patch, gated by assertWriteScope(nodeId, patch)
      AG-MANIFEST   := pack.inputs ∩ native stage, via shared input-states derivation
      AG-RULES      := pack.rules where applies_to(stage): completeness → missing-info
                       questions (never findings); process/eligibility → compliance drafts
      AG-QUESTIONS  := pack.audit_questions ∩ stage.canonical_stages
      AG-AI-CANDIDATES (node_class=ai-bounded): live only when permitted; OFF ⇒ null slice
      AG-ADJUDICATION: batch mode carries drafts unverified; unknown decision ids are
                       recorded loudly, not dropped
  → assembleAuditResult() [pipeline/result.ts]: schema-shaped literal, byte-deterministic
      given inputs; limitations := qualification note + mapping-confidence note +
      framework.stage_limitation_note + skipped adjudication refs
  → AG-PERSIST only outside the batch (executed_in_batch=false): persistRun via io {store, ws}
  → human adjudication (PATCH reviewer_status/recommendation; banned words rejected)
  → renderReportMarkdown() / JSON export / print-PDF
```

Step mode drives the same graph node-by-node through `runNodeAsync`: descriptor decides —
ai-bounded nodes go live when permitted, the non-batch persistence node requires io,
everything else stays synchronous.

## 4. Invariants

1. Canonical stages never shown without Native Stage label + confidence (ADR-0002).
2. `safety_concern` ≠ `compliance_question`; nothing fabricates safety concerns.
3. Missing information is never a finding (ADR-0003).
4. Every normative item cites evidence ids validated against the compiled registry — at
   pack-load time (`tryGetEvidence`), at evidence-linkset assembly, and in scripts.
5. Determinism: identical project + packs ⇒ identical AuditResult modulo injected clock.
6. A pipeline node writes only its declared slices; rogue writes throw (`assertWriteScope`).
7. No secrets in repo; workspace key lives client-side, stored hashed server-side.

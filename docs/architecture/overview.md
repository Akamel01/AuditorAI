# AuditorAI — Product Architecture (approved)

Vocabulary: Module / Interface / Implementation / Depth / Seam / Adapter / Leverage /
Locality per the codebase-design discipline.

## 1. Module map

```text
src/
  domain/                      ← THE deep core (framework-independent)
    types.ts                     canonical vocabulary as types (CONTEXT.md-aligned)
    packs.ts                     policy-pack loading + ajv validation + evidence integrity gate
    engine.ts                    runAudit(): deterministic pipeline; recommendation-wording rule
  policies/<jur>/pack.json     ← versioned jurisdiction knowledge (data, not prompts)
  lib/
    evidence.ts                  evidence-registry access (provenance lookups)
    persistence.ts               DataStore seam + Memory/KvRest adapters + Repository
    report.ts                    AuditResult → Markdown (deterministic)
    ai.ts                        AiAdapter seam; OFF by default; bounded candidate artifacts
    extract.ts                   upload intake: limits, magic-byte checks, PDF text extraction
    client.ts                    browser workspace key + api() helper
    api.ts                       route helpers (workspace auth, error mapping)
  app/                         ← delivery adapters only (Next.js routes/pages)
```

## 2. Deep modules & seams

| Seam | Interface | Adapters | Why here |
|---|---|---|---|
| Policy source | `getPack(jur)`, `listJurisdictions()` | files under `policies/` | jurisdictions are data; adding one = adding a pack |
| Evidence | `getEvidence(id)` / `tryGetEvidence` | `state/evidence-registry.json` | provenance centralized; registry is compiled artifact |
| Persistence | `Repository` over `DataStore{put,get,keys}` | `MemoryStore`, `KvRestStore` (Upstash/Vercel-KV REST) | free-tier KV now, DB later; zero caller changes |
| AI reasoning | `AiAdapter.generateCandidates()` | `OffAiAdapter` (default), future LLM adapters | determinism guaranteed without AI; bounded artifacts only |
| Input intake | `extractText(File)` | PDF/TXT/MD | uploads never persisted raw; extraction failures surface explicitly |

Depth check (deletion test): delete `engine.ts` and every guarantee — stage eligibility,
input states, process rules, wording discipline, deterministic reports — vanishes for all
five jurisdictions at once. It is load-bearing. Delete `api.ts` helpers and complexity
merely moves into every route → they are thin by design.

## 3. Audit execution flow (deterministic subset of §19)

```text
Project (metadata + stage_selection + input_values)
  → buildAuditContext()            [engine]
  → runAudit():
      manifest := pack.inputs ∩ selected native stage   (state computation)
      rules     := pack.rules where applies_to(stage)
          completeness  → MissingInformationQuestion[]      (never findings)
          process       → compliance_question Finding (draft)
          eligibility   → compliance_question Finding (human confirms)
      questions := pack.audit_questions ∩ stage.canonical_stages
      limitations := framework qualification + mapping confidence + scoring notes
  → AuditResult (schema-shaped, byte-deterministic given inputs)
  → Repository.saveAudit()
  → human adjudication (PATCH reviewer_status/recommendation; banned words rejected)
  → renderReportMarkdown() / JSON export / print-PDF
```

## 4. Invariants

1. Canonical stages never shown without Native Stage label + confidence (ADR-0002).
2. `safety_concern` ≠ `compliance_question`; engine never fabricates safety concerns.
3. Missing information is never a finding (ADR-0003).
4. Every normative item cites evidence ids validated against the compiled registry at
   pack-load time (fail-fast, CI-enforced).
5. Determinism: identical project + packs ⇒ identical AuditResult modulo injected clock.
6. No secrets in repo; workspace key lives client-side, stored hashed server-side.

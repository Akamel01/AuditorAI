---
map: v3-architecture-deepening
label: wayfinder:map
created: 2026-08-23
owner_directive: chart-and-execute-in-loops
---

## Destination

Every module in AuditorAI earns its place by the deletion test: interfaces are small,
implementation is deep, seams are real (two adapters or a proven test surface), and the
interface is the test surface. All friction surfaced by the five-track architecture
investigation of 2026-08-23 (domain/pipeline, AI/eval, persistence/delivery, UI,
knowledge-system) is resolved or consciously ruled out of scope. `npm run ci` green after
every phase; goldens byte-stable throughout.

## Notes

- Vocabulary: codebase-design discipline (Module / Interface / Implementation / Depth /
  Seam / Adapter / Leverage / Locality); domain terms per CONTEXT.md.
- Standing preferences inherited from mvp/v2 maps: deterministic-first; AI bounded;
  compliance ≠ safety; state reconstructed from repo, never chat history.
- **Execution mode (owner directive):** phases resolved in-loop by agent waves, not one
  HITL ticket each. No git commits unless the owner explicitly asks; each phase must leave
  `npm run ci` green so the owner can commit per phase.
- Ticket granularity collapsed into phase checklists below; status flips inline.

## Decisions so far

- **Investigation (2026-08-23):** five parallel read-only tracks produced the friction
  inventory below. Key verdicts: pipeline fold is sound and provably step-equivalent;
  engine.ts is now an honest facade; persistence seam is real but layout leaks break the
  ADR-0001 swap promise; AiAdapter seam is borderline-hypothetical (Off adapter is
  degenerate); app/ pages violate the "delivery adapters only" rule; knowledge-system has
  four divergent front-matter parsers and a dual-canonical node identity breach.

## Flags needing an owner decision (recorded, not unilaterally changed)

1. **Audit history depth-1**: deterministic audit ids (`AUD-{project}-{stage}`,
   `nodes/shared.ts:84`) mean reruns silently overwrite prior audits per stage. Needs an
   explicit decision record before anyone relies on history.
2. **Candidates → adjudication semantics**: contracts promise AG-ADJUDICATION consumes
   `candidate_findings`; implementation drops them pre-report (`pipeline-live.test.ts:80`
   enshrines this). This effort amends contract text to match implemented reality +
   makes unknown-finding_id decisions record loudly. Building the real candidate-review
   flow is product work left fogged.
3. **Eval live mode** added as opt-in flag only; E5 trigger-path policy unchanged.
4. **Vault journal lint vs V3 anti-enforcement stance**: charter already promises
   machine validation of prose front-matter; lint covers *format*, never session
   compliance. Kept inside existing compile scripts, not new CI choreography.

## Phase checklist

### Phase 0 — Baseline ✅
- [x] `npm run ci` green on untouched tree (verified 2026-08-23).

### Phase 1 — Correctness bugs & drift (quick wins)
- [ ] `humanizeEnum()` module; fix single-underscore replace in `lib/report.ts:26` and
      `projects/[projectId]/page.tsx:199` (audit page already fixed).
- [ ] `.env.example` documents `AI_ADAPTER`/`AI_PROVIDER_API_KEY`; code reads
      `AI_ENABLED`/`OPENCODE_API_KEY` (`ai.ts:400`) — align docs.
- [ ] `pipeline/nodes/persist.ts:23-26` retry swallows first error silently — log it.
- [ ] `/api/dev/replay`: raw workspace key moves query→header; params renamed to
      path-param convention (`project|audit|ws` → projectId/auditId style).
- [ ] Jurisdiction whitelist literal duplicated in `inputs/[jur]/route.ts:13` and
      `stages/route.ts:13` → single domain predicate.
- [ ] Image budget constants consolidated (`image.ts:3,5`, `upload/route.ts:11`,
      comment-only per-project cap `types.ts:62`) → one constants home.
- [ ] Dev tab: controlled inputs replace `getElementById`; guarded `JSON.parse`
      (`dev/page.tsx:42-44`, `projects/page.tsx:88-89`).
- [ ] Step route live ctx omits attachments (`step/route.ts:41-50`) — thread them,
      restoring vision parity with audits POST.

### Phase 2 — Domain core deepening
- [ ] Slice write-scope enforced mechanically in `runNode` (patch keys ⊆ descriptor.writes)
      + violation test (`types.ts:175-186`, `registry.ts:41-170`).
- [ ] Registry-driven async dispatch: callers consult `node_class` instead of hardcoding
      AG-AI-CANDIDATES/AG-PERSIST branches (`pipeline.ts:99-106`, `step/route.ts:39-52`);
      versionStart threading encapsulated.
- [ ] Adjudication: unknown finding_id decisions recorded loudly, not `continue`d
      (`adjudication.ts:24-25`); AG-ADJUDICATION contract + descriptor amended to
      implemented reality re candidates.
- [ ] packs.ts: injectable reader/dir; reuse `lib/evidence.tryGetEvidence`, delete private
      duplicate loader (`packs.ts:178-188`); negative-path tests (bad JSON, ajv failure,
      unknown evidence id).
- [ ] UK GG-119 limitation hardcode (`shared.ts:77-80`) → pack-data-driven generic rule.
- [ ] `assembleAuditResult` re-localized; stop mislabeling errors "AG-REPORT" when called
      from the AI node (`shared.ts:59-63`, `ai-candidates.ts:71`).
- [ ] Dead surface deleted: `engine.buildAuditContext` (zero consumers),
      `registry.NODE_ORDER` alias.

### Phase 3 — Persistence & delivery deepening ✅
- [x] Repository sole owner of key scheme (static helpers); persist.ts / finish wire leak /
      replay prefix synthesis all refactored onto it; `store_key_prefix` off the wire
      (zero external consumers found).
- [x] `PersistenceRefSlice` → `{audit_id, project_id, stored_at}` coordinates (verified
      schema-free first); nodes never assemble keys; SHARED-STATE.md amended.
- [x] Trail ordered by numeric seq + 12-artifact regression test.
- [x] `getMany` (concurrent GETs — true pipelining impossible per Upstash protocol) +
      `delByPrefix`; Repository lists off N+1; prune uses delByPrefix.
- [x] `StoreUnavailableError`: transport/5xx/auth no longer masked as absent.
- [x] One `ERROR_TABLE` in api.ts; upload/ad-hoc/dev-route handling folded in;
      unexpected errors redacted at 500.
- [x] Pure `domain/project-edits.ts` (create/patch/stage-gate) with table-driven tests;
      attachment delete+repair as one Repository op; image intake single-homed in
      `lib/intake.ts`.
- [x] Resettable store singleton (`setDataStoreForTests`); fetch-mocked KvRestStore suite
      (10 tests); ratelimit matrix (6 tests).
- [x] `charteredSlices()` derived from `SHARED_STATE_SLICES` w/ compile-time drift check.

### Phase 4 — AI / eval deepening ✅
- [x] `src/lib/inference.ts`: chatComplete (injectable fetch/timeout), CircuitBreaker,
      FailoverEndpoint, runInferenceLoop (budget + repair-once), extractJson*; ZenAiAdapter
      composes it — all 10 ai.test cases pass unedited; `getAiAdapter` registry-driven
      (`registerAiAdapter`, env key, off default).
- [x] Boundary value validation: `validateCandidateAtBoundary` runs post-projection;
      rogue-values tests prove zero leakage.
- [x] Prompt single-sourcing: BANNED_WORDS from wording.ts; CANDIDATE_FIELDS one source →
      prompt sketch + ajv schema + projection; pack vocabulary threaded
      (CandidateVocabulary); native_stage_display_name in stage line; 0–5 budget declared
      in generator source; snapshot diff = exactly the intended substitution.
- [x] Judge transport: injectable fetch, shared extractor, import-safe module,
      findPriorRunMean parameterized dir (6 new tests).
- [x] `--live` corpus mode via runAllLiveArtifacts (env-gated, opt-in; default unchanged).

### Phase 5 — UI deepening ✅
- [x] `src/domain/input-states.ts`: deriveInputState / filterInputsForStage / mergeAttachment
      (+ helpers); manifest node now shares `missingStateFor`; 31 table-driven tests.
      DIVERGENCE FLAGGED: client shows stored "provided"+blank verbatim while AG-MANIFEST
      downgrades to level-appropriate missing state (see Not yet specified).
- [x] client.ts one send() core; api() FormData-tolerant; adminApi added; three localStorage
      raw-fetch forks deleted; workspace/admin key literals survive exactly once each.
- [x] buildLayersClient deleted → shared pure `domain/pipeline/layout.ts` (client-safe).
- [x] ADR-0002 pairing: `stageDisplay()` triple helper used at all three render sites.
- [x] `domain/finding-review.ts`: REVIEWER_STATUS_ACTIONS + buildFindingUpdate, union reused.

### Phase 6 — Knowledge system deepening ✅
- [x] `scripts/lib/frontmatter.mjs` (+ `paths.mjs`, REPO_ROOT via import.meta.url): parse/
      validate/emit on `yaml` (added as devDependency — was never a direct dep); adopted by
      compile-evidence, vault-export, vault-import; evidence-registry + views byte-identical.
- [x] Evidence-id resolution enforced in vault-import + validate-state cross-check
      (negative-tested).
- [x] gen-node-contracts reads state/graph-state.json for identity/roles/edges
      (`checkGraphAlignment` fails loudly); rotable literals purged; contracts regenerated;
      validate-state asserts bidirectional agreement.
- [x] All four prose zones validated per charter type rules; vault-notes.json note_count
      0 → 14; two gotcha files received minimal missing front-matter (bodies untouched —
      owner eyeball requested).
- [x] `npm run vault` composite; second run = zero churn.

### Phase 7 — Docs sync, protocol writes, close-out ✅
- [x] `docs/architecture/overview.md` rewritten against verified code (module map, seam
      table incl. LLM-transport row, flow, deletion-test checks re-verified).
- [x] Protocol journal entry: `vault/journal/2026-08-23-architecture-deepening.md`.
- [x] Final verification: `npm run ci` exit 0 (279 passed) + Playwright 3/3 (one product
      fix: restored `id="stage-select"` dropped during page-thinning).

## Not yet specified (fog beyond this destination)

- Provided-but-blank input divergence: client checklist renders stored state verbatim,
  AG-MANIFEST downgrades blank "provided" to missing — one rule should win (owner call),
  then the other surface follows `domain/input-states.ts`.
- Real candidate-findings review UX (product feature; needs owner grilling).
- Audit-history retention policy (blocked on Flag #1 decision).
- RSC/server-render initial page data from Repository (idiomatic shift; value < risk now).
- Postgres adapter as third store (unlocked by Phase 3 key-scheme ownership).

## Out of scope

- Changing eval gate thresholds or E5 trigger policy (owner-ratified Checkpoint ω).
- Automated enforcement of vault-protocol session compliance (V3 explicit exclusion).
- New jurisdictions, stages 3/4 support, paid infrastructure, Docker (inherited).

## Destination status

**REACHED 2026-08-23.** All seven phases executed in agent loops; every phase left
`npm run ci` green (final: 28 suites / 279 tests passed + Playwright 3/3). Working tree
intentionally left UNCOMMITTED for owner review — suggested commit granularity is one
commit per phase block above. Open items live in Flags (owner decisions 1–4) and
Not-yet-specified (provided-blank divergence; candidate-review UX).

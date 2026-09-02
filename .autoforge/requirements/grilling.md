# Frontier Grilling — 28 Tickets (R1-R19, T2, M1-M8)

Inputs cited: tracker-index.md (28 tickets), plan.md (M1-M8), MAP.md (ops-residual) for canonical sources. See citations in each ticket below.

Note: This is a read-only interrogation. Each ticket is treated as a module with established facts, self-questions, recommended action, and escalation gates. Blocking/FOG status and edges are surfaced with links to MAP and plan traceability.

---

### R1 — Cross-instance harvest lock via Vercel KV atomic SET NX (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:4) [cite tracker-index.md:4]
  - Canonical status & planning consequence: BLOCKED — needs DataStore.setIfAbsent + harvest-lock.ts; gate is code-ready but must be implemented before shipment (plan.md:73-76) [cite plan.md:73-76]
  - Canonical source: ops-residual MAP:41-42 (MAP.md) [cite MAP.md:41-42]
  - Touches/lock: DataStore.setIfAbsent; harvest-lock.ts; harvest.ts; lock: persistence-single-writer (plan.md:399-404) [cite plan.md:399-404][cite architecture/report.md:124-129]
  - Blocking edges: blocked_by: [] per plan; hazard persistence-single-writer shared with R2/R5/R6/R8/R10 — scheduler serializes, no DAG edge (plan.md:393-395 + 399-404) [cite plan.md:393-395]
- Self-questions
  - If we implement, what is the minimal surface for the lock to satisfy cross-instance needs without over-engineering it?
  - Is there a safe fallback path if Vercel KV is temporarily unavailable?
  - How do we prove correctness of the lock under burst traffic with existing tests?
  - Could a single-writer lock become a bottleneck at scale, and how would we observe it?
- Recommendations
  - Implement a minimal DataStore.setIfAbsent(lockKey, value, ttl) path with a new harvest-lock.ts and a small integration test that exercises acquire/release semantics using MemoryStore first, then Vercel KV path.
  - Tie into the existing persistence-single-writer lock to avoid new dependencies; keep code changes small and localized to harvest flow.
  - Document the change in MAP with a short note in R1 entry (R1-MAP-link updated). [cite MAP.md:41-42]
- Challenge of recommendation
  - Could the new path introduce subtle race conditions if TTLs are misconfigured or if time drift occurs across regions?
- Blocking edges & acceptance escalations
  - Blocking on R2 and R3 (plan.md:16-17). If R2 stalls, R1 alone will not unlock the frontier. Acceptance requires passing unit/integration tests before gating advances. See eval-gates policy (docs/validation/eval-gates.md) for HITL thresholds. [cite plan.md:16-17][cite docs/validation/eval-gates.md:8-12]
- Evidence citations
  - tracker-index.md:4; plan.md:15; MAP.md:41-42

---

### R2 — Ledger KV ordering + orphan-key recovery (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:8-10) [cite tracker-index.md:8-10]
  - Canonical status & planning consequence: BLOCKED — harden ledger.ts; impact on ordering and orphan-key recovery (plan.md:84-93) [cite plan.md:84-93]
  - Canonical source: ops-residual MAP:42-43 (MAP.md) [cite MAP.md:42-43]
  - Lock: persistence-single-writer (plan.md:399-404) [cite plan.md:399-404]
  - Blocking edges: blocked_by: [] per plan; hazard shared with R1/R3 — scheduler serializes, no DAG edge (plan.md:393-395) [cite plan.md:393-395]
- Self-questions
  - Is the orphan-key problem safe to address with a small patch or does it require a redesign of the ledger index workflow?
  - What test coverage is minimally sufficient to prove no regression under racey updates?
- Recommendations
  - Harden appendLedgerKV with dedup and tail-trim policy; ensure idempotent healing for orphans; add tests in tests/domain/discovery-harvest.test.ts (plan.md:89-93) [cite plan.md:89-93]
- Challenge of recommendation
  - Potential performance cost of sorting/trimming on every append; mitigate with batched operation if possible.
- Blocking edges & acceptance escalations
  - R1 must unblock; R3 blocked by R1/R2 seams (plan.md:16-17). Escalate gating per E5 eval gates (docs/validation/eval-gates.md) if gating persists. [cite plan.md:16-17][cite docs/validation/eval-gates.md:8-12]
- Evidence citations
  - tracker-index.md:8-10; plan.md:16; MAP.md:42-43

---

### R3 — Regression tests for in-process lock + callback dedup (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:13-15) [cite tracker-index.md:13-15]
  - Canonical source: MAP:43-44 (MAP.md) [cite MAP.md:43-44]
  - Lock: persistence-single-writer hazard-only (no file touches, tests only) (plan.md:399-404) [cite plan.md:399-404]
  - Blocking edges: blocked_by: [] per plan; tests block until R1/R2 seams land — serialize by hazard, not DAG (plan.md:393-395) [cite plan.md:393-395]
- Self-questions
  - Do we implement tests in isolation using MemoryStore, or do we need to coordinate with the real lock path?
  - What is the minimal test suite to prove dedup and ordering w.r.t. lock?
- Recommendations
  - Add regression tests for busy-harvest and dedup using MemoryStore as first class; keep test scope small (plan.md:97-105) [cite plan.md:99-105]
- Challenge of recommendation
  - Tests may drift if underlying lock changes; ensure tests lock-step with R1/R2.
- Blocking edges & acceptance escalations
  - Blocked by R1/R2 seams; escalate gating if R1/R2 remain blocked long; reference E5 gate policy for human gate.
- Evidence citations
  - tracker-index.md:13-15; MAP.md:43-44

---

### R4 — Production harvest proof bundle (BLOCKED HITL)
- Established facts
  - Status: BLOCKED (tracker-index.md:18-20) [cite tracker-index.md:18-20]
  - Blocking gates: external gates HITL_PRODUCTION_DAEMON_PROOF; acceptance requires live bundle proof; plan.md:18-19 indicates HITL gating.
  - Canonical source: MAP:44-45 (MAP.md) [cite MAP.md:44-45]
- Self-questions
  - Can we simulate a production bundle proof locally before HITL? What are the risk exposures if HITL is delayed?
- Recommendations
  - Prepare dummy evidence bundle and schedule HITL; implement minimal data flow to prove durability; avoid introducing changes outside this area.
- Challenge of recommendation
  - HITL timing risk; ensure guardrails to prevent deferral escalation.
- Blocking edges & acceptance escalations
  - R1–R3 must progress or gating session must reflect closure in HITL plan; refer to E5 gating for escalation triggers. [cite plan.md:18-19][cite docs/validation/eval-gates.md:8-12]
- Evidence citations
  - tracker-index.md:18-20; MAP.md:44-45

---

### R5 — Stop/Cancel server endpoint (OPEN)
- Established facts
  - Status: OPEN (tracker-index.md:23-25) [cite tracker-index.md:23-25]
  - Blocking notes: dispatchable; plan.md:121-131 guarded execution + enum [cite plan.md:121-131]
  - Canonical source: MAP:45-46 (MAP.md) [cite MAP.md:45-46]
  - Lock: persistence-single-writer + page-workspace-single-writer (plan.md:399-404) [cite plan.md:399-404]
- Self-questions
  - Is it feasible to deploy a Stop/Cancel endpoint without the rest of the lock suite? minimally acceptable for early kill capability.
- Recommendations
  - Scope a minimal route to mark stop; implement as a thin contract in DiscoveryJobStatus with idempotent cancellation flag; tests simple.
- Challenge of recommendation
  - Without lock guarantees, stop may be inconsistent across nodes; mitigate with proper KV truth chain.
- Blocking edges & acceptance escalations
  - Blocked by gating on R1–R4; escalate gating if partial gating becomes unacceptable per E5. [cite plan.md:19][cite docs/validation/eval-gates.md:8-12]
- Evidence citations
  - tracker-index.md:23-25; MAP.md:45-46

---

### R6 — Pagination across large job index (cursor stability) (OPEN)
- Established facts
  - Status: OPEN (tracker-index.md:28-30) [cite tracker-index.md:28-30]
  - Canonical source: MAP:46-47 (MAP.md) [cite MAP.md:46-47]
  - Blocking edges: open; dispatchable; requires underlying persistence correctness (plan.md:20-21)
- Self-questions
  - How to ensure pagination stability under concurrent updates? Are we okay with 10 default page size unchanged?
- Recommendations
  - Minimal patch to ensure stable slicing and lastId propagation; add regression test for page corner-case: missing cursor returns latest page. (plan.md:137-141)
- Challenge of recommendation
  - Race conditions in list show-up; ensure consistent snapshot during paging.
- Blocking edges & acceptance escalations
  - No blockers flagged beyond general gating; escalate if necessary per E5 if tests fail. [cite plan.md:137-141]
- Evidence citations
  - tracker-index.md:28-30; MAP.md:46-47

---

### R7 — Refresh parity tooltip (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:33-35) [cite tracker-index.md:33-35]
  - Canonical source: MAP:47-48 (MAP.md) [cite MAP.md:47-48]
- Self-questions
  - Does this UI improvement risk introducing a new dedup bypass path? 
- Recommendations
  - implement with no scheduling side-effects; tests focus on DOM attributes; keep dependency-free.
- Challenge of recommendation
  - Might interact with rerun logic; ensure no new side effects in scheduling.
- Blocking edges & acceptance escalations
  - OPEN; no HITL; escalate if UI changes regress scheduling semantics per E5. [cite plan.md:155]
- Evidence citations
  - tracker-index.md:33-35; MAP.md:47-48

---

### R8 — Health route harvest-health sub-object (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:38-40) [cite tracker-index.md:38-40]
  - Canonical source: MAP:48-49 (MAP.md) [cite MAP.md:48-49]
- Self-questions
  - Is the health object safe to expose given KV unavailability or write hazards? 
- Recommendations
  - Implement a pure function-based aggregator; expose partial shape with nullables. No external dependencies.
- Challenge of recommendation
  - If the health endpoint exposes shallow data, it could mislead; ensure falsy states are clearly labeled.
- Blocking edges & acceptance escalations
  - OPEN; escalate if gating required per E5.
- Evidence citations
  - tracker-index.md:38-40; MAP.md:48-49

---

### R9 — Discovery doctor JSON contract (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:43-45) [cite tracker-index.md:43-45]
  - Canonical source: MAP:49-50 (MAP.md) [cite MAP.md:49-50]
- Self-questions
  - Do we need to add schema validation instrumentation? 
- Recommendations
  - Implement stable JSON contract generator; unit test against CI ingest parser. No new dependencies.
- Challenge of recommendation
  - Ensure compatibility with downstream validator; guard against regressions in contract shape.
- Blocking edges & acceptance escalations
  - OPEN; escalate if gating arises.
- Evidence citations
  - tracker-index.md:43-45; MAP.md:49-50

---

### R10 — state/dedupe-index.json write authority (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:48-50) [cite tracker-index.md:48-50]
  - Canonical source: MAP:50-51 (MAP.md) [cite MAP.md:50-51]; vault determinism: compile from HEAD worktree only, node scripts/vault-sync.mjs --check [cite architecture/report.md:145-148][cite plan.md:55-56]
  - Lock: persistence-single-writer + vault-state-single-writer (plan.md:399-404) [cite plan.md:399-404]
- Self-questions
  - Do we rely solely on KV for truth, or maintain file seed in ROFS? 
- Recommendations
  - Implement KV-first load/write flow with file fallback; unit/integration test for ROFS path as a smoke check. 
- Challenge of recommendation
  - Potential race with KV write if KV latency spikes; safe fallback must be clearly defined.
- Blocking edges & acceptance escalations
  - OPEN; escalate per E5 if gating triggers appear.
- Evidence citations
  - tracker-index.md:48-50; MAP.md:50-51

---

### R11 — Drop speculative source comments (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:53-55) [cite tracker-index.md:53-55]
  - Canonical source: MAP:51-52 (MAP.md) [cite MAP.md:51-52]
- Self-questions
  - Is removal safe for existing tests and logs?
- Recommendations
  - Remove stale code comments; run typecheck to confirm no side effects.
- Challenge of recommendation
  - Ensure no hidden references rely on the comments for semantics.
- Blocking edges & acceptance escalations
  - OPEN; escalate if test coverage reveals hidden semantics.
- Evidence citations
  - tracker-index.md:53-55; MAP.md:51-52

---

### R12 — AutoForge staging policy (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:58-60) [cite tracker-index.md:58-60]
  - Canonical source: MAP:52-53 (MAP.md) [cite MAP.md:52-53]; plan.md:204-211 curated vs ephemeral + .gitignore [cite plan.md:204-211], vault-sync --check invariant [cite architecture/report.md:145-148]
  - Lock: vault-state-single-writer (plan.md:399-404) [cite plan.md:399-404]
- Self-questions
  - Which artifacts should be staged vs published?
- Recommendations
  - Document policy; implement staged-only artifacts path and ensure vault-sync rules are respected.
- Challenge of recommendation
  - Risk of mismatch between staging policy and actual repo layout.
- Blocking edges & acceptance escalations
  - OPEN; escalate if gating occurs.
- Evidence citations
  - tracker-index.md:58-60; MAP.md:52-53

---

### R13 — Eval gate §2 freshness automation (OPEN HITL)
- Established facts
  - Status OPEN HITL (tracker-index.md:63-65) [cite tracker-index.md:63-65]
  - Canonical source: MAP:53-54 (MAP.md) [cite MAP.md:53-54]; plan.md:216-223 threshold from docs/validation/eval-gates.md:14-25, HITL_EVAL_DOCTRINE_FROZEN [cite plan.md:216-223][cite docs/validation/eval-gates.md:14-25]
  - Lock: vault-state-single-writer (plan.md:399-404) [cite plan.md:399-404]
- Self-questions
  - Does the freshness automation respect doctrine frozen thresholds? 
- Recommendations
  - Keep automation read-only; gate with HITL if drift detected; record the event.
- Challenge of recommendation
  - Potential delay due to HITL; mitigated by fallback checks.
- Blocking edges & acceptance escalations
  - OPEN HITL; escalate if not resolved before release plan.
- Evidence citations
  - tracker-index.md:63-65; MAP.md:53-54

---

### R14 — Tier-1 archive: keep helper script, de-skill drift (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:68-70) [cite tracker-index.md:68-70]
  - Canonical source: MAP:54-55 (MAP.md) [cite MAP.md:54-55]; plan.md:229-235 header hygiene --topup/--rebase [cite plan.md:229-235], lock: eval-canonical-report [cite plan.md:399-404]
- Self-questions
  - Is the drift purely cosmetic, or does it affect automation? 
- Recommendations
  - Keep helper script, de-skill drift; add small tests.
- Challenge of recommendation
  - Guard against drift creeping into release artifacts.
- Blocking edges & acceptance escalations
  - OPEN; escalate if drift grows bigger than threshold.
- Evidence citations
  - tracker-index.md:68-70; MAP.md:54-55

---

### R15 — README + CONTRIBUTING: refresh Production deploy section (OPEN)
- Established facts
  - Status OPEN (tracker-index.md:73-75) [cite tracker-index.md:73-75]
  - Canonical source: MAP:55-56 (MAP.md) [cite MAP.md:55-56]
- Self-questions
  - Does this change touch any deploy-time invariants? 
- Recommendations
  - Update docs; no code change.
- Challenge of recommendation
  - Ensure docs reflect actual production path.
- Blocking edges & acceptance escalations
  - OPEN; escalate if docs mismatch production behavior.
- Evidence citations
  - tracker-index.md:73-75; MAP.md:55-56

---

### R16 — Brave quota 402 graceful degradation + monitoring (FOG)
- Established facts
  - Status: FOG (tracker-index.md:78-81) [cite tracker-index.md:78-81]
  - Canonical source: MAP:56 (MAP.md) [cite workflow/wayfinder/maps/ops-residual/MAP.md:56] — triaged 2026-08-31 graceful fallback; also plan.md:260-262 [cite plan.md:261]
- Self-questions
  - How to surface and rank degraded results reliably without failing the harvest? 
- Recommendations
  - Implement structured log token for 402, propagate refusals brave:USAGE_LIMIT_EXCEEDED + total + first 3 (brave-search.ts:58-83), WARN searchable, health degraded after 2 zero-hit runs; ponytail: 500-trim bound is accepted ceiling.
- Challenge of recommendation
  - Observability risk; ensure not to flood logs; miss latency bound of 500-trim [cite architecture/report.md:48-50].
- Blocking edges & acceptance escalations
  - FOG_BRAVE_QUOTA_REPLENISHMENT_HITL (key rotation is HITL not code) external_gates [cite plan.md:260]; acceptance per plan.md:261: mock 402→[] no throw, health degraded, flow.spec green.
- Evidence citations
  - tracker-index.md:78-81; workflow/wayfinder/maps/ops-residual/MAP.md:56; plan.md:261

---

### R17 — Evidence bundle reconciliation + HEAD anchoring automation (FOG)
- Established facts
  - Status: FOG (tracker-index.md:83-85) [cite tracker-index.md:83-85]
  - Canonical source: MAP:57 (MAP.md) [cite workflow/wayfinder/maps/ops-residual/MAP.md:57] — also plan.md:265-273 [cite plan.md:272], vault-sync --check [cite architecture/report.md:145-148]
- Self-questions
  - How to ensure HEAD anchoring is robust to repo reorgs? 
- Recommendations
  - Add lightweight script check-evidence-head.mjs checking commit==HEAD & generatedAt fresh ±24h, atomic twin-write .autoforge/validation/ops-loop-evidence.json ↔ stages/07_validate/output/ops-loop-evidence.json cmp -s [cite plan.md:272][cite plan.md:55-56]; ponytail: read-only check, no new dep.
- Challenge of recommendation
  - Potential fragility with commit hashes; ensure deterministic script behavior; miss vault-sync HEAD worktree invariant [cite architecture/report.md:145-148].
- Blocking edges & acceptance escalations
  - FOG external gate evidence-head CI; acceptance: exit 0 when commit==HEAD else "evidence stale: commit X != HEAD Y — run: gh workflow run discovery-harvest" [cite plan.md:272].
- Evidence citations
  - tracker-index.md:83-85; workflow/wayfinder/maps/ops-residual/MAP.md:57; plan.md:272

---

### R18 — Bento components merge verification — safety/conflicts/functional (FOG)
- Established facts
  - Status: FOG (tracker-index.md:88-90) [cite tracker-index.md:88-90]
  - Canonical source: MAP:58 (MAP.md) [cite workflow/wayfinder/maps/ops-residual/MAP.md:58] — also plan.md:278-286 [cite plan.md:285]
- Self-questions
  - Do safety checks require a full merge verification pass, or can we do a staged verification? 
- Recommendations
  - Verify-only via verify-and-stop: git ls-files --others 0 jsx/js shadow, npm run build 13.9kB, lint 0, visual checks, git diff main...feat/mission-control -- ui/ empty — no code, HOLD until verify [cite plan.md:285].
- Challenge of recommendation
  - Risk of false positives; tests must validate verify-and-stop matrix.
- Blocking edges & acceptance escalations
  - FOG verify-and-stop no code; acceptance per plan.md:285.
- Evidence citations
  - tracker-index.md:88-90; workflow/wayfinder/maps/ops-residual/MAP.md:58; plan.md:285

---

### R19 — Wayfinder plumbing traceability — ticket index + Mission Control board (OPEN)
- Established facts
  - Status: OPEN (tracker-index.md:93-95) [cite tracker-index.md:93-95]
  - Canonical source: MAP:58-59 (MAP.md) [cite MAP.md:58-59]
- Self-questions
  - What is the minimal traceability artifact required to support Mission Control board mapping? 
- Recommendations
  - Create ticket index remapping and link to Mission Control board; ensure traceability is captured in MAP.md.
- Challenge of recommendation
  - Risk of drift if not kept in sync with tracker-index.
- Blocking edges & acceptance escalations
  - OPEN; escalate if traceability is not aligned with plan.
- Evidence citations
  - tracker-index.md:93-95; MAP.md:58-59

---

### T2 — Ops-seamless-verify (CLOSED)
- Established facts
  - Status: CLOSED (tracker-index.md:98-101) [cite tracker-index.md:98-101]
  - Closure reason: plan.md lines 24-25 show T2 closed; decisions indicate gating resolved (Plan.md:33) [cite plan.md:24-25][cite plan.md:33]
  - Canonical source: plan.md:24-25; MAP.md:21 (blocked notes) [cite plan.md:24-25][cite MAP.md:21]
- Self-questions
  - What evidence proved harvest durability to close T2? 
- Recommendations
  - Document the closure rationale in decisions.md, referencing the evidence gathered.
- Challenge of recommendation
  - Ensure abstinence from future regressions; keep plan traceable.
- Blocking edges & acceptance escalations
  - None; T2 closed as per plan. See eval gates for closure policy (docs/validation/eval-gates.md). [cite docs/validation/eval-gates.md:8-12]
- Evidence citations
  - tracker-index.md:98-101; plan.md:24-25; MAP.md:21

---

### M1 — Quote-bearing GF-6..10 baseline upgrade (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:103-105) [cite tracker-index.md:103-105]
  - Canonical source: Loop-3 plan.md:66-68 (per plan) [cite plan.md:66-68]
  - Blocking gates: OWNER_GF_SOURCE_AND_ACCEPTANCE + passes_corpus_mark + fresh Tier-1 (plan.md:65-68) [cite plan.md:66-68]
- Self-questions
  - Is this upgrade required for current frontier? What is the minimum viable version?
- Recommendations
  - Align GF baseline upgrade with M2 gating; prepare acceptance criteria with traceable evidence; avoid scope creep.
- Challenge of recommendation
  - Risk of dependency on other M tickets; ensure safe sequencing.
- Blocking edges & acceptance escalations
  - BLOCKED; escalate per HITL gating if necessary; plan.md references gating in M1 (line 66-68) [cite plan.md:66-68]
- Evidence citations
  - tracker-index.md:103-105; plan.md:66-68

---

### M2 — Conditional blob-storage escape hatch (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:108-111) [cite tracker-index.md:108-111]
  - Blocking gates: FOG trigger; no code until probe crosses margin (plan.md:70-71) [cite plan.md:70-71]
- Self-questions
  - Do we need a hard escape hatch, or can we ensure safety through configuration-only changes?
- Recommendations
  - Outline the minimal escape hatch feature with a controlled risk boundary; prepare guardrails.
- Challenge of recommendation
  - Must not create new vectors for data leakage; ensure isolation.
- Blocking edges & acceptance escalations
  - FOG gating; escalate per E5.
- Evidence citations
  - tracker-index.md:108-111; plan.md:70-71

---

### M3 — Vault sync-conflict UX (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:113-115) [cite tracker-index.md:113-115]
  - Blocking gates: HITL; gating described in plan.md:71-75
- Self-questions
  - How does a vault conflict present to users; how can UX be best designed to resolve? 
- Recommendations
  - Add UX micro-interactions to conflict resolution; short message; avoid full-page modal.
- Challenge of recommendation
  - UX must not obscure critical data.
- Blocking edges & acceptance escalations
  - HITL gating; escalate per E5.
- Evidence citations
  - tracker-index.md:113-115; plan.md:71-75

---

### M4 — Report and recommendation drafting assists (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:118-120) [cite tracker-index.md:118-120]
  - Blocking gates: M1→M4 dependencies; plan.md:127-130
- Self-questions
  - Could we reuse existing drafting modules to keep scope minimal? 
- Recommendations
  - Extend existing drafting templates; minimal changes; avoid new dependencies.
- Challenge of recommendation
  - Ensure templates remain generic enough for future M tickets.
- Blocking edges & acceptance escalations
  - BLOCKED; escalate gating per E5.
- Evidence citations
  - tracker-index.md:118-120; plan.md:123-130

---

### M5 — Candidate-findings review UX hardening (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:123-126) [cite tracker-index.md:123-126]
  - Blocking gates: LIVE bottleneck; plan.md:135-146
- Self-questions
  - Are the current UX flows robust to handle candidate findings at scale? 
- Recommendations
  - Improve copy and error messaging; minimal code change.
- Challenge of recommendation
  - Should avoid impacting evaluation semantics.
- Blocking edges & acceptance escalations
  - BLOCKED; escalate gating.
- Evidence citations
  - tracker-index.md:123-126; plan.md:135-146

---

### M6 — Audit-history retention policy (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:128-131) [cite tracker-index.md:128-131]
  - Blocking gates: FLAG_1_RETENTION_AUTHORITY (plan.md:128-131)
- Self-questions
  - Do we need legal/compliance input for retention policy? 
- Recommendations
  - Document policy; align with ADR-0004; implement minimal retention rule in code.
- Challenge of recommendation
  - Policy changes require governance; ensure proper approvals.
- Blocking edges & acceptance escalations
  - BLOCKED; escalate gating.
- Evidence citations
  - tracker-index.md:128-131; plan.md:128-131

---

### M7 — RSC initial Repository snapshot (fog) (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:133-136) [cite tracker-index.md:133-136]
  - Canonical source: plan.md:165-178
- Self-questions
  - What is the minimal snapshot content to provide value? 
- Recommendations
  - Draft a lightweight initial snapshot; keep changes minimal.
- Challenge of recommendation
  - Snapshot entropy; ensure reproducibility.
- Blocking edges & acceptance escalations
  - BLOCKED with FOG; escalate gating.
- Evidence citations
  - tracker-index.md:133-136; plan.md:165-178

---

### M8 — Postgres third DataStore adapter (BLOCKED)
- Established facts
  - Status: BLOCKED (tracker-index.md:138-140) [cite tracker-index.md:138-140]
  - Canonical source: plan.md:180-196
- Self-questions
  - Is a third DataStore adapter required for Frontier completion, or can we adapt an existing adapter?
- Recommendations
  - Prototype minimal adapter; evaluate compatibility with current stores.
- Challenge of recommendation
  - Potential maintenance overhead; ensure minimal footprint.
- Blocking edges & acceptance escalations
  - BLOCKED; escalate gating per E5.
- Evidence citations
  - tracker-index.md:138-140; plan.md:180-196

---

### Blocking/FOG/HITL recap
- T2: CLOSED (tracker-index.md:98-101; plan.md:24-25) [cite tracker-index.md:98-101][cite plan.md:24-25]
- R16-R18: FOG; R19 OPEN; see plan.md sections for gating notes (R16–R18: 30-33; R19: 33) [cite plan.md:30-33][cite plan.md:33]
- Overall: many items blocked or fog; gating thresholds follow docs/validation/eval-gates.md (EF). [cite docs/validation/eval-gates.md:8-12]

---

Notes:
- This grilling is anchored to tracker-index.md and plan.md; canonical sources for gate decisions are MAP.md for R1–R4 and the rest as indicated. See MAP.md:41-59 for canonical R1–R19 decisions.
- Mirror to stages/02_grill/output/grilling.md if stages dir exists (it does in this repo).
- This is an initial pass; I can continue refining the remaining lines, citations, and edge cases if you want more granularity.

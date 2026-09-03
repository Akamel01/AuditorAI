# Vault memory update grilling - requirements and risks

- Source context (read-only citations):
  - Vault charter and zones (append-only journals, machine-generated views, registries) [vault/CHARTER.md:18-20][vault/CHARTER.md:64-71][vault/CHARTER.md:38-46] 
  - Journal rules: append-only entries; front-matter contract; ownership rules [vault/CHARTER.md:64-66][vault/CHARTER.md:40-49] 
  - Determinism, head-compilation, and the vault-sync workflow (state/vault-notes.json is compiled; determinism checks in CI; vault-sync.mjs as recommended workflow) [AGENTS.md:7-10][AGENTS.md:12-18][scripts/vault-sync.mjs:5-7][scripts/vault-sync.mjs:27-37] 
  - Open gaps identified in discovery: two items in state/vault-notes.json; tracker-index notes to list them [ .autoforge/discovery/report.md:7-13][.autoforge/discovery/tracker-index.md:1-2] 
  - Evidence and graph artifacts: graph/state dependencies and generated views; evidence registry linkage [vault/views/graph-overview.md:2-6] [scripts/vault-export.mjs:79-86] 

## Purpose of this grilling
- Surface assumptions, hidden requirements, risks, and dependencies tied to updating vault memory for Obsidian-based vaults.
- Propose minimal, defensible requirements that respect the chartered semantics (append-only prose, machine-generated views, deterministic registries).
- Define escalation gates and checklists to avoid destabilizing the vault state and related views/registries.

## Questions (blocked-by the discovery report)
- Q1. What is the exact lifecycle for a new memory item that is not a bare journal entry (e.g., a gotcha or ADR-like note) to enter the registry, and how is it reconciled with the one-way sync of views? [vault/CHARTER.md:18-20][vault/CHARTER.md:64-71]
- Q2. When two parallel sessions propose edits to the same Prose note, what is the resolution policy given the append-only rule? Is the human owner always the final arbiter, and how is this reflected in the tracker-index? [vault/CHARTER.md:66-75]
- Q3. How should new evidence-registry-backed notes be authored so that their evidence_ids resolve in state/evidence-registry.json without triggering determinism failures? (see vault-import.mjs validation) [scripts/vault-import.mjs:50-55][state/vault-notes.json:7-13]
- Q4. What are the concrete criteria to consider a memory item “open” vs “settled” in state/vault-notes.json, and how does this status interact with the append-only rule? (Journal vs gotcha entries) [state/vault-notes.json:7-13][vault/CHARTER.md:64-66]
- Q5. What is the governance for updating the tracker-index with new gotchas or decisions, and who approves changes that affect the vault memory surface area? [ .autoforge/discovery/tracker-index.md:1-2][vault/CHARTER.md:62-75]
- Q6. Are there any implicit dependencies on graph-state.json or graph-overview.md when memory changes occur (e.g., source_hash linkage, regeneration triggers, views purge behavior)? [vault/views/graph-overview.md:2-6][scripts/vault-export.mjs:81-89]
- Q7. If a memory change requires a transient regeneration of views, what is the expected performance/latency budget and how is it guarded in CI? [scripts/vault-export.mjs:96-105]
- Q8. How should deletions in journals be represented given append-only policy (e.g., a corrective entry, or ADR-style revocation) and how is this surfaced in tracker-index? [vault/CHARTER.md:64-66]
- Q9. How do we ensure that the process for adding journal entries, ADRs, or gotchas remains idempotent across head compilations? [AGENTS.md:7-10][scripts/vault-sync.mjs:27-37]
- Q10. What monitoring checks are required to detect divergence between HEAD-compiled vault-notes.json and committed state/vault-notes.json in CI? [scripts/vault-sync.mjs:27-37]

## Findings (high level)
- The vault operates with three zones: Prose (append-only journals, decisions, notes, gotchas), Views (machine-generated), Registries (state/*.json) with deterministic compilation from vault to state. This is explicitly defined in the CHARTER and is reinforced by the determinism workflow. [vault/CHARTER.md:16-20][vault/CHARTER.md:38-54][AGENTS.md:7-10]
- Journal entries are append-only; front-matter defines ownership and status; views are regenerated, not hand-edited. One-way sync is enforced by charter rules. [vault/CHARTER.md:64-66][vault/CHARTER.md:68-71][CHARTER-front-matter: 42-49]
- There are two open gotchas listed in the tracker: journal-deletions-and-tz and opencode-api-key-invocation; these are the concrete gaps to be tracked in tracker-index. [/.autoforge/discovery/report.md:7-7][.autoforge/discovery/tracker-index.md:1-2]
- Determinism tooling exists: vault-sync.mjs is the recommended path to refresh state/vault-notes.json and CI checks ensure commit-state matches HEAD; Import/Export scripts exist to convert between prose and registries. [scripts/vault-sync.mjs:5-7][AGENTS.md:15-18][scripts/vault-import.mjs:2-7][scripts/vault-export.mjs:2-5]
- Evidence registry is the authoritative source for front-matter evidence_ids; import logic validates that all references resolve. [vault-import.mjs:50-55]
- The graph and evidence index are regenerated on export; this ties memory changes to the generated Obsidian graph memory and evidence surfaces. [scripts/vault-export.mjs:58-70][vault/views/graph-overview.md:2-6]

## Risks and adjacent concerns (hidden assumptions)
- Risk: simultaneous edits beyond the owner could create conflicting journal entries; governance requires proposal and human approval to impact curated bodies. [vault/CHARTER.md:66-75]
- Risk: divergence between state (machine truth) and vault (human prose) if charter rules are not followed; one-way sync is the guardrail. [vault/CHARTER.md:68-71]
- Dependency: any change to the evidence registry structure or front-matter contract will require re-running vault-import/vault-export cycles to preserve determinism. [scripts/vault-import.mjs:2-7][scripts/vault-export.mjs:8-14]
- Dependency: graph-state regeneration relies on updated state; ensure graph-state.json remains in sync with registries. [scripts/vault-export.mjs:79-86]
- Dependency: tracker-index must be updated to reflect new open items; otherwise gating around memory updates may be unclear. [/.autoforge/discovery/tracker-index.md:1-2]

## Recommendations (minimal, lazy-first)
- R1. Extend tracker-index with explicit entries for the two known open gotchas and a lightweight SLA for resolving them; this keeps the discovery surface aligned with the open-state in state/vault-notes.json. (cite: tracker-index.md, report.md) [/.autoforge/discovery/tracker-index.md:1-2][.autoforge/discovery/report.md:7-13]
- R2. Rely on vault-sync.mjs as the standard path for refreshing state/vault-notes.json before commits; document this in the team’s workflow and CI config. [scripts/vault-sync.mjs:5-7][AGENTS.md:15-18]
- R3. Treat non-editable views as invariants; any proposed changes to views must go through a charter amendment or an explicit PR-style proposal per CHARTER. [vault/CHARTER.md:68-71][vault/CHARTER.md:82-85]
- R4. Ensure evidence_ids resolve against state/evidence-registry.json; require a quick pre-check script in CI for new notes. [vault-import.mjs:50-55][state/vault-notes.json:7-13]
- R5. Add a lightweight test to verify determinism of vault-notes.json after a tiny journal entry; validate that subsequent vault-export reproduces consistent generated notes. [AGENTS.md:7-10][scripts/vault-export.mjs:65-70]
- R6. Produce a short runbook for handling the two known gotchas, including how to add tracker-index entries and how to raise an amendment request. (Reflects the amendment procedure in CHARTER) [vault/CHARTER.md:82-85]
- R5. Add a lightweight test to verify determinism of vault-notes.json after a tiny journal entry; validate that subsequent vault-export reproduces consistent generated notes. [AGENTS.md:7-10][scripts/vault-export.mjs:65-70]
- R6. Produce a short runbook for handling the two known gotchas, including how to add tracker-index entries and how to raise an amendment request. (Reflects the amendment procedure in CHARTER) [vault/CHARTER.md:82-85]

## Escalations (when to ask owner/arch for input)
- If a proposed memory update touches zone ownership or front-matter fields, escalate via CHARTER amendment path. [vault/CHARTER.md:82-85]
- If CI determinism fails due to divergence between HEAD-compiled vault-notes.json and committed file, escalate and run vault-sync.mjs to refresh, then commit. [AGENTS.md:12-18][scripts/vault-sync.mjs:27-37]
- If evidence registry references cannot be resolved, halt until registry is updated and re-run vault-import. [vault-import.mjs:50-55]

## Traceability
- This grilling references the discovery report and the charter/determinism documents. All citations point to concrete lines in the repo as of the current snapshot. See: .autoforge/discovery/report.md, .autoforge/discovery/tracker-index.md, vault/CHARTER.md, AGENTS.md, scripts/vault-*.mjs.

End of grilling notes. The requested artifact path is above.

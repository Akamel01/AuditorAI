---
map: v2-agentic-platform
label: wayfinder:map
created: 2026-08-22
---

## Destination

AuditorAI v2 executes audits as a contracted, step-mode node graph — controllable from a
developer-only tab, powered by real LLM inference (ox-alpha via opencode access) inside the
audit run itself, accepting pasted drawings/images as first-class audit inputs, quality-gated
by an ox-alpha-judged evaluation harness over public-domain sample projects, with project and
development memory living in a hybrid Obsidian vault synced to the repo. Deterministic-first
doctrine survives everywhere: AI proposes bounded candidates, adjudication disposes.

## Notes

- Skills every session should consult: `grilling` + `domain-modeling` for decisions,
  `codebase-design` vocabulary (Module/Interface/Depth/Seam/Adapter/Leverage/Locality)
  for anything structural.
- Standing preferences inherited from mvp map: deterministic-first; AI bounded to candidate/
  draft artifacts; compliance ≠ safety; primary sources only for normative claims; state
  reconstructed from repo, never chat history; researchers write only their own
  `docs/research/*.md`; orchestrator commits.
- **Owner authority grant (2026-08-22):** owner approved the v2 plan and designated ORCH as
  orchestrator AND reviewer; HITL tickets are marked `hitl: true` and still require live
  owner input (prototype reaction, topology blessing, gate thresholds). Everything else may
  resolve under ORCH's own review.
- The four scope forks were grilled and locked 2026-08-22 (see Decisions so far).

## Decisions so far

- [Scope forks grilled](../../decision-log-v2.md): Hybrid vault (prose-canonical knowledge,
  JSON-canonical registries, compiled views both ways); step-mode executor (not replay-only,
  not live DAG editing); ox-alpha/opencode as programmatic in-audit brain — NOT a manual
  loop ("inference must conduct the audit"); corpus licensing government/public-domain only
  with recorded provenance.

- [ox-alpha programmatic brain access (R6)](tickets/R6-ox-alpha-programmatic-brain-access.md): OpenCode Zen gateway (`https://opencode.ai/zen/v1`, Bearer key) serves `x-preview-f-free`; vision YES; effort via low/high/max variants + temperature; `opencode serve` is wrong plane (agent APIs, not completions); fallbacks OpenRouter→Groq behind same adapter.
- [Public-domain drawing corpus (E2)](tickets/E2-public-domain-drawing-corpus-sourcing.md): 29 verified sources — FHWA case studies + CFL plan sheets (PD), two real NSIP Stage-1 RSA reports w/ swept paths (OGL), DMRB GG 119 (OGL), Wikimedia PD diagrams; CC BY-SA rejected.

- [Audit node contracts N1](tickets/N1-audit-node-contracts-ag-*.md): SHARED-STATE.md defines SharedState slices + AuditArtifact envelope + closed payload_kind set; 11 contracts validated via js-yaml emitter script; classes deterministic x9 / ai-bounded AI-CANDIDATES / human ADJUDICATION.
- [Admin auth seam D1](tickets/D1-admin-auth-seam-for-developer-surfaces.md): requireAdmin fail-closed (byte-equal denials), timing-safe digest compare, 30/min bucket; 5 unit tests; suite 57/57.
- [Image storage decision M1](tickets/M1-image-storage-constraints-plus-decision.md): inline data-URLs <=500KB/image <=12/project (measured: Upstash 10MiB req cap, Vercel 4.5MB body, ~0.7s@500KB); Blob escape hatch documented; side-finding fixed: pipeline-form bodies had silently disabled KV-mode rate limiting.
- [Inference topology R7](tickets/R7-inference-topology-decision.md): Direct Zen fetch from Vercel functions; effort cand=high/sum=low/judge=max; ≤60s per call, ≤3 calls per audit, $0 free-tier cap; chain Zen→OpenRouter→Groq→Off; 4-probe smoke gate precedes A1.
- [Eval gate ladder E1](tickets/E1-eval-gate-ladder-design.md): pass = all dims ≥1 AND substance=2 AND evidence=2; corpus mark 90 %; zero-drop regression tolerance; Tier-2 triggers confirmed; dry-run GF-1..5 first.
- [Step-mode pipeline executor N2](tickets/N2-step-mode-pipeline-executor-refactor.md): AuditPipeline seam (sync runAll/runNode/describe, async persistRun); 11-node registry mirrors graph-state edges; AI-CANDIDATES seam-wired with Off default; goldens byte-stable, folded-runNode ≡ runAll proven; 75/75 green.
- [Live AiAdapter A1](tickets/A1-aiadapter-live-implementation.md): ZenAiAdapter fetch-only env-gated client; ajv boundary + one repair retry + graceful empty; R7 budgets encoded (60s/3-calls/breaker/fallback); async runAllLive driver conducts AI-CANDIDATES; sync path byte-identical.
- [Inference contracts A2](tickets/A2-inference-contracts-per-node.md): AI-CANDIDATES bounded+active; QUESTIONS missing-info proposals allowed-but-dormant (declared shape); recommendation drafting rejected for now; behavior tests enforce emitted⊆declared, field-subset projection, refusal artifacts.
- [Corpus fixtures E3](tickets/E3-sample-projects-from-corpus.md): GF-6..10 across UK S1 / US prelim+final / INT prelim / CA planning; OGL-explicit + PD-explicit provenance; ORCH-as-judge baselines schema-validated; Tier-0 snapshots recorded; UAE absent pending licensing.
- [Attachment inputs M2](tickets/M2-input-model-extension-for-attachments.md): Attachment model per M1 shape; magic-byte intake on existing upload route; inline data-URLs via Repository seam; paste/picker UI with thumbnails; DataStore.del(); PATCH preserves links on text edits.
- [Eval harness E4](tickets/E4-eval-harness-runner-plus-judge-scorecards.md): runner + gate math + workflow_dispatch CI job; first LIVE archive judged by ox-alpha@max over all 5 fixtures — honest FAILs (0–50% vs 90% mark) recorded with Tier-2 flags; judge-drift fog graduates.
- [Dev-tab prototype D2](tickets/D2-dev-tab-ux-prototype.md): owner verdict **Candidate A (zero-dep SVG/CSS)** carries into #15 D3; prototypes inspectable in scratch/devtab.
- [Vault charter V1](tickets/V1-vault-charter-plus-structure-hybrid.md): charter **blessed as written**; vault/ live on main (zones: append-only journals / human-curated notes / machine views; state/ wins ties); unblocks #10.
- [Artifact persistence N3](tickets/N3-node-artifact-persistence-layout.md): Repository artifact trails under ws:{ws}:art:{pid}:{aid}:{node}:{seq}; retention latest-full/prior-summary; 512KB write-time cap; replay trusts verified else regenerates.
- [Vault compilers V2](tickets/V2-vault-compile-scripts-both-directions.md): export registries→117 view notes byte-deterministic; import chartered zones→state/vault-notes.json with charter contract enforcement; CI drift job.
- [Memory protocol V3](tickets/V3-agent-memory-protocol.md): workflow/vault-protocol.md — MUST-READ/MUST-WRITE per session type + graduation rules; wired into TRACKER.md; small by design.

## Not yet specified

- Judge-drift measurement: how to detect the judge model itself degrading over time
  (hangs on E1/E4 outcomes).
- Blob-storage escape hatch if Upstash value limits make data-URL images untenable
  (graduates from M1 findings).
- `opencode serve` hosting plane specifics (VM/tunnel vs gateway) if L1 finds no direct
  HTTP API (graduates from L1 findings into L2).
- Vault sync-conflict UX for concurrent human+agent edits (after V2 shows real patterns).
- Report-generation LLM assist (narrative sections of reports) — suspected follow-on once
  L4 lands; not yet sharp.
- Recommendation-drafting LLM assist: rejected by A2 until the eval corpus shows a quality
  baseline; revisits after E4 scorecards exist.

## Out of scope

- Live runtime editing of pipeline nodes/edges/prompts from the dev tab (step + inspect +
  toggle only; graph definitions stay code/contracts).
- AI producing final determinations, approvals, or professional certifications.
- Paid-only infrastructure commitments (free tiers first; paid only by explicit owner act).
- Docker / containerization (still deferred from mvp map).
- Stage 3 / Stage 4 jurisdiction support (architecture extends toward them; unchanged).

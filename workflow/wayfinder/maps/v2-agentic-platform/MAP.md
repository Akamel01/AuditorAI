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

## Out of scope

- Live runtime editing of pipeline nodes/edges/prompts from the dev tab (step + inspect +
  toggle only; graph definitions stay code/contracts).
- AI producing final determinations, approvals, or professional certifications.
- Paid-only infrastructure commitments (free tiers first; paid only by explicit owner act).
- Docker / containerization (still deferred from mvp map).
- Stage 3 / Stage 4 jurisdiction support (architecture extends toward them; unchanged).

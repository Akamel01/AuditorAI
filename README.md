# README

**AuditorAI** — an AI-assisted, evidence-grounded **Road Safety Auditor** web platform.

Supports Road Safety Audit practice for **International/general**, **United Kingdom**,
**United States**, **Canada**, and **United Arab Emirates**, across audit
**Stages 0–2**, with jurisdiction-specific stage semantics (never silently harmonized).

> ⚠️ This software assists the audit process. Final professional responsibility remains
> with the qualified auditor / road authority.

## Status

MVP under active development, orchestrated as a graph-engineered effort.
The live plan is the Wayfinder map: [`workflow/wayfinder/maps/mvp/MAP.md`](workflow/wayfinder/maps/mvp/MAP.md).
Canonical vocabulary: [`CONTEXT.md`](CONTEXT.md). Decisions: `docs/adr/` + `state/decision-registry.json`.

## Engineering method

Development itself runs as a graph: nodes with **Context + Contracts**, typed **Edges**
(`CONTROL DATA CONTEXT CONTRACT DEPENDENCY EVIDENCE VALIDATION FEEDBACK ESCALATION SPAWN
MERGE LOOP`), deterministic **shared state** in `state/*.json`, and controlled loops
(research / planning / implementation / architecture / audit-reasoning) with explicit
entry and exit conditions.

Two bounded graphs share this philosophy:

- **Development graph** — how this repo is built (`workflow/development-graph/`)
- **Audit graph** — what the product executes to run an audit (`workflow/audit-graph/`)

## Repository layout

```text
CONTEXT.md              canonical domain glossary (implementation-free)
docs/
  adr/                  architecture decision records (hard-to-reverse decisions)
  research/             cited findings from authoritative primary sources
  standards/            structured extracts of normative material
  architecture/         approved module map + graph topologies
  decisions/            lightweight decision log
  validation/           technical + domain validation records
state/                  deterministic shared state (JSON registries)
contracts/
  schemas/              versioned JSON Schemas
  node-contracts/       per-node context/contract documents
  edge-contracts/       typed edge semantics
policies/               versioned machine-readable jurisdiction policy packs
workflow/
  development-graph/    build orchestration topology
  audit-graph/          product audit pipeline topology
  wayfinder/            local-markdown tracker: map + decision tickets
tests/
  fixtures/ golden/ jurisdiction/ integration/ property/
scripts/                deterministic tooling (e.g. state validation)
```

## Rules of engagement (for any agent or engineer)

1. Reconstruct state from the repository — never from chat history.
2. Read `CONTEXT.md`, relevant ADRs, and applicable contracts before executing a node.
3. Normative claims require evidence registry provenance; no rule without a source.
4. Subagents never redefine terminology, schemas, mappings, or scope — they propose
   through the decision process.
5. Compliance ≠ safety. The system must never label a scheme "safe" because checklist
   items pass.
6. Never report a test as passing that you did not run.

## Development

```bash
npm ci                            # install
npm run dev                       # run locally
npm run ci                        # lint + typecheck + test + build
node scripts/compile-evidence.mjs # regenerate evidence registry from research docs
node scripts/validate-state.mjs   # validate shared state
```

## Deployment

Vercel free tier — two options in [`docs/deployment.md`](docs/deployment.md)
(dashboard import ≈ 5 minutes, or automatic CI deploys once `VERCEL_*` secrets exist).
Persistence uses an Upstash/Vercel-KV free Redis via env vars; without it the app runs on
an in-memory fallback.

## License

MIT — see [LICENSE](LICENSE).

# D09-COVERAGE

node_id: D09-COVERAGE
graph: discovery_graph
class: deterministic
writes: coverage
emits: coverage.view

## Purpose

ODD Coverage Score: 16-cell targets weighted gap+risk vs TARGET_TOTAL=500; structurally_absent excluded.

## Invariants

- Cell identity = jurisdiction dir-id + canonical multiset (same rule as src/domain/odd.ts).
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "coverage.view" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


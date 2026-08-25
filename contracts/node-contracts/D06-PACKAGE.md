# D06-PACKAGE

node_id: D06-PACKAGE
graph: discovery_graph
class: deterministic
writes: package
emits: package.assemblies

## Purpose

Assemble project-package record: inputs/drawings vs outputs; completeness vocabulary from sample-corpus.

## Invariants

- designer_response always present (may be empty array); source_urls union of hit+doc URLs.
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "package.assemblies" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


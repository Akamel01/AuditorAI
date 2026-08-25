# D08-QUALITY

node_id: D08-QUALITY
graph: discovery_graph
class: deterministic
writes: quality
emits: quality.verdicts

## Purpose

Exact sha256 + normalized-text near-dup verdicts against dedupe index; unique claims fingerprints.

## Invariants

- full-package + unknown licence => human_required true (owner review).
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "quality.verdicts" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


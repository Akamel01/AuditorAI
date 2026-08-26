# D03-MATCH

node_id: D03-MATCH
graph: discovery_graph
class: deterministic
writes: matched
emits: match.assignments

## Purpose

Jurisdiction/framework/native-stage assignment reusing getPack + resolveOdd; structurally_absent refused.

## Invariants

- Refusals recorded as artifacts-side list; odd_status stamped from resolveOdd only.
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "match.assignments" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


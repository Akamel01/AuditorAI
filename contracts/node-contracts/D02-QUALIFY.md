# D02-QUALIFY

node_id: D02-QUALIFY
graph: discovery_graph
class: deterministic
writes: qualified
emits: qualification.verdicts

## Purpose

Deterministic in_scope/reserve/reject over hits (R1-R4 analogue); tier-1 licensed stays reserve pending owner approval.

## Invariants

- Every hit gets exactly one verdict with >=1 reason.
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "qualification.verdicts" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


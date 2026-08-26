# D10-QUEUE

node_id: D10-QUEUE
graph: discovery_graph
class: deterministic
writes: queue
emits: queue.items

## Purpose

Ranked discovery queue (gap_share x risk) feeding next D01 cycle.

## Invariants

- Pure derived view; recomputed from coverage, never hand-edited.
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "queue.items" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


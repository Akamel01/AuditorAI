# D05-CLASSIFY

node_id: D05-CLASSIFY
graph: discovery_graph
class: deterministic
writes: classified
emits: classification.labelsets

## Purpose

Keyword-ruleset doc roles; confidence <0.7 auto-reserve per owner decision 2026-08-25.

## Invariants

- auto_reserved_doc_ids traced; labels never widen DocRole set.
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "classification.labelsets" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


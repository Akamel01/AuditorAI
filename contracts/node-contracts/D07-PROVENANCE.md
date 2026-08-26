# D07-PROVENANCE

node_id: D07-PROVENANCE
graph: discovery_graph
class: deterministic
writes: provenance
emits: provenance.records

## Purpose

Mint byte-stable provenance chain URL->sha256->extraction->classifier->ODD cell.

## Invariants

- Fixed key order; firewall_tainted false unless owner sets it.
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "provenance.records" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


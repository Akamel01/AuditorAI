# D01-DISCOVER

node_id: D01-DISCOVER
graph: discovery_graph
class: deterministic
writes: discovery_hits
emits: discovery.hitset

## Purpose

Portal/search fan-out through DiscoveryProvider seam; OFF-by-default adapters; polite 1rps/2-conc per host.

## Invariants

- Hits carry provider_id+source_type+licence_hint; cross-provider URL collapse keeps first hit.
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "discovery.hitset" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


# D04-ACQUIRE

node_id: D04-ACQUIRE
graph: discovery_graph
class: deterministic
writes: acquired
emits: acquisition.bundles

## Purpose

Fetch docs per match; unpdf text/page extraction; raster/OCR pending recorded as nulls — pages never dropped.

## Invariants

- sha256 over exact bytes; page_count honest incl 0 for unreadable PDFs (engine=unpdf:failed).
- Slices replaced whole; no conversational memory is authoritative state.
- ran_at stays outside payloads (artifact created_at only).

## Inputs / Outputs

Reads upstream slices per graph-state.json edges; emits "acquisition.bundles" artifact plus its slice patch.

## Human gate

None inside this node. Owner gates live at D08 escalation (full-package + unknown licence) and at any cell-flip (Tier-1 trigger path 5).


# 06 — Programmatic per-cell data table (replace hand-stated §02 rows)

Type: research · Status: resolved · Blocked by: —

## Question

Derive the diagram's §02 data-requirements table programmatically: per ODD cell — input
floor classes (from policies/odd.json), few-shot count (from sample-corpus roles),
calib count, fixture ids + gate status (from latest archive), promotion needs. Output
feeds ticket 04's rendering. Flags fragile cells (e.g., USA-final single fixture).
No hand-maintained numbers may survive.

## Answer

RESOLVED; 16 rows derived; usa×DETAILED flagged fragile.

Deliverable written: `docs/architecture/per-cell-data-table.md` (markdown table + fragile-cell list + machine-readable JSON block for ticket 04).

### Sources read

- `policies/odd.json` — declaration v1.1.2, 16 cells (5 in / 10 mapped_unproven / 1 structurally_absent), per-cell `input_floor`, `fixture_ids`, `incident_flags` (all empty).
- `state/sample-corpus.json` — generated 2026-08-25; 78 samples; role census 6 engine-fewshot / 26 judge-calibration / 41 reserve / 5 unassigned.
- `state/readiness-report.json` — latest archive `2026-08-25T07-34-03-343Z`; per-fixture gate marks for GF-1..GF-16.
- ADR-0005 (ODD: conjunctive membership, input floors, three-zone edges, declaration log) and ADR-0007 (role semantics, R1–R4, firewall).

### Derivation rules (all numbers traceable to JSON)

1. **Cell identity/order**: exactly `policies/odd.json cells[]` order; cross-checked against `readiness-report.odd_cells[]` (16 = 16, same statuses).
2. **Input floor classes**: verbatim `input_floor[]` per cell; count = array length.
3. **Fixtures & gates**: fixture ids from `odd.json fixture_ids`; gate marks joined on `readiness-report.fixtures[].id` at the latest archive run (`scored/unscored` shown). All 11 assigned fixtures PASS; `incident_flags` empty (consistent with ADR-0005 log v1.0.1 clearing the CA planning incident).
4. **Few-shot n**: samples with `roles ∋ engine-fewshot`, attributed to a cell only when the record pins one declared IN cell: explicit token in `odd_cell_status` (`in:UKxPRELIM` → int-008; `in:USxPRELIM` → us-008), or jurisdiction + stated canonical stage where the jurisdiction has exactly one matching IN cell (us-017 states PRELIMINARY_DESIGN → usa×PRELIM; ca-011 is Canada few-shot and canada has exactly one IN cell → CA×FEASIBILITY). Result: uk×PRELIM 1, usa×PRELIM 2, canada×FEASIBILITY 2, others 0.
5. **Calib n**: samples with `roles ∋ judge-calibration`, attributed via stage/cell tokens in `odd_cell_status`/notes: `in:UKxPRELIM*` (int-004..007, int-009), "uk/ireland stage 1" (int-011..013, int-015, int-025), combined "stage 1&2" spans both UK stages mirroring the S12-combined pattern (int-010 → uk×PRELIM+uk×DETAILED; int-014 → uk×DETAILED side plus PRELIM), ireland stage 2 (int-018 → uk×DETAILED), `INTxPRELIM,DETAILED` counts toward both INT cells (int-002), note-stated proof-effort link (us-014 RI case → canada×FEASIBILITY_CONCEPT). Tallies: uk×PRELIM 11, uk×DETAILED 3, international×PRELIM 1, international×DETAILED 1, canada×FEASIBILITY 1.
6. **Promotion strings** (rule-based): `status=in` → "keep fixtures green"; `mapped_unproven ∧ input_floor≠∅` → "needs 1 authentic fixture + Tier-1 pass" (N=1 from ADR-0005 corollary: first gate-passing sample flips the cell IN); `mapped_unproven ∧ input_floor=∅` → "floor definition needed"; `structurally_absent` → "never IN — pack forbids".
7. **Fragile** = `status=in ∧ fixture count<2` → usa×DETAILED_DESIGN only (GF-8 single).

### Ambiguities / judgment calls

- **Unattributed corpus mass excluded rather than forced**: us-010 ("pre-audit packet (no cell alone)") is the 6th few-shot but names no cell; 11 of 26 calib samples are compilations, boundary cases (ca-010 concept/prelim), or stage-less (ae-001, int-020, int-028, int-030, int-031, us-026, us-027, us-028, us-029, us-cat). They are listed explicitly in the deliverable's "unattributed" section so per-cell sums reconcile against the census (6 fewshot, 26 calib).
- **Multi-stage attribution double-counts across cells by design** (int-002, int-010, int-014 each count toward 2 cells); distinct-sample reconciliation is in the JSON block.
- **Ireland/NZ-lineage outputs** filed under `jurisdiction=international` were attributed to UK framework stages when the record names UK-vocabulary stages (Ireland follows GG 119-style numbering); NZ material is Reserve/outside.
- GF-6's partial scoring (1 scored / 1 unscored at latest archive) surfaced in the table since it touches the already-flagged fragile-adjacent UK cell; no action derived from it here.

Sanity check: rows sum to 16 cells (5 IN · 10 mapped_unproven · 1 structurally_absent) — matches `odd.json` and `readiness-report.odd_cells`.


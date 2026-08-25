# ADR-0005: Operational Design Domain — capability matrix with conjunctive membership and three-zone edge semantics

- **Status:** Accepted
- **Date:** 2026-08-23
- **Decided in:** dedicated owner grilling session (handoff `handoff-odd-formal-definition.md`)
- **Evidence:** stage-normalization mappings [docs/research/stage-normalization.md]; jurisdiction
  research set [EV-IN-*, EV-UK-*, EV-US-*, EV-CA-*, EV-AE-*]; precedent vocabularies SAE J3016_202104,
  ISO 34503:2023, BSI PAS 1883, UK Automated Vehicles Act 2024 (concepts adapted, not imported)

## Context

AuditorAI produces audit findings whose professional weight depends on what the system can
rightly claim to do. Until now no artifact declared the boundary of those claims: jurisdiction
packs exist for five jurisdictions, canonical stages stop at detailed design by brief, and
corpus fixtures prove five projects — but nothing states *where the product's claimed
competence ends*. Three forces make this acute:

1. The readiness-framework-data campaign needs a crisp sample-inclusion rule; it is the
   downstream consumer of exactly this boundary.
2. Jurisdictions disagree structurally: GG 119 defines no feasibility/concept audit anywhere
   in its text [EV-UK-004]; US guidance names project phases, never numbered stages
   [EV-US-006]; Abu Dhabi sanctions a combined Stage 1/2 spanning two canonical stages
   [EV-AE-012]. Any flat "we support X, Y, Z" claim silently implies intersections that do
   not exist.
3. Driving-automation standardization solved the generic problem — declare the envelope,
   version it, and define out-of-envelope behavior instead of drifting silently (J3016 ODD;
   ISO 34503 hierarchical taxonomy; AV Act 2024 ss.4(3)(c), 7, 10). For a documentary product,
   envelope checking collapses into intake validation rather than real-time monitoring.

## Decision

1. **Shape — capability matrix.** The ODD is a matrix of Framework × Canonical Stage cells.
   Structural absences are first-class cell states (UK × FEASIBILITY_CONCEPT = absent because
   GG 119 defines no such audit), so overclaiming is impossible by construction.
2. **Membership — conjunctive.** A cell is IN only when both hold: an accepted native↔canonical
   mapping in stage-normalization AND ≥1 gate-passing corpus fixture for that project.
3. **Governing evidence — proven pass + incident flag.** Membership reads from any archived
   passing run at the current fixture version; if the latest full archive fails a member
   project, the cell stays IN but carries an active incident flag until re-resolved under
   eval-gates §5.
4. **Edge behavior — split by reason.**
   - Structurally absent → refuse (no normative basis exists to reason from).
   - Mapped-unproven (accepted mapping, no passing fixture) → run allowed, every output
     stamped "outside ODD v1 — validation pending".
   - In-cell thin inputs → existing Input State / limitations machinery (degradation, not exit).
5. **Input floors.** Each IN cell declares minimum input classes the capability claim presumes
   (mirroring what frameworks demand of human auditors, e.g., GG 119 Appendix C brief items
   [EV-UK-014]). Below the floor, the run is outside the cell's claim entirely — distinct from
   degraded-but-valid operation. Tolerances already coded (≤500 KB images, ≤12/project,
   MAX_IMAGES_PER_CALL=4 [M1/M3]) sit above floors as capacity, not requirement.
6. **Inherited scopes.** Road-user coverage inherits the CONTEXT.md Road User term wholesale;
   scheme-type applicability inherits each framework's own native scope statement per cell
   (e.g., UK physical-change rule [EV-UK-006], Abu Dhabi Appendix A scaling [EV-AE-013],
   Alberta exclusions [EV-CA-012]). No canonical scheme taxonomy is invented.
7. **Versioning & gates.** The ODD lives as this ADR plus a versioned machine-readable
   declaration (matrix, floors, per-cell status) consumed by intake/refusal/stamping logic.
   Editing that declaration becomes an explicit Tier-1 trigger path (eval-gates §2 amended in
   this session); cell/floor changes are logged here as bumps.
8. **Claim language — three zones.** Inside an IN cell with floor met: capability claims
   permitted ("audits UK Stage 1 given X"). Mapped-unproven: "validation pending" phrasing
   only. Structurally absent or outside: no capability claims, description only.

### Matrix snapshot, v1 (ratified 2026-08-23)

| Framework | Cell (native → canonical) | Status | Notes |
|---|---|---|---|
| UK GG 119 | Stage 1 → PRELIMINARY_DESIGN | **IN** | GF-6 passes |
| USA FHWA | Preliminary Design phase → PRELIMINARY_DESIGN | **IN** | GF-7 passes |
| USA FHWA | Final Design phase → DETAILED_DESIGN | **IN** | GF-8 passes |
| INT PIARC baseline | Preliminary design → PRELIMINARY_DESIGN | **IN** | GF-9 passes; qualified baseline [EV-IN-001..008] |
| Canada TAC/AB | Planning (AB S1) → FEASIBILITY_CONCEPT | **IN ⚑ incident** | GF-10 passed (09-32-11Z, 10-32-40Z); latest archive 19-37-04Z fails JB-GF10-002 grounding after VAL-024 fabricated-evidence purge — open §5 procedure |
| UAE AD DMT/TR-540 | Stage 0 / 1 / combined 1&2 / 2 → respective canonical | mapped-unproven | authoritative manual; zero fixtures pending licensing [E3] |
| UK GG 119 | Interim RSA; Stages 3–4 | structurally absent (v1) | interim ≠ stage [EV-UK-005]; 3/4 out of MVP scope |
| USA FHWA | Work Zone / Pre-Opening / Existing Road / Land Use | structurally absent (v1) | [EV-US-006][EV-US-015] |
| All | POST_OPENING / CONSTRUCTION canonical stages | structurally absent (v1) | enum reserved, unclaimed |

## Alternatives considered

- **Flat lists** of jurisdictions + stages: discarded — implies UK×feasibility support that
  structurally does not exist.
- **Mapping-backed membership** (claim all accepted mappings): discarded — would claim UAE
  cells the product has never executed.
- **Fixture-only membership**: discarded — bootstrap deadlock; the readiness campaign could
  never create a new cell.
- **Hard refuse everywhere outside the matrix:** discarded — refuses runs on unproven-but-
  legitimate packs; honesty belongs on the output stamp.
- **Label-only edge behavior:** discarded — a run against a framework with no such native
  audit must not produce findings at all.
- **Input adequacy fully delegated to Audit Contract/Input State:** discarded — "supports UK
  S1" becomes technically true for evidence-free runs; even human auditors demand a floor
  brief.
- **Canonical scheme taxonomy:** discarded — invents vocabulary no framework uses; native
  scope statements already bound each cell.

## Consequences

- Implementation ticket (fogged): compile the machine-readable declaration from this ADR +
  stage-normalization; wire refusal/stamping into intake; floors populated from corpus
  manifests at first compile.
- eval-gates §2 gains trigger path 5 (declaration edits). First declaration edit therefore
  requires a fresh Tier-1 archive attached to release checklists.
- Readiness-campaign corollary (records the seed-Q7 rule): samples are eligible iff they
  target an IN or mapped-unproven cell; the first gate-passing sample on a mapped-unproven
  cell flips it IN mechanically.
- Open item carried, not hidden: GF-10's latest-archive failure (VAL-024 fallout) keeps the
  CA planning cell incident-flagged; resolution follows gates §5 in a separate session.
- Claims surfaces (README, report covers, marketing copy) inherit three-zone discipline; no
  code enforces prose today.

### Declaration log

- **v1.0.0 (2026-08-23):** initial `policies/odd.json` + `contracts/schemas/odd-declaration.schema.json`
  + invariant tests (`tests/domain/odd-declaration.test.ts`). 10 cells: 5 IN (CA planning
  incident-flagged), 4 UAE mapped-unproven, UK×feasibility structurally absent. Floors derived
  from GF-6..10 manifests, owner-blessed. Refinements vs blessed schema: `canonical_stage` is an
  array (combined-audit spans); omissions default-refuse. Phase-2 wiring (intake refusal +
  result stamping) deferred until candidate-review lands.
- **v1.0.1 (2026-08-24):** CA×FEASIBILITY_CONCEPT incident flag cleared via eval-gates §5
  swap+re-test re-baseline (VAL-2026-08-22-027; accepting run `2026-08-24T06-11-08-387Z`,
  supersedes failing `2026-08-23T19-37-04-183Z`). Cell remains IN, now unflagged. No cell
  status changes; declaration content otherwise unchanged.
- **v1.1.0 (2026-08-24):** matrix expanded to the full pack surface — every mvp_scope stage
  of all five packs is now declared; legacy stages without judged fixtures are honestly
  `mapped_unproven` with empty floors. 16 cells: 5 IN, 10 mapped-unproven, 1 structurally-
  absent. Phase-2 wiring landed: intake refuses structurally-absent/unlisted selections
  (`OddOutsideDomainError`, HTTP 422 via ERROR_TABLE); mapped-unproven results carry the
  three-zone stamp "outside ODD v<ver> — validation pending" in limitations + `odd_*`
  result fields (`contracts/schemas/audit-result.schema.json` extended additively).
- **v1.1.1 (2026-08-24):** IN-cell fixture_ids deepened with real-scheme conversions —
  UK×PRELIMINARY_DESIGN + GF-11 (A9 Ballinluig), US×PRELIMINARY_DESIGN + GF-12 (Hingham
  Derby St), CA×FEASIBILITY_CONCEPT + GF-13 (NEAHD Ring Road). All three passed Tier-1 in
  run `2026-08-24T08-08-49-444Z`. No status changes; UAE cells remain mapped-unproven by
  owner ruling (ADR-0007) pending authentic worked-example material.
- **v1.1.2 (2026-08-25):** second conversion wave (readiness-framework map ticket 01) —
  US×PRELIMINARY_DESIGN + GF-14 (Somerville McGrath Hwy), CA×FEASIBILITY_CONCEPT +
  GF-15 (34 St FPS §5.12), INT×PRELIMINARY_DESIGN + GF-16 (Milltown Park, incl. the
  corpus's first rejected-recommendation artifact as provenance). All three fully scored
  at 100% in run `2026-08-25T07-34-03-343Z`. No status changes.

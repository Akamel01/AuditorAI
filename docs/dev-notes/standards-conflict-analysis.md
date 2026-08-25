# Standards Conflict Analysis

Cross-jurisdiction conflicts surfaced during research and how each was resolved or carried.
Companion to `stage-normalization.md`; resolutions cite evidence records.

## C1. Stage numbering collisions (RESOLVED)

Alberta `ca-ab:S3` = detailed design [EV-CA-006] while UK `uk:S3` = post-construction
[EV-UK-002]. Resolution: jurisdiction-namespaced native ids; bare integers forbidden;
canonical three-point key internal only (ADR-0002).

## C2. Stages vs phases (RESOLVED structurally)

US federal guidance defines no numbered stages; phases attach to one eight-step process
[EV-US-006]. UK enumerates exactly four stages [EV-UK-002]. Resolution: US pack stores
phases; UI always renders native vocabulary; mapping confidence downgraded to `interpreted`
where the mapping is AuditorAI's construction.

## C3. Feasibility-stage availability (RESOLVED as availability data)

Abu Dhabi natively audits at Stage 0 [EV-AE-004]; TAC planning stage equivalent exists
[EV-CA-005]; GG 119 has none and its four-stage list is exhaustive [EV-UK-004]. Resolution:
per-framework stage availability flags; no universal Stage 0 implied anywhere in UI.

## C4. Combined audits (RESOLVED via one mechanism)

Abu Dhabi permits a single combined Stage 1/2 report for smaller schemes [EV-AE-012];
GG 119 permits combining S1+S2 where no preliminary design occurred [EV-UK-008]. Different
eligibility conditions, same structural pattern → modeled once (`combined_audit`, spans
two native stages) with per-framework condition text.

## C5. Severity scoring divergence (RESOLVED as null-safe)

GG 119 assigns no severity scores; formal risk assessment sits in designer response
[EV-UK-024]. US practice uses an optional qualitative frequency×severity matrix (A–F)
[EV-US-016][EV-US-017]. Canadian municipal guidance carries its own matrix [EV-CA-021].
Resolution: canonical finding model stores structured risk components that may be null,
each tagged with the framework scale id when present; UK mode renders an explicit
"not scored under this framework" state instead of inventing numbers.

## C6. Researcher-proposed international stage numbering vs ADR-0002 (RESOLVED)

`international-rsa-research.md` proposed "S1 ≈ preliminary+detailed design combined".
That conflicts with the canonical three-point model locked by ADR-0002 and would silently
merge two distinct canonical points. PIARC's own checklist enumeration names feasibility
study, preliminary design, and detailed design separately [EV-IN-004], so the canonical
mapping stands: three interpreted mappings, one per canonical point. The researcher's
proposal is superseded; noted here so the reasoning is auditable.

## C7. Terminology drift around "audit" (CARRIED, labelled)

PIARC cautions some countries call safety inspections of existing roads "audits"
[EV-IN-003]; NCHRP notes "road safety assessments" naming [EV-US-019]. Resolution: product
vocabulary fixed by CONTEXT.md; jurisdiction packs keep native labels; no silent renaming.

## C8. Paywalled / inaccessible primaries (CARRIED honestly)

TAC CRSAG full text paywalled (captured via catalogue metadata + provincial quotations)
[EV-CA-001]; Dubai RTA manual contents unverified [EV-AE-025]; TR-540 amended text
unreachable. Resolution: affected claims carry reduced confidence; packs mark these
framework elements `Unknown` rather than guessing; revisit triggers recorded.

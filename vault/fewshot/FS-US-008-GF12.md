---
exemplar_id: FS-US-008-GF12
sample_ids:
  - us-008-ma-hingham-derby-st-route3-rsa
jurisdiction: US
native_stage_id: us-fhwa:preliminary-design
canonical_stage: PRELIMINARY_DESIGN
programme: hingham-derby-st
provenance_outcome_id: null-seed
approved_by: owner
approved_at: 2026-08-25
---

Owner-seeded exemplar from the us-008 (Hingham Derby St) engine-fewshot sample —
the same scheme the GF-12 eval fixture exercises. Teaches ramp-terminal
pedestrian crossing candidates at US preliminary design.

```json
{
  "kind": "safety_concern",
  "category": "ramp_terminal_pedestrian_crossings",
  "location": "Route 3 Northbound ramp entrances/exits at Derby Street",
  "road_users": ["pedestrians", "drivers"],
  "scenario": "Sidewalks continue across the Route 3 NB ramp terminals but no delineated crossings or accessible ramps exist; vegetation limits driver visibility of pedestrians at high-volume merge points.",
  "statement": {
    "text": "Provide delineated, MUTCD-signed crossings with accessible wheelchair ramps at the Route 3 Northbound ramp entrances and exits.",
    "normative_basis_note": null
  },
  "evidence": [
    { "evidence_id": "EV-US-001", "quote": null, "use": "supports_concern" }
  ],
  "assumptions": [],
  "rationale": "Geometric and visibility reasoning over the ramp-terminal layout that a deterministic rule set cannot express.",
  "recommendation": "Install high-visibility crosswalks and ADA-compliant ramps at both ramp terminals before construction documentation.",
  "producer": "safety-reasoning-agent"
}
```

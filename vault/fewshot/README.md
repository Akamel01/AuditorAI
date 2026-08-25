---
store_version: 1
---
# Few-shot exemplar sources (ADR-0011)

This zone is the **source of truth** for the compiled few-shot store
`state/few-shot-store.json`. It is NOT a chartered prose zone: `vault-import`
ignores it by design. Edit records here, then run
`node scripts/compile-fewshot.mjs` and commit the regenerated store file.
Never edit `state/few-shot-store.json` by hand.

## Record format

One exemplar per file, named `<exemplar_id>.md`. Front-matter fields:

| field                  | required | meaning                                                        |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `exemplar_id`          | yes      | stable id (`FS-*`), unique across the zone                      |
| `sample_ids`           | yes      | cataloged source sample(s) in `state/sample-corpus.json`; every source must hold the `engine-fewshot` role (firewall: a release-test source is a compile error) |
| `jurisdiction`         | yes      | one of `INT \| UK \| US \| CA \| AE`                            |
| `native_stage_id`      | yes      | native stage the exemplar teaches (e.g. `us-fhwa:preliminary-design`) |
| `canonical_stage`      | yes      | `FEASIBILITY_CONCEPT \| PRELIMINARY_DESIGN \| DETAILED_DESIGN`  |
| `programme`            | no       | cluster key (one scheme/corridor); selection dedupes clusters   |
| `provenance_outcome_id`| yes      | promoted CandidateOutcome lineage, or the literal token `null-seed` for owner-seeded exemplars without an outcome row |
| `approved_by`          | yes      | must be `owner` (promotion gate; auto-pool entries never land here unapproved) |
| `approved_at`          | yes      | approval date `YYYY-MM-DD`                                      |

The note body carries one fenced ```json block: the `candidate_snapshot`
(a full CandidateFindingRecord as presented for adjudication).

## Versioning

Bump `store_version` in this file's front-matter on every promotion/removal;
runs stamp the exemplar ids they used so quality changes are attributable to
specific store versions (ADR-0011 §4).

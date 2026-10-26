# Ambiguous documents under stage rule set v2

Ticket: `Akamel01/AuditorAI#62`. Generated from the committed sidecar `docs/research/stage-rules/classifications-v2.jsonl` by `npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/classifications-v2.jsonl --ambiguous-out docs/research/stage-rules/ambiguous-v2.md` — no corpus, no network.

**25** of 33 documents in the corpus of record are ambiguous.

| document (sha256) | real title | candidate 1 (stage · confidence · rule ids) | candidate 2 (stage · confidence · rule ids) | n candidates | scope_basis | cell if adjudicated at candidate 1 |
|---|---|---|---|---|---|---|
| `0421ca4b9d06` | APPENDIX H | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `0d9a76ff4e71` | Transitway Station Design | `DETAILED_DESIGN` · inferred · CA-AMBIG-PCT | `PRELIMINARY_DESIGN` · inferred · CA-AMBIG-PCT | 2 | own_scope | `canada:DETAILED_DESIGN` |
| `1530d327c4c3` | MINISTÈRE DES TRANSPORTS ET DE LA MOBILITÉ DURABLE | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRE_OPENING` · inferred · CA-PREOPEN | 6 | taxonomy_reference | `canada:FEASIBILITY_CONCEPT` |
| `1d5879a68c55` | ROAD SAFETY AUDIT STAGE 1: SPRINT SCHEME | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `299ac961228e` | A795 Ambridge Bypass | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `2b3115c3438b` | CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `2d8e41b8631a` | DBFL Consulting Engineers | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 3 | taxonomy_reference | `canada:FEASIBILITY_CONCEPT` |
| `2ea94190b6df` | Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference, Whistler, BC June 8-11, 2008 | `DETAILED_DESIGN` · inferred · CA-DETAIL | `PRE_OPENING` · inferred · CA-PREOPEN | 4 | taxonomy_reference | `canada:DETAILED_DESIGN` |
| `3048eccbe2de` | Transportation Association of Canada | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `DETAILED_DESIGN` · inferred · CA-DETAIL | 3 | taxonomy_reference | `canada:PRELIMINARY_DESIGN` |
| `32bced315fcd` | UNION ECONOMIQUE ET MONETAIRE | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL-FR | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `37863ef8e713` | VOLUME 4: ROAD SAFETY AUDITS Final Draft: 25 May 1999 6-1 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 6 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `478f0847ff25` | A Process Management Approach to | `DETAILED_DESIGN` · inferred · CA-DETAIL | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:DETAILED_DESIGN` |
| `5d29a43bb076` | City of Ottawa Project Agreement - Schedule 15-2 Part 2 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `603f3f01f781` | Proposed Lidl Store: Mottingham Road Bromley | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `60d10b708b62` | Bessborough Housing Development Road Safety Audit – Stage 1 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `6c0ffc7cd483` | M E M O / N O T E D E S E R V I C E | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `7b9715f0d030` | Annex 6 – Road Safety Audit | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 5 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `a6e1a1e96a0b` | Road Safety Audit Stage 1 - | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 3 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `a7d0fc4ae596` | PROPOSED WORKS IN KILLORGLIN | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `a8020b20b358` | M E M O / N O T E D E S E R V I C E | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `babe092a5473` | WAITEMATA GREENWAYS PRE-OPENING | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `DETAILED_DESIGN` · inferred · CA-DETAIL | 4 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `bc5880b404bd` | CONFIDENTIAL | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `d4a57774fc55` | 23-160-006.01 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `ececad097781` | OCTOBER 2024 FINAL | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 3 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `ed2c0d694461` | Stage 1 Road Safety Audit | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |

An ambiguous document names two or more stages: it is recorded with **every** candidate, its confidence and the rule ids that fired, and it is assigned **no cell** — there is no Canadian multi-stage cell, and v1 already treats `MULTI_STAGE` as unmapped (`scripts/harvest-track-a-report.ts:34`). Ambiguity is reported, never resolved.

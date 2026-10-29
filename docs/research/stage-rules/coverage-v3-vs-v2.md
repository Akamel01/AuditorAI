# Stage coverage under rule set v3 versus v2

Ticket: `Akamel01/AuditorAI#69`. v3 policy: section-aware; rules unchanged from v2.

- v2 rules: `docs/research/stage-rules/stage-rules.v2.json` (`347bd328d910a924cc2b54b41a1c2dcce9b755942cc811377565712f3d920d8a`)
- v3 rules: `docs/research/stage-rules/stage-rules.v3.json` (`d374cfffd198965b1afa10f1d7d9952668f3caac8ea55486d807f832051523da`)
- v2 sidecar: `docs/research/stage-rules/classifications-v2.jsonl` (`41ea6f87361d69ac055609b2d581f86bef8b243236b4d9bb71ce046db425e8c1`), 33 rows
- manifest: `docs/RSA-Documents/canada-intake-manifest.jsonl` (`74cd84dd4ccf7de15fe4741745f416a46c908f036a3dcdce2bbc5e9f8a98b391`), 33 rows

Repro: `npx tsx scripts/harvest-stage-rules-v2.ts compare-v3 --manifest docs/RSA-Documents/canada-intake-manifest.jsonl --cache .autoforge/tmp/stage-rules-v2-cache --rules-v2 docs/research/stage-rules/stage-rules.v2.json --rules-v3 docs/research/stage-rules/stage-rules.v3.json --v2-sidecar docs/research/stage-rules/classifications-v2.jsonl --json-out docs/research/stage-rules/coverage-v3-vs-v2.json --sidecar-out docs/research/stage-rules/classifications-v3.jsonl --out docs/research/stage-rules/coverage-v3-vs-v2.md`

## §1 Denominators

- rows: 33
- v2 ambiguous: 25; non-ambiguous: 8
- docs with >=1 clear section: 22; without: 11
- stage sections: 64
- docs with >=2 distinct section stages: 5
- comparable: 32; non-comparable: 1
- bodies available: 33; unavailable: 0

## §2 Before/after by stage (33 Track A documents)

| Stage | v2 documents | v3 documents | v3 section documents | v3 stage sections | Δ documents |
|---|---|---|---|---|---|
| FEASIBILITY_CONCEPT | 3 | 14 | 14 | 27 | 11 |
| PRELIMINARY_DESIGN | 1 | 6 | 6 | 13 | 5 |
| DETAILED_DESIGN | 0 | 5 | 5 | 15 | 5 |
| PRE_OPENING | 0 | 2 | 2 | 4 | 2 |
| EXISTING | 0 | 1 | 1 | 3 | 1 |
| CONSTRUCTION | 0 | 1 | 1 | 2 | 1 |
| MULTI_STAGE | 25 | 7 | 0 | 0 | -18 |
| UNSTAGED | 4 | 4 | 0 | 0 | 0 |

25 of 33 ambiguous under v2; under v3, 5 documents have >= 2 distinct section stages, 64 stage sections were earned across 22 documents, and 11 documents have no clear section and use the v2-equivalent fallback.

## §3 By Canadian cell

### §3a Stage attribution over all 33 docs

| Cell | v2 documents | v3 documents | v3 section documents | v3 stage sections | Δ |
|---|---|---|---|---|---|
| `canada:FEASIBILITY_CONCEPT` | 3 | 14 | 14 | 27 | 11 |
| `canada:PRELIMINARY_DESIGN` | 1 | 6 | 6 | 13 | 5 |
| `canada:DETAILED_DESIGN` | 0 | 5 | 5 | 15 | 5 |

### §3b ODD coverage candidates

coverage candidates only; not the 33-doc population

Coverage candidate shas: `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95`

| Cell | target | v2 candidate documents | v3 candidate documents | v3 candidate section documents | v3 candidate stage sections | Δ |
|---|---|---|---|---|---|---|
| `canada:FEASIBILITY_CONCEPT` | 13 | 1 | 1 | 1 | 3 | 0 |
| `canada:PRELIMINARY_DESIGN` | 41 | 0 | 0 | 0 | 0 | 0 |
| `canada:DETAILED_DESIGN` | 41 | 0 | 0 | 0 | 0 | 0 |

## §4 Per-document (33 rows)

| sha (12) | title | v2 primary | v3 primary | v3 section stages | stage sections | first heading per stage | flags |
|---|---|---|---|---|---|---|---|
| `0421ca4b9d06` | APPENDIX H | MULTI_STAGE (ambiguous) | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN×1 | PRELIMINARY_DESIGN: Road Safety Audit – Preliminary Design Stage |  |
| `0af7ea584ae0` | PLANNING STAGE | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×3 | FEASIBILITY_CONCEPT: PLANNING STAGE |  |
| `0d9a76ff4e71` | Transitway Station Design | MULTI_STAGE (ambiguous) | MULTI_STAGE | — | — | — |  |
| `1530d327c4c3` | MINISTÈRE DES TRANSPORTS ET DE LA MOBILITÉ DURABLE | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×1 | FEASIBILITY_CONCEPT: 4.1 La planification annuelle des audits |  |
| `1d5879a68c55` | ROAD SAFETY AUDIT STAGE 1: SPRINT SCHEME | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×1 | FEASIBILITY_CONCEPT: ROAD SAFETY AUDIT STAGE 1: SPRINT SCHEME |  |
| `299ac961228e` | A795 Ambridge Bypass | MULTI_STAGE (ambiguous) | MULTI_STAGE | PRELIMINARY_DESIGN, FEASIBILITY_CONCEPT | PRELIMINARY_DESIGN×2; FEASIBILITY_CONCEPT×1 | PRELIMINARY_DESIGN: Stage 2 Road Safety Audit; FEASIBILITY_CONCEPT: 3. Items Raised At The Stage 1 Audit |  |
| `2b3115c3438b` | CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project | MULTI_STAGE (ambiguous) | DETAILED_DESIGN | DETAILED_DESIGN | DETAILED_DESIGN×1 | DETAILED_DESIGN: CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project |  |
| `2d4322f39383` | COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS’ RESPONSE | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×1 | FEASIBILITY_CONCEPT: COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS’ RESPONSE |  |
| `2d8e41b8631a` | DBFL Consulting Engineers | MULTI_STAGE (ambiguous) | DETAILED_DESIGN | DETAILED_DESIGN | DETAILED_DESIGN×1 | DETAILED_DESIGN: Stage 3 Road Safety Audit |  |
| `2ea94190b6df` | Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference, Whistler, BC June 8-11, 2008 | MULTI_STAGE (ambiguous) | MULTI_STAGE | — | — | — |  |
| `3048eccbe2de` | Transportation Association of Canada | MULTI_STAGE (ambiguous) | MULTI_STAGE | — | — | — |  |
| `32bced315fcd` | UNION ECONOMIQUE ET MONETAIRE | MULTI_STAGE (ambiguous) | MULTI_STAGE | — | — | — |  |
| `37863ef8e713` | VOLUME 4: ROAD SAFETY AUDITS Final Draft: 25 May 1999 6-1 | MULTI_STAGE (ambiguous) | MULTI_STAGE | DETAILED_DESIGN, CONSTRUCTION, PRE_OPENING, EXISTING | DETAILED_DESIGN×5; CONSTRUCTION×2; PRE_OPENING×3; EXISTING×3 | DETAILED_DESIGN: 6 STAGE 3 ROAD; CONSTRUCTION: 7.5 The Stage 4: Construction Stage Road Safety; PRE_OPENING: 8.1 The Stage 5 Road Safety Audit: Pre-opening; EXISTING: 9.1 Road Safety Audits on Existing Facilities and |  |
| `3b987d48a116` | DESIGNER’S RESPONSE | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×2 | FEASIBILITY_CONCEPT: TO STAGE 1 ROAD SAFETY AUDIT |  |
| `478f0847ff25` | A Process Management Approach to | MULTI_STAGE (ambiguous) | MULTI_STAGE | — | — | — |  |
| `555848f63c69` | Technical Circular T-02/04 | UNSTAGED | UNSTAGED | — | — | — |  |
| `5d29a43bb076` | City of Ottawa Project Agreement - Schedule 15-2 Part 2 | MULTI_STAGE (ambiguous) | MULTI_STAGE | FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN | FEASIBILITY_CONCEPT×2; PRELIMINARY_DESIGN×2 | FEASIBILITY_CONCEPT: 1. Road Safety Audit Certificate (Stage 1); PRELIMINARY_DESIGN: 2. Road Safety Audit Certificate (Stage 2) |  |
| `603f3f01f781` | Proposed Lidl Store: Mottingham Road Bromley | MULTI_STAGE (ambiguous) | MULTI_STAGE | PRELIMINARY_DESIGN, FEASIBILITY_CONCEPT | PRELIMINARY_DESIGN×3; FEASIBILITY_CONCEPT×1 | PRELIMINARY_DESIGN: Road Safety Audit: Stage 2, Proposed Lidl Store: Mottingham Road Bromley; FEASIBILITY_CONCEPT: 2 Items Raised at Previous Stage 1 Road Safety |  |
| `60d10b708b62` | Bessborough Housing Development Road Safety Audit – Stage 1 | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×2 | FEASIBILITY_CONCEPT: Stage 1 Road Safety Audit |  |
| `6c0ffc7cd483` | M E M O / N O T E D E S E R V I C E | MULTI_STAGE (ambiguous) | MULTI_STAGE | — | — | — |  |
| `7b9715f0d030` | Annex 6 – Road Safety Audit | MULTI_STAGE (ambiguous) | DETAILED_DESIGN | DETAILED_DESIGN | DETAILED_DESIGN×1 | DETAILED_DESIGN: Road Safety Audit Report – Detailed Design |  |
| `84a70638ba60` | Date: March 17, 2004 | UNSTAGED | UNSTAGED | — | — | — |  |
| `a6e1a1e96a0b` | Road Safety Audit Stage 1 - | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×3 | FEASIBILITY_CONCEPT: Road Safety Audit Stage 1 - |  |
| `a7d0fc4ae596` | PROPOSED WORKS IN KILLORGLIN | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×2 | FEASIBILITY_CONCEPT: Road Safety Audit Stage 1 |  |
| `a8020b20b358` | M E M O / N O T E D E S E R V I C E | MULTI_STAGE (ambiguous) | MULTI_STAGE | — | — | — |  |
| `babe092a5473` | WAITEMATA GREENWAYS PRE-OPENING | MULTI_STAGE (ambiguous) | PRE_OPENING | PRE_OPENING | PRE_OPENING×1 | PRE_OPENING: WAITEMATA GREENWAYS PRE-OPENING |  |
| `bc5880b404bd` | CONFIDENTIAL | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×3 | FEASIBILITY_CONCEPT: Stage 1 Road Safety Audit |  |
| `d16763daf5d4` | Note Méthodologique : audit de sécurité routière asr | UNSTAGED | UNSTAGED | — | — | — |  |
| `d4a57774fc55` | 23-160-006.01 | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×3 | FEASIBILITY_CONCEPT: Stage 1 Road Safety Audit Designer’s Response |  |
| `e8810b8a08ac` | A795 Ambridge Bypass | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN×3 | PRELIMINARY_DESIGN: Stage 2 Road Safety Audit |  |
| `ececad097781` | OCTOBER 2024 FINAL | MULTI_STAGE (ambiguous) | MULTI_STAGE | DETAILED_DESIGN, PRELIMINARY_DESIGN | DETAILED_DESIGN×7; PRELIMINARY_DESIGN×2 | DETAILED_DESIGN: Stage 3 Road Safety Audit; PRELIMINARY_DESIGN: COMMENTS AND RECOMMENDATIONS BY THE STAGE 2 ROAD SAFETY AUDIT TEAM |  |
| `ed2c0d694461` | Stage 1 Road Safety Audit | MULTI_STAGE (ambiguous) | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT×2 | FEASIBILITY_CONCEPT: Stage 1 Road Safety Audit |  |
| `f5b7f30aa814` | FULL DAYS | UNSTAGED | UNSTAGED | — | — | — | (title-only in v2 sidecar) |

## §5 Unresolved

| sha (12) | title | v2 | v3 |
|---|---|---|---|
| `0d9a76ff4e71` | Transitway Station Design | MULTI_STAGE | MULTI_STAGE |
| `2ea94190b6df` | Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference, Whistler, BC June 8-11, 2008 | MULTI_STAGE | MULTI_STAGE |
| `3048eccbe2de` | Transportation Association of Canada | MULTI_STAGE | MULTI_STAGE |
| `32bced315fcd` | UNION ECONOMIQUE ET MONETAIRE | MULTI_STAGE | MULTI_STAGE |
| `478f0847ff25` | A Process Management Approach to | MULTI_STAGE | MULTI_STAGE |
| `555848f63c69` | Technical Circular T-02/04 | UNSTAGED | UNSTAGED |
| `6c0ffc7cd483` | M E M O / N O T E D E S E R V I C E | MULTI_STAGE | MULTI_STAGE |
| `84a70638ba60` | Date: March 17, 2004 | UNSTAGED | UNSTAGED |
| `a8020b20b358` | M E M O / N O T E D E S E R V I C E | MULTI_STAGE | MULTI_STAGE |
| `d16763daf5d4` | Note Méthodologique : audit de sécurité routière asr | UNSTAGED | UNSTAGED |
| `f5b7f30aa814` | FULL DAYS | UNSTAGED | UNSTAGED |

## §6 Caveats

- Re-labelling, not new coverage (33 committed rows; only 3 Canadian T3).
- Documents vs stage sections: a document earning a stage in N sections counts once in documents, N in stage sections.
- A MULTI_STAGE document can earn several cells through sections.
- Title evidence is dropped from the v3 document decision when sections exist (v2 sidecar preserves it).
- Inherited v2 rule coarseness bounds precision (e.g. a 'Stage 1 items' heading in a Stage 2 report earns FEASIBILITY).
- Cache comparability: `f5b7f30a…` is title-only in the v2 sidecar but has a body in the v3 cache (non-comparable); `37863ef8…` was restored and is comparable.
- The 33-doc corpus has one coverage candidate (`0af7ea58...`); the committed v2 Table B's 1/0/1 includes the inventory-only `a24707c6...` (no v3 body/verdict) and is not comparable; no new document was fetched.
- 32 RESTRICTED / 1 CLEAR; no new documents.
- `comparable` means body availability only.

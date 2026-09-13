---
map: rsa-corpus
label: wayfinder:map
created: 2026-09-11
---

## Destination

The 350-file RSA document collection under `docs/RSA-Documents/` (886 MB, untracked by git) becomes a queryable, ICM-structured corpus: every file inventoried, classified by jurisdiction × stage × type × tier, deduplicated, text-extracted, license-gated — feeding GF-6..10 quote mining (v2 F1), fine-tune packs, and eval ingestion. Concretely: `docs/RSA-Documents/` follows the ordered tree in C4, `corpus-catalog.json` is the single machine index (rebuilt by script, never hand-edited), and C7 delivers an owner-ratifiable GF quote pack.

## Notes

- Skills every session should consult: `icm-architect` (invariants: one folder one job, catalog vs product, human gates); `grilling` + `domain-modeling` for taxonomy terms; `codebase-design` for pipeline seams.
- Standing preferences: deterministic-first; AI proposes candidates, owner disposes (quote pack ratification, move-manifest approval); state reconstructed from repo + corpus files, never chat history.
- Corpus is UNTRACKED and UNIGNORED by git (886 MB) — filesystem moves have zero repo diff; still propose-manifest-before-move (ICM human gate). `corpus-catalog.json` (when created) must be tiny-or-ignored; never commit bulk text.
- Reuse, don't duplicate (one home per fact): `COLLECTION_INDEX.md` (US baseline catalog), `HARVESTING_PLAN.md` (Canadian tier pipeline T0–T4), `FOIA_TEMPLATE.md`, `scripts/`, per-folder logs. New artifacts LINK to these, never copy them.
- Existing tiers (HARVESTING_PLAN.md): T4 = T3 + outcome, T3 = complete (primary), T1 = outputs-only (fallback), T0 = unusable (count only). Corpus taxonomy EXTENDS this, never redefines it.

## Decisions so far

- [C-series created 2026-09-11]: inventory C1 → taxonomy C2 + quarantine C3 → ordering C4; extraction C6; dedupe C5; GF mining C7 → v2 F1; fine-tune C8; eval ingest C9; provenance C10 (parallel gate).
- [F1 dependency (v2 map)](../v2-agentic-platform/tickets/F1-quote-bearing-baselines.md): C7's ratified quote pack OPENS `OWNER_GF_SOURCE_AND_ACCEPTANCE`, unblocking F1 then F4.
- [Wave 1 closed 2026-09-12]: C1 inventory (352 files/928MB/6 drifts via `scripts/build-inventory.py`) + C10 license register (14 batches: 4 CLEAR/9 RESTRICTED/1 BLOCKED). Worker placeholder + ticket-overwrite repaired by orchestrator; lint green.
- [Wave 2 closed 2026-09-12]: C2 schema (v1.0.0, 4 anchors + JSON twin) + C3 quarantine (7 verdicts, 0 DROPs) + C6 extraction (script + matrix + 5-file idempotent pilot). Worker debris (dup id, stray file) repaired; all artifacts verified on disk; lint green.
- [Wave 3 closed 2026-09-12]: C5 dedupe (14 exact groups incl. mislabeled triplicate, 49/78 sample overlap + 29 named gaps, `dedupe-index.json` canonical ids) + C4 manifest-gated (MOVE_MANIFEST PROPOSED unsigned, catalog 352 records byte-identical rebuild, walk test PASS, ZERO moves). Executed by orchestrator; lint green.
- [Wave 4 closed 2026-09-12]: C7 quote pack (20 candidates GF 3/3/3/8/3 from 7 CLEAR files, verify-quotes 20/20, ratification pending owner → v2 F1) + C8 fine-tune (50 pairs all-T3 from 5 CLEAR complete RSAs, train 36/holdout 14 split-proof, T4 count 0 flagged) + C9 ingestion STAGED (7 proposed samples, promotion+judge lines unsigned; judgeless-archive incident remediated, gate untripped). Review CHANGES_REQUIRED → fixed (catalog/index universe unified 327 records, full sha `7d9be7…`, C7 8→7, C9 AC2 deviation recorded); re-validation GO; lint green.

## Not yet specified

- Embedding/vector store for semantic search over the corpus — future map, not this one.
- Paywalled-source expansion beyond ATIP/FOIA templates (Firewall `docs/adr/0007`).
- French-language handling depth for Quebec sources (C1 measures, C6 decides).

## Out of scope

- Committing bulk documents or extracted text to git (repo stays code + traceability).
- Changing eval gate thresholds or GF acceptance rubric (owner's).
- Re-harvesting (scripts/ + HARVESTING_PLAN.md own that; this map organizes what's here).

# Deepening backlog — architecture review 2026-08-25

Full visual report rendered to OS temp (architecture-review-*.html). Persistent
summary below so candidates survive session boundaries. Vocabulary: codebase-design.

| # | Candidate | Strength | Trigger to act |
|---|---|---|---|
| ~~C1~~ ✅ **DONE 2026-08-25** — `src/lib/eval-run.ts` deep module; run-eval.ts 524→203 lines; gate math single-sourced (`computeGateStats`); proven by archive `2026-08-25T19-54-07-248Z` | Strong | — |
| ~~C2~~ ✅ **DONE 2026-08-25** — `scripts/gen-node-topology.ts` codegen; registry DESCRIPTORS single-source; validate-state byte-checks shadows; four drift instances healed | Strong | — |
| ~~C3~~ ✅ **DONE 2026-08-25** — finding-review deepened; route 126→91 lines; table tests cover every lifted branch; engine barrel retargeted | Strong | — |
| ~~C4~~ ⏸ **DEFERRED 2026-08-27** — Provenance threading 16-field args → provider seam in outcomes.ts | Worth exploring | Trigger not met: only one capture site, schema stable; 16-field call at `outcomes.ts:106` tolerated until 2nd site lands — no drift observed |
| ~~C5~~ ⏸ **DEFERRED 2026-08-27** — Two edit kernels (adjudication vs candidate-review) → shared applyFindingEdit kernel (do NOT merge paths — ADR-0006) | Speculative | Trigger not met: wording-gate table tests green, species separation intact per ADR-0006 — kernel stays internal |
| ~~C6~~ ✅ **DONE 2026-08-27** — `src/discovery/harvest.ts` deep module; run route 212→49 lines; DataStore seam injection; 12 new harvest tests via MemoryStore | Strong | — |
| ~~C7~~ ✅ **DONE 2026-08-27** — `src/domain/audit-workspace.ts` deep module; audit page 919→886 lines; WorkspaceApiAdapter injection; 23 new workspace tests | Strong | — |
| ~~C8~~ ✅ **DONE 2026-08-27** — `src/lib/persistence/` split: ProjectStore/ArtifactTrail/IssueLedger + Keys sole owner; facade preserves 8 routes; 536 tests green | Strong | — |

Footnotes: `oddStampFor` dead code (remove opportunistically with C4); engine barrel
re-export of wording validator retarget after C3. All 8 candidates now resolved (C1-3, C6-8 done; C4-5 deferred with trigger). No open deepening.

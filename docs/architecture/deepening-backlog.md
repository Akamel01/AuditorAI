# Deepening backlog — architecture review 2026-08-25

Full visual report rendered to OS temp (architecture-review-*.html). Persistent
summary below so candidates survive session boundaries. Vocabulary: codebase-design.

| # | Candidate | Strength | Trigger to act |
|---|---|---|---|
| ~~C1~~ ✅ **DONE 2026-08-25** — `src/lib/eval-run.ts` deep module; run-eval.ts 524→203 lines; gate math single-sourced (`computeGateStats`); proven by archive `2026-08-25T19-54-07-248Z` | Strong | — |
| ~~C2~~ ✅ **DONE 2026-08-25** — `scripts/gen-node-topology.ts` codegen; registry DESCRIPTORS single-source; validate-state byte-checks shadows; four drift instances healed | Strong | — |
| ~~C3~~ ✅ **DONE 2026-08-25** — finding-review deepened; route 126→91 lines; table tests cover every lifted branch; engine barrel retargeted | Strong | — |
| C4 | Provenance threading 16-field args → provider seam in outcomes.ts | Worth exploring | When a 2nd capture site or schema change lands |
| C5 | Two edit kernels (adjudication vs candidate-review) → shared applyFindingEdit kernel (do NOT merge paths — ADR-0006) | Worth exploring | When edge semantics drift bites |

Footnotes: `oddStampFor` dead code (remove opportunistically); engine barrel
re-export of wording validator retarget after C3.

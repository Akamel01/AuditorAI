# Deepening backlog — architecture review 2026-08-25

Full visual report rendered to OS temp (architecture-review-*.html). Persistent
summary below so candidates survive session boundaries. Vocabulary: codebase-design.

| # | Candidate | Strength | Trigger to act |
|---|---|---|---|
| C1 | `run-eval.ts` god-script → deep `src/lib/eval-run.ts` module (gate math duplicated twice today) | **Strong** | Next eval-harness change — do it then |
| C2 | Node topology in 4 homes (registry/graph-state/contracts/README) → registry as source of truth + codegen + CI byte-check | **Strong** | Before the next node lands (drift already on disk: AG-RULES reads, README table, report impl path) |
| C3 | PATCH-route inline domain work → applyFindingUpdates/applyQuestionMarks modules | **Strong** | With any new review-surface work |
| C4 | Provenance threading 16-field args → provider seam in outcomes.ts | Worth exploring | When a 2nd capture site or schema change lands |
| C5 | Two edit kernels (adjudication vs candidate-review) → shared applyFindingEdit kernel (do NOT merge paths — ADR-0006) | Worth exploring | When edge semantics drift bites |

Footnotes: `oddStampFor` dead code (remove opportunistically); engine barrel
re-export of wording validator retarget after C3.

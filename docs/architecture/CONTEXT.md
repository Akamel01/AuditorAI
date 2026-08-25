# architecture

System-level diagrams and generated data views.

- **learning-architecture.html** — knowledge→pipeline→AI-node→human-gate→eval map.
  KPI numbers are REGENERATED: run `npm run render-learning-html` (never hand-edit slots).
- **overview.md** — static system overview.
- **per-cell-data-table.md** — all 16 ODD cells derived from JSON truth
  (odd.json + sample-corpus.json + latest eval archive); fragile-cells list included.
- Sources of truth live in policies/, state/, src/lib/eval-gates.ts — this folder
  only renders them.

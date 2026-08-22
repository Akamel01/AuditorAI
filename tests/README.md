# Tests

Suites per §30: unit, contract, schema, graph, golden, jurisdiction,
cross-jurisdiction, property, regression, end-to-end.

```text
fixtures/       synthetic realistic projects (urban arterial, rural highway,
                signalized intersection, roundabout, pedestrian/cycling)
golden/         expected outputs incl. known findings and known non-findings
jurisdiction/   per-jurisdiction behavior tests
integration/    cross-module flows
property/       invariants that must hold for all inputs
```

Golden fixtures define: Project, Jurisdiction, Stage, Inputs, Expected Rules,
Expected Findings, Expected Non-Findings, Expected Missing Information.
No fake standards — fixture expectations trace to policy packs and evidence records.

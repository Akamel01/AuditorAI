# Audit Graph

The bounded-context pipeline the **product** executes to run an actual audit (§19):

```text
Project → Audit → Jurisdiction → Framework → Stage → Input Normalization
  → Evidence Selection → Audit Context → Audit Questions → Assessment Nodes
  → Candidate Findings → Evidence Validation → Safety/Risk Reasoning
  → Finding Adjudication → Recommendation → Report → Human Review → Final Audit
```

Every major node has a contract in `contracts/node-contracts/`. Deterministic nodes
(selection, normalization, rule checks, evidence validation) must be reproducible;
AI nodes may only emit bounded artifact types (`CandidateFinding`, `DraftRationale`,
`EvidenceSummary`, `MissingInformationQuestion`, `PotentialRecommendation`) and never
final determinations.

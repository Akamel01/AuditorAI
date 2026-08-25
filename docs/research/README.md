# Research Artifacts

Cited findings from primary/authoritative sources. One document per jurisdiction plus
cross-cutting syntheses:

```text
international-rsa-research.md   ← compiled into state/evidence-registry.json
uk-rsa-research.md             ←
usa-rsa-research.md            ←
canada-rsa-research.md         ←
uae-rsa-research.md            ←

Only the five jurisdiction research files are registry sources (see
scripts/compile-evidence.mjs). Engineering notes that are NOT registry sources
live in docs/dev-notes/ (see its CONTEXT.md).
inputs-and-outputs.md
standards-conflict-analysis.md
```

Rules:

1. Primary/authoritative sources first (standards bodies, road authorities). Blogs,
   consultancies, Wikipedia are corroboration at best, never the basis of normative claims.
2. Every significant claim carries a citation: title, publisher, revision/date, URL,
   retrieval date.
3. Each document carries YAML front matter listing structured evidence records that the
   Evidence Manager compiles into `state/evidence-registry.json`. Researchers write only
   their own document; they never mutate shared registries directly.

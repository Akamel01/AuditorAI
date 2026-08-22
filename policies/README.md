# Policy Packs

Versioned, machine-readable jurisdiction knowledge. Rules never live only in prompts.

```text
policies/
  international/   qualified international baseline (see research; do not invent a standard)
  uk/              GG 119 / DMRB-derived
  usa/             FHWA-derived
  canada/          TAC / CRSAG-derived
  uae/             Abu Dhabi RSAM-derived (+ other Emirates where evidenced)
```

Each pack captures: stages, required/recommended inputs, expected outputs, audit
questions, road-user categories, issue categories, deterministic rules, exceptions,
source references, version. Every normative item cites an evidence record id from
`state/evidence-registry.json`.

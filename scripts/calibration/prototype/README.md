# Prototype M1+M2

CLI: `npx tsx scripts/calibration/prototype/run.ts [--dry-run] [--doc all]`

Normalization: normalize.ts (verbatim-v1). Page attribution via buildDocument.
Heading rule: numbered-or-allcaps-v2 (audit-only, never gates).
Model pair: Nemotron extractor + Beam verifier (family-disjoint).
No retries, no repair, no fuzzy match. Discard failures are audited.
Dry-run loads docs, builds prompts, writes `-dryrun` summary; no keys/calls/records.

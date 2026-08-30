---
id: R9
title: Discovery doctor JSON contract for CI
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Agent Brief

**Category:** enhancement
**Summary:** Make `scripts/discovery-doctor.ts --live` print a stable JSON shape under a `--json` flag.

**Current behavior:** The doctor prints human-readable logs that are re-quoted in evidence JSON. CI consumes the transcript text by hand without a stable schema, causing inconsistent evidence fields.

**Desired behavior:** The doctor prints a single JSON object on stdout under `--json`, with `providers` array (each having `{ id, enabled, hostsOk, sampleHits }`), and `totals`. Exit codes remain unchanged.

**Key interfaces:**
- `scripts/discovery-doctor.ts`: existing `discover()` call and print paths; add a single `--json` branch.

**Acceptance criteria:**
- [ ] Running the doctor with both `--live --json` prints valid JSON to stdout and nothing else, exit 0 if reachable, exit code unchanged.
- [ ] Validator/evidence workflows can read this contract deterministically.

**Out of scope:**
- Replacing the human-readable output mode.


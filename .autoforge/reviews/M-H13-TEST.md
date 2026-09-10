# Review: M-H13-TEST (temp-dir leniency test)

Verdict: **APPROVED_WITH_NOTES**

Scope read (read-only, no shell):
- `tests/domain/wayfinder-tickets.test.ts` (M-H13-TEST block, lines 164-216)
- `src/wayfinder/tickets.ts` (seam: `KNOWN_STATUS` / `parseStatus` / `loadTicketsFromTree` / `indexWayfinderTickets`)
- `.autoforge/execution/M-H13-TEST.md` (worker evidence, report only)

H13 acceptance: temp-dir 1-bad + 1-good → 1 served + 1 skipped, no cwd mutation, MemoryStore-free.

## Findings

### PASS — bad ticket uses invalid status
`in_progress` is not in `KNOWN_STATUS`, so `parseStatus` throws and the loader records skipped (by design).
- `tests/domain/wayfinder-tickets.test.ts:189-195`:
  `      // Bad ticket with invalid status`
  `      const badPath = path.join(ticketsDir, "R4.md");`
  `      fs.writeFileSync(`
  `        badPath,`
  `        `---\nid: R4\ntitle: Bad status\nstatus: in_progress\n---\nbody\n`,`
  `        "utf8",`
  `      );`
- `src/wayfinder/tickets.ts:27-34`:
  `const KNOWN_STATUS: ReadonlySet<string> = new Set([`
  `  "open",`
  `  "claimed",`
  `  "blocked",`
  `  "closed",`
  `  "resolved",`
  `  "out-of-scope",`
  `]);`
- `src/wayfinder/tickets.ts:85-91`:
  `function parseStatus(raw: string | undefined, file: string): TicketStatus {`
  `  const v = parseScalar(raw);`
  `  if (!v || !KNOWN_STATUS.has(v)) {`
  `    throw new Error(`${file}: status must be one of ${[...KNOWN_STATUS].join("|")} (got ${JSON.stringify(raw)})`);`
  `  }`
  `  return v as TicketStatus;`
  `}`

### PASS — asserts tickets / skipped / counts + skipped file identity
All three counts plus the skipped-file relative path are asserted.
- `tests/domain/wayfinder-tickets.test.ts:198`:
  `      const index = indexWayfinderTickets(tmpRoot);`
- `tests/domain/wayfinder-tickets.test.ts:201-206`:
  `      expect(index.tickets.length).toBe(1);`
  `      expect(index.skipped.length).toBe(1);`
  `      expect(index.counts.total).toBe(1);`
  `      // The skipped file should be the relative path used by the loader`
  `      const expectedRel = `workflow/wayfinder/maps/${map}/tickets/${path.basename(badPath)}`.replaceAll("\\", "/");`
  `      expect(index.skipped[0].file).toBe(expectedRel);`

### PASS — temp-dir cleanup (mkdtemp + rm)
Isolated `mkdtempSync` under `os.tmpdir()` with `finally` + `rmSync(recursive, force)`.
- `tests/domain/wayfinder-tickets.test.ts:174`:
  `    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aud-wf-test-"));`
- `tests/domain/wayfinder-tickets.test.ts:207-214`:
  `    } finally {`
  `      // Cleanup temp dir`
  `      try {`
  `        fs.rmSync(tmpRoot, { recursive: true, force: true });`
  `      } catch {`
  `        // ignore`
  `      }`
  `    }`

### PASS — no cwd mutation
Test passes explicit `tmpRoot` to the `root` seam; no `process.chdir` / cwd write in the block. Seam defaults to `process.cwd()` only when arg omitted.
- `src/wayfinder/tickets.ts:209-211`:
  `export function indexWayfinderTickets(root = process.cwd()): TicketIndex {`
  `  const { tickets, skipped } = loadTicketsFromTree(root);`
  `  return buildTicketIndex(tickets, skipped);`
  `}`
- `src/wayfinder/tickets.ts:146`:
  `export function loadTicketsFromTree(root = process.cwd()): { tickets: WayfinderTicket[]; skipped: SkippedTicket[] } {`
- No `chdir`/`cwd` mutation appears in `tests/domain/wayfinder-tickets.test.ts:167-216` (name itself states `without mutating cwd`; body only builds `tmpRoot`/`mapsRoot`/`ticketsDir` and calls `indexWayfinderTickets(tmpRoot)`).

### PASS — MemoryStore-free
Block uses only real `node:fs` / `node:path` / `node:os` temp-dir tree; no MemoryStore import or reference in lines 167-216.
- `tests/domain/wayfinder-tickets.test.ts:170-173`:
  `    // Lazy imports for test isolation`
  `    const fs = require("node:fs");`
  `    const path = require("node:path");`
  `    const os = require("node:os");`

### NOTE (non-blocking) — file conventions: `require` vs ESM `import`
Existing file and `src/wayfinder/tickets.ts:5-6` use ESM `import`; the new block uses lazy `require("node:fs")` etc. Functional (worker-quoted targeted pass `9 tests | 8 skipped`), but inconsistent with repo ESM style. Future cleanup: top-level `import fs from "node:fs"` / `import path from "node:path"` / `import os from "node:os"`. Not a correctness failure; no change required for H13.

### NOTE (non-blocking) — clean-tree `skipped: []` assertion absent
`describe("indexWayfinderTickets (repo tree)", ...)` at `tests/domain/wayfinder-tickets.test.ts:114-143` asserts `schema_version`, `maps`, `counts.total`, `ready_without_owner`, and spot-checks `R3`/`F1`/`T2`/`F4`, but asserts no `index.skipped`. Adding `expect(index.skipped).toEqual([])` would guard clean-tree determinism, but it was not part of stated H13 temp-dir acceptance (1 served + 1 skipped, no cwd mutation, MemoryStore-free), so omission does not fail H13. Suggest as follow-up, not a required change.

Worker evidence consistency: `.autoforge/execution/M-H13-TEST.md:10-12` quotes the `R4.md: status must be one of open|claimed|blocked|closed|resolved|out-of-scope (got "in_progress")` warn + `9 tests | 8 skipped`, matching the current-file seam and test intent. No re-execution performed per read-only constraint (§13-14); targeted-pass claim taken as worker-reported, full-suite green taken as orchestrator-verified.

## Required changes
None — all H13 acceptance checks pass on current file content.

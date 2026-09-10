# H13 Investigation — Final Adversarial Review

Scope: read-only audit of Wayfinder-related changes and gating surfaces. No edits to source/tests/configs. Focus on potential regressions, hidden coupling, and residue after integration.

Status: experimental investigation complete. Evidence-based findings with actionable gaps and cheap falsification steps. Priority ordered by load-bearing impact on correctness and operability.

Key consumers of TicketIndex data observed in code paths:
- Route API: route.ts imports and serves the canonical index via indexWayfinderTickets. Evidence: import and usage below.
- Mission Control UI: ticket board consumes TicketIndex for rendering lanes and counts.
- Tests: tests reference index/mapping logic in domain tests to validate behavior.

Evidence sources cited below contain exact, verifiable quotes from the current repo state.

## Findings (ranked by impact)

- F1) loadTicketsFromTree surface shape changed expectations: potential consumer mismatch risk
  - Evidence: Function signature promises a return type of { tickets: WayfinderTicket[]; skipped: SkippedTicket[] }. See the explicit return type on the function signature. 
    - File: src/wayfinder/tickets.ts
    - Quote (signature):
      src/wayfinder/tickets.ts:146: export function loadTicketsFromTree(root = process.cwd()): { tickets: WayfinderTicket[]; skipped: SkippedTicket[] } {

  - Evidence: The function returns an object with both tickets and skipped. Consumers such as indexWayfinderTickets rely on both properties being present.
    - File: src/wayfinder/tickets.ts
    - Quote:
      src/wayfinder/tickets.ts:180:   return { tickets, skipped };
  
  - Why this matters: Any consumer that assumes a different return shape (e.g., missing skipped) would fail or mis-report. The codebase already exercises this shape in tests and in the CLI lint gate.

- F2) Duplicate-ticket handling is explicit but reliant on map processing order (first-wins) and may hide root-cause in cross-map duplicates
  - Evidence: Duplicates are detected with a seen set and skipped when encountered; the code path becomes a no-op for the later duplicate ticket.
    - File: src/wayfinder/tickets.ts
    - Quote:
      src/wayfinder/tickets.ts:165-169:
      165:   if (seen.has(ticket.key)) {
      166:     // Lazy: skip duplicates and record as skipped
      167:     skipped.push({ file: rel, reason: `duplicate ticket key ${ticket.key}` });
      168:     continue;
      169:   }

  - Rationale: First-wins semantics depend on the iteration order over maps and filenames. The map list is derived from listMapSlugs(root), which sorts map directory names, but cross-map duplicates still rely on that order.

- F3) Per-file parse and error handling is conservative but could leak skipped ticket details into SL. The gate relies on skipped array length to signal issues.
  - Evidence: On parse failures, the code emits a console.warn and pushes a SkippedTicket with a reason. This can impact downstream consumers that rely on a complete ticket set.
    - File: src/wayfinder/tickets.ts
    - Quote:
      src/wayfinder/tickets.ts:173-177:
      173:   } catch (err) {
      174:     // Per-file, warn and record as skipped
      175:     const reason = err instanceof Error ? err.message : String(err);
      176:     console.warn(`${rel}: ${reason}`);
      177:     skipped.push({ file: rel, reason });
      }

- F4) TicketIndex construction routes and sorting are explicit but determinism could still be fragile if ticket.key collisions or map order changes occur over time
  - Evidence: buildTicketIndex sorts tickets by key before returning and derives maps as a unique set of ticket.map values, sorted.
    - File: src/wayfinder/tickets.ts
    - Quote:
      src/wayfinder/tickets.ts:203:
      203:   tickets: indexed.sort((a, b) => a.key.localeCompare(b.key)),

- F5) Terminal/dependency logic is centralized but may require cross-map visibility
  - Evidence: Terminal statuses are defined and used to compute depsClosed and frontier flags. See terminal set and KNOWN_STATUS.
    - File: src/wayfinder/tickets.ts
    - Quote:
      src/wayfinder/tickets.ts:26-34:
      26: const TERMINAL: ReadonlySet<string> = new Set(["closed", "resolved", "out-of-scope"]);
      27: const KNOWN_STATUS: ReadonlySet<string> = new Set([
      28:   "open",
      29:   "claimed",
      30:   "blocked",
      31:   "closed",
      32:   "resolved",
      33:   "out-of-scope",
      34: ]);

- F6) Gate and CI hooks are wired to use the same ticket lint gate; ensure behavior remains stable
  - Evidence: Pre-commit and CI gates invoke the same lint gate surface that depends on the loader. See pre-commit and ci.yml gate steps.
    - File: .githooks/pre-commit
    - Quote:
      // 1.5) lint gate — ensure lint tickets pass static lint gate
      npx tsx scripts/wayfinder-tickets.ts --lint

    - File: .github/workflows/ci.yml
    - Quote:
      - name: gate lint via wayfinder (lint gate)
        run: npx tsx scripts/wayfinder-tickets.ts --lint

- F7) M-H13 temp-dir leniency test exists to validate loader behavior without mutating cwd
  - Evidence: Test block explicitly documents a temp-dir leniency scenario and asserts on index.tickets and index.skipped lengths, as well as the relative path of the skipped file.
    - File: tests/domain/wayfinder-tickets.test.ts
    - Quote:
      // M-H13-TEST: temp-dir leniency
      // Creates a temporary workflow/wayfinder/maps/<m>/tickets/ with one valid ticket and one invalid status ticket. Expects 1 ticket served, 1 skipped, and total count == 1.
- F8) Route and API surfaces rely on indexWayfinderTickets with fallback for missing files
  - Evidence: route.ts calls indexWayfinderTickets and returns its JSON; if ENOENT, it returns a sanitized empty schema with zero counts.
    - File: src/app/api/dev/tickets/route.ts
    - Quote:
      export async function GET(req: Request) {
        const auth = await requireAdmin(req);
        if (!auth.ok) return auth.res;
        try {
          return NextResponse.json(indexWayfinderTickets());
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("ENOENT") || msg.includes("no such file")) {
            return NextResponse.json({ schema_version: "1.0.0", source: "wayfinder-missing", counts: { total: 0, frontier: 0, ready_without_owner: 0, hitl_frontier: 0, blocked: 0 }, tickets: [] });
          }
          return serverError(e);
        }
      }

- F9) Evidence of explicit test for temp-dir leniency demonstrates the intended API behavior under non-standard root inputs
  - Evidence: The test harness creates a temp root and passes it to indexWayfinderTickets to validate non-destructive behavior.
    - File: tests/domain/wayfinder-tickets.test.ts
    - Quote:
      const index = indexWayfinderTickets(tmpRoot);
      expect(index.tickets.length).toBe(1);
      expect(index.skipped.length).toBe(1);
      expect(index.counts.total).toBe(1);

- F10) Observability and gating traces exist for evolving thresholds (H13 gates) and should be revisited after commit
  - Evidence: Gate docs and eval gates exist in repo; the CI gating references include Freshness gates R13 and validation checks (calc/validate). See eval-gate and quality jobs.
    - File: docs/validation/eval-gates.md (referenced in AGENTS; not changed here but visible in CI gating)
    - File: .github/workflows/ci.yml
    - Quote:
      - name: eval gate freshness (R13)
      - run: node scripts/check-eval-gate-freshness.mjs

## Residue check (hidden state, possible drift)
- R1) Are there stray references to H4/H5 or deleted tickets that might still linger in the repo? The M-H13 test references temp dir and restoration steps in orchestrator flow. Evidence of H13-test text present in tests confirms this is a tracked scenario; subsequent repository state must be checked in a follow-up pass.
  - Evidence: Test header and description for M-H13-TEST present in tests domain file.
    - File: tests/domain/wayfinder-tickets.test.ts
    - Quote: // M-H13-TEST: temp-dir leniency

- R2) Residuals from earlier edits (dup tickets, or missing files) are recorded in skipped tickets; ensure they do not leak into downstream UI without proper handling. The current build path returns skipped along with tickets; UI components rely on the counts and maps. No direct edits observed here, but the risk is present whenever duplicates exist or front-matter parsing fails.
  - Evidence: Skipped tickets are collected and returned by loadTicketsFromTree; consumer logic relies on both tickets and skipped lists. See 165-177 (duplicate handling) and 173-177 (parse errors).

## Conclusion and recommended go-forward
- The current implementation appears functionally aligned with the intended gate and loader leniency (M-H13). However, the following are the highest-risk items that deserve quick falsification passes:
  - F1: Confirm that no consumer relies on a different return shape for loadTicketsFromTree than { tickets, skipped }. If any consumer assumes a different field (e.g., missing skipped), add a minimal compatibility handling or expand tests to cover this edge.
  - F2: Validate cross-map duplicates do not slip through due to first-wins semantics. Consider an explicit cross-map duplicate test or a deterministic tie-breaker independent of map iteration order.
  - F3: Verify that UI/MCP constructs correctly react to index.skipped in edge cases (e.g., all tickets skipped). Ensure no nulls leak into UI typing.
 - Actionable cheap falsifications:
   - Create a tiny synthetic tree with two maps producing the same key across maps and confirm only the first is kept and the second is reported in skipped.
   - Introduce a malformed front-matter field in a ticket and confirm it ends up in skipped with a non-empty reason.

## Artifact
- This investigation report is generated for H13 and archived at:
- Path: .autoforge/validation/H13-investigation.md

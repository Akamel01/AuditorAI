H13 ticket-index leniency discovery report

Open tickets and blockers (status/frontier):
- H13: open blocked_by=[H12] frontier (source: workflow/wayfinder/maps/ai-harvest-stream/tickets/H13-ticket-index-leniency.md) 6: status: open; 8: blocked_by: [H12]
- H1: open blocked_by=[] frontier (source: workflow/wayfinder/maps/ai-harvest-stream/tickets/H1-ai-provider-gpt5-nano.md) 6: status: open; 8: blocked_by: []
- H2: open blocked_by=[H1] frontier (source: workflow/wayfinder/maps/ai-harvest-stream/tickets/H2-structured-workflow.md) 6: status: open; 8: blocked_by: [H1]
- H3: open blocked_by=[H2] frontier (source: workflow/wayfinder/maps/ai-harvest-stream/tickets/H3-control-api.md) 6: status: open; 8: blocked_by: [H2]
- H4: open blocked_by=[H3] frontier (source: workflow/wayfinder/maps/ai-harvest-stream/tickets/H4-ui-monitoring.md) 6: status: open; 8: blocked_by: [H3]
- H5: open blocked_by=[H2] frontier (source: workflow/wayfinder/maps/ai-harvest-stream/tickets/H5-verification-loop.md) 6: status: open; 8: blocked_by: [H2]
- H6: open blocked_by=[H1] frontier (source: workflow/wayfinder/maps/ai-harvest-stream/tickets/H6-fixtures-samples.md) 6: status: open; 8: blocked_by: [H1]

Evidence of H13 leniency approach (summary and gate integration):
- H13 front-matter notes the lenient-load design and the lint gate requirement (skip-invalid-front-matter; log reason) and cites the target interfaces (src/wayfinder/tickets.ts, scripts/wayfinder-tickets.ts, pre-commit, ci.yml): see H13 doc lines 25-29 and 34-35 for acceptance mechanics and gate surface. See: workflow/wayfinder/maps/ai-harvest-stream/tickets/H13-ticket-index-leniency.md:25-29, 34-35.
  - citations: H13:25-29; H13:34-35

Throw sites identified in H13 (exact locations and conditions where errors are raised):
- missing front-matter block (parseTicketFrontMatter): H13 mentions this front-matter error; evidence in code: parseTicketFrontMatter throws when missing front-matter (parseTicketFrontMatter: 46).  See: H13 doc lines 46; code: src/wayfinder/tickets.ts:44-58.
- missing id/title: ticketFromFields requires id and title and will throw if missing (lines 96-100). See: H13 doc line 98-100; code: src/wayfinder/tickets.ts:96-100.
- invalid status: parseStatus throws if status is not in known set (lines 83-87). See: H13 doc line 83-87; code: src/wayfinder/tickets.ts:83-89.
- duplicate key: duplicate ticket key error (lines 161-164). See: H13 doc line 161-164; code: src/wayfinder/tickets.ts:161-165.

Lint gate and gating integration (lint gate surface):
- Lint gate and CI gating surface are described in H13 acceptance: lint gate (CI or pre-commit) that fails-fast on invalid front-matter; see H13 doc lines 28-29. Evidence of gates in repo: .githooks/pre-commit (lint/typecheck/vault checks) and .github/workflows/ci.yml quality job (lint/typecheck/test/build). See: .githooks/pre-commit:7-13; ci.yml:65-77.

Open vs closed status in this slice (evidence snapshot):
- H12 is closed; the chain note shows the splitter causing H13 to be necessary. See H12-ci-green.md:6-9 (status: closed; blocked_by: []), and 42-58 describing the chain context. See: workflow/wayfinder/maps/ai-harvest-stream/tickets/H12-ci-green.md:6-9; 42-58.

Done-in-code verdicts for H1-H6 (evidence that changes exist in code):
- H1: AI search provider wired in code (src/discovery/providers/ai-search.ts) with gating via DISCOVERY_AI_ENABLED and OPENCODE_API_KEY; provider is registered when enabled. See: src/discovery/providers/ai-search.ts:30-39, 31-33, 40-46, 123-130.
- H2: HarvestStream state machine implemented (src/discovery/harvest-stream.ts) with IDLE→RUNNING, etc., and tick loop. See: src/discovery/harvest-stream.ts:1-3, 11-15, 136-138, 181-186, 235-259.
- H3: API routes for start/pause/resume/stop exist (src/app/api/dev/harvest-stream/route.ts). See: route.ts:29-36, 7-12.
- H4: Monitoring UI pieces exist in UI sources (src/app/dev/mission-control/_components/ai-harvest-control.tsx). See: ai-harvest-control.tsx: Start button with continuous label (lines 144-147), continuous badge (lines 186-199).
- H5: Verification gates implemented in HarvestStream.verifyStream and tickStream gating; see verifyStream (src/discovery/harvest-stream.ts:113-128) and tickStream (lines 131-159, 235-259).
- H6: Fixtures/tests for ai-harvest exist (tests/domain/ai-harvest.test.ts) showing 2-hit scenario and verification flow. See: tests/domain/ai-harvest.test.ts:7-15, 37-45, 98-111.

Notes
- This report reflects evidence as of the current repository snapshot; live streams were not re-run per H10 guidance. See H10-final.md verdict (CLOSE) for reference: .autoforge/validation/H10-final.md:60.

Artifacts referenced
- tracker: .autoforge/discovery/tracker-index.md
- report: .autoforge/discovery/report.md

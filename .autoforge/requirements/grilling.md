# H13 Leniency Grilling — Findings, Questions, Recommendations

- Source inputs reviewed: discovery report, tracker index, H13 ticket, and code paths:
  - .autoforge/discovery/report.md
  - .autoforge/discovery/tracker-index.md
  - workflow/wayfinder/maps/ai-harvest-stream/tickets/H13-ticket-index-leniency.md
  - src/wayfinder/tickets.ts
  - src/wayfinder/ticket-types.ts

## Executive summary (current stance)
- H13 envisions a lenient load path for tickets: skip invalid ticket files, log the reason, and still serve valid tickets. Gates (lint/pre-commit/CI) are intended to catch malformed front-matter early. This is described in H13 and modeled in the tickets pipeline and gate surface.
- Evidence shows the H13 document explicitly calls out lenient-load as the design and wires gate surfaces (lint gate/pre-commit/CI). See H13 doc: target interfaces and acceptance mechanics. See: H13-ticket-index-leniency.md: Agent Interfaces (src/wayfinder/tickets.ts, scripts/wayfinder-tickets.ts) and gate surface (.githooks/pre-commit, ci.yml) references. See lines: H13 doc 25-29 and 34-35 for acceptance mechanics and gate surface.
- Implementation presence: the repo contains concrete implementations for H1-H6 (AI-search provider, HarvestStream, API routes, monitoring UI, verification gates, fixtures/tests) as evidenced in the H13 doc’s “Done-in-code verdicts.” See lines 29-34 in H13 doc. See also the actual code references in src/wayfinder/tickets.ts (parseTicketFrontMatter, parseStatus, duplicate-key guard).
- There is ongoing tension about the status of H1’s ai-search path versus a newer H7 path (agent-reach). MAP-level decisions show H7 replaced ai-search in practice; H1’s ai-search.ts exists but its life status depends on integration with agent-reach. See discovery notes: “H1 ai-search.ts exists BUT MAP decisions say H7 replaced ai-search with agent-reach-search.ts” in the discovery narrative. See .autoforge/discovery/report.md lines describing H1 vs H7 tension and the live-vs-superseded question.
- Risks and gaps identified by the evidence below: missing front-matter, missing id/title, invalid status, and duplicate keys are explicitly called out as throw sites; the gate surface is described; the H12/H13 chain context is documented. See: report.md sections on throw-sites (missing front-matter, missing id/title, invalid status, duplicate key) lines 17-21 and 29-35.

## Assumptions driving this grilling
- A1. H13 leniency plan will be enacted via a lenient-load pathway with a stricter lint gate that catches invalid front-matter at commit-time or CI-time, without affecting the in-tree valid tickets.
- A2. The index should surface a skipped-count (and a skipped field) to reflect invalid tickets while still serving valid ones. See H13 acceptance criteria lines 31-34.
- A3. H1-H6 are implemented in code and remain a valid baseline; however, the MAP decision around H7 replacing ai-search raises question whether H1 is live or superseded. See H13 doc verdict and MAP tension notes in report.md.
- A4. The current parse/validate boundaries are correct: parseTicketFrontMatter, parseStatus are strict at read path; leniency should move to lint-gate per H13 acceptance. See H13 doc lines 34-35 and code paths in tickets.ts (parseTicketFrontMatter: missing front-matter, parseStatus: invalid status).
- A5. The injected changes will not require code edits (per this task’s scope). The focus is on evidence, gaps, and risk gating only.

## Findings (evidence-backed)
- F1. Leniency design documented and gate surface identified
  - H13 doc states: lenient-load design and lint gate required; gate surface references include front-matter parsing and field validations, and mentions target interfaces in code and scripts. See H13-ticket-index-leniency.md:25-29 and 34-35. Evidence: H13 doc lines 25-29; 34-35.
  - Evidence: H13 acceptance criteria describe invalid-ticket handling, skipped tickets, and pre-commit/CI gating. See H13 doc lines 31-34.
  - Repo evidence of gate surfaces: .githooks/pre-commit and ci.yml mention lint/typecheck; mention in H13 doc. See report.md lines 23-24 and 25-28 for gate references.
- F2. Throw sites for invalid tickets (read-path validation) are explicit in code and cited by H13
  - Missing front-matter: parseTicketFrontMatter throws when there is no front-matter block. See: src/wayfinder/tickets.ts:46; H13 doc line 46.
  - Missing id/title: ticketFromFields enforces id/title presence; throws if missing. See: src/wayfinder/tickets.ts:98-99; H13 doc line 98-100.
  - Invalid status: parseStatus throws for unknown statuses; see code: 83-89; H13 doc line 83-87.
  - Duplicate key: loadTicketsFromTree enforces unique keys; see lines 161-164; H13 doc line 161-164.
- F3. H1-H6 closure legitimacy (superseded vs live)
  - H1-H6 are present in code per H13’s “Done-in-code verdicts” (H13 doc lines 29-34). See the report data: H1 ai-search wiring, H2 HarvestStream, H3 API routes, H4 Monitoring UI, H5 verification gates, H6 fixtures/tests. This supports that H1-H6 exist but does not automatically prove they are all active in production gating.
  - MAP-tension: H7 replaced ai-search with agent-reach-search; H1’s ai-search.ts exists but may be superseded in practice. See discover notes in report.md lines 29-31 and the tension description in the same file around H1 vs H7.
- F4. Gate surface and acceptance hooks
  - Gate surfaces include pre-commit and CI workflows; H13 mentions lint gate that fails-fast on invalid front-matter. See report.md:23-24; H13 doc lines 28-36 describe interfaces and lines 28-29 show acceptance mechanics.
- F5. Open risk: the system currently relies on strict ticket front-matter parsing at read path, with leniency in the load path
  - This separation is explicit in H13 acceptance: strictness stays in read path; leniency is moved to lint gate. See H13 doc lines 34-35.
- F6. Operational risk: the silent-skip behavior must be observable
  - The acceptance requires exact evidence that invalid tickets are skipped with console.warn; the index must report a skipped count. See H13 doc lines 31-34.
- F7. Cross-reference evidence between reports and code
  - Ticket structure and index build rely on parseFrontMatter and parseStatus; loadTicketsFromTree enumerates maps/tickets; duplicate handling is explicit. See src/wayfinder/tickets.ts lines 44-57, 91-100, 119-137, 144-167.
- F8. H12-H13 chain context and gating alignment
  - H12’s closed state and the chain context justify the need for leniency gating; the tracker-index includes H12 references and H13 references the chain context. See tracker-index.md lines 3-9 and report.md line 26.

## Questions that must be answered (grill prompts)
- Q1: Is H1’s ai-search path actually live, or is H7’s agent-reach path now the canonical discovery provider? If H1 is still present, should it be removed or kept as a legacy path with a deprecation gate?
- Q2: Do we have formal cross-evidence that H7/H8/H9/H11 fully supersede H1-H6, or are there legitimate gaps where H1-H6 still deliver functionality needed by current workloads?
- Q3: Are the acceptance gates wired into pre-commit/CI so that a single malformed ticket cannot cause a 500 in Mission Control? If not, what is the gap and who owns it?
- Q4: Is the skipped-count shape (skipped field) implemented and surfaceable in all views? Do we log the skip reason consistently for auditing?
- Q5: Should we add unit tests for parseTicketFrontMatter and parseStatus with edge-cases (e.g., extra whitespace, unusual field ordering) to ensure gate resilience?
- Q6: If a duplicate key is detected, should the system skip that ticket, or fail-fast? What is the policy for resolving duplicates in a multi-map scenario?
- Q7: Given the H12-H13 chain, what is the acceptable level of leniency before it starts letting invalid tickets through to the frontend? Where is the threshold documented?
- Q8: If H1-H6 are superseded, what is the migration plan for teams currently consuming those APIs or UI components?
- Q9: How do we surface evidence of skipped tickets to end users (via API and UI) without leaking internal gate noise?

## Recommendations (concrete next steps)
- R1. Decide canonical status of H1: ai-search vs agent-reach. If H7 is the canonical path, update the H13-grill findings to mark H1 as superseded with explicit cross-evidence and remove active references to H1 in future gating documents.
- R2. Cement the leniency gate: ensure pre-commit and CI fail-fast on invalid front-matter. Validate that invalid tickets never reach Mission Control; ensure console.warn is emitted and skipped counts are surfaced.
- R3. Strengthen test coverage for the loadTicketsFromTree path: add tests for 1 bad + 1 good ticket in a temp-dir that assert 1 served and 1 skipped; verify the skipped count exposed in index.
- R4. Explicitly codify the skipped/valid counts in the index schema doc, so downstream UIs can surface them reliably (and for audits).
- R5. Add a small deprecation note for H1 if superseded, including a migration plan for consumers.
- R6. Create a cross-reference mapping doc that explicitly lists which H1-H6 items map to H7/H8/H9/H11 and where the live code lives, to avoid ambiguity in future escalations.
- R7. If a duplicate key occurs, decide whether to skip or fail and implement a consistent policy in both code and tests; ensure the error location is surfaced in logs.
- R8. Document the edge cases that trigger 500s and how to recover from them (e.g., H12 chain breakage, malformed front matter).

## Escalations (when to raise)
- E1. If there is still ambiguity about H1 vs H7 live-ness after the above questions, escalate to the discovery/architecture owner with the exact conflicting evidence (cite H13 doc and MAP decisions).
- E2. If the pre-commit/CI gating does not cover a specific code path identified in the H13 references, escalate to CI-eng to broaden coverage.

## Artifacts
- Generated grill: .autoforge/requirements/grilling.md
- Evidence references used for this grilling:
  - H13 leniency overview in workflow/wayfinder/maps/ai-harvest-stream/tickets/H13-ticket-index-leniency.md (agent interfaces and gate surface). See: H13-ticket-index-leniency.md lines 25-29, 34-35; 31-34 for acceptance criteria.
  - H13 evidence of code changes present in repo: lines 29-34 of H13 doc describe done-in-code verdicts.
  - H13 acceptance criteria details and the exact wording of the accept gates (invalid ticket skipping, non-zero exit on lint step). See H13 doc lines 31-34.
  - H1-H6 live-ness tension vs H7 replacement described in the discovery narrative in H13 report. See .autoforge/discovery/report.md lines 29-31 and 20-21 for context.
  - Throw sites and strictness boundaries (missing front-matter, missing id/title, invalid status, duplicate key) in code and their mapping in H13. See src/wayfinder/tickets.ts lines 46, 98-100, 83-89, 161-165; H13 doc lines 46; 98-100; 83-87; 161-164.

End of grilling artifact. Concise summary + artifact path:
- Summary with evidence-backed risks and decisions reflected in .autoforge/requirements/grilling.md
- Path: .autoforge/requirements/grilling.md

(End of document)

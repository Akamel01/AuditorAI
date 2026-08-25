# 05 — UI wiring: adjudication capture → CandidateOutcome POST

Type: task · Status: open · Blocked by: 01

## Question

Wire the adjudication surface (src/app/** audits page) to emit CandidateOutcome rows:
accept / accept_with_edits / reject actions capture the whitelisted edited_fields +
optional note; consent checkbox records consent_version; pseudonymous auditor id from
session config. Additive API endpoint only. BEFORE WORK: check git status for live
parallel-session WIP in src/app/** and stash-coordinate (AGENTS.md lanes rule).

## Answer


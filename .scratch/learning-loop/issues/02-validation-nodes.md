# 02 — AG-HALLUCINATION-CHECK + AG-EVIDENCE-USE-AUDIT nodes

Type: task · Status: open · Blocked by: —

## Question

Implement ADR-0010 as two registered pipeline nodes after AG-AI-CANDIDATES:
evidence_id existence + normalized quote match + vocab membership; citation-presence on
normative claims + producer enforcement. Flag-and-show semantics (validation.status=
auto-flagged + reasons[] on the candidate, never dropped). Runs identically with AI OFF
on baseline findings. Register in registry.ts; stamp per-run hallucination rate into
run artifacts. Tests incl. AI-off path and each failure mode.

## Answer


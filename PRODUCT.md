# PRODUCT.md — AuditorAI

## What this is

An AI-assisted, evidence-grounded **Road Safety Audit** web platform for professional
auditors. It runs the deterministic mechanics of an RSA — stage inputs, process rules,
stage questions — across International, UK, US, Canada and UAE practice, always presenting
each framework's own native vocabulary.

## Who it serves

Qualified road-safety auditors and the authorities that commission audits. Conservative,
rigorous, risk-aware professionals. They distrust flash; trust is earned through
traceability, explicit confidence, and honest boundaries.

## The one thing that matters

**Evidence → reasoning → finding → professional decision.** The system's job is to make
the audit record honest — every claim cites its clause (registry provenance), every
judgement carries an explicit confidence label, every conclusion stays the auditor's.

## Non-negotiable product truths

- Compliance ≠ safety. Passing checks never implies a scheme is "safe"; the product must
  never declare a scheme safe.
- Canonical stages are internal mapping conveniences; they are never shown without the
  Native Stage label and mapping confidence (ADR-0002).
- Unknown is never treated as No; input states are explicit.
- Issued reports are immutable, numbered revisions (I1, I2 …); later runs never alter them.
- Recommendations are enforced to be specific and proportionate ("consider" is rejected).
- Final professional responsibility remains with the qualified auditor and the road authority.

## Visitor modes by surface

- `/` (landing): **Persuade** — earn the trust of a sceptical professional audience.
- `/projects…`, audit review: **Operate** — dense, calm, precise working surfaces.
- `/dev`: internal console — consistent tokens, zero ceremony.

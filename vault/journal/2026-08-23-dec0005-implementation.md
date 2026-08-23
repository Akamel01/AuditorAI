---
title: DEC-0005 implementation — audit issues + provided-substance invariant
type: journal
date: 2026-08-23
owner: agent
---

Implemented the two owner decisions from the reviewer grill session, after
approval to proceed and merge. Map: v3-architecture-deepening; decisions:
ADR-0004 / DEC-0005 (audit lifecycle) and the Input State boundary rule.

1. **Audit issues (ADR-0004).** `AuditIssue` type in domain/types.ts;
   Repository gained the issue namespace (`ws:{ws}:issue:{p}:{a}:{rev}`),
   write-once sequential revisions with a conflict guard, numeric-order
   listing; new `/audits/[auditId]/issues` GET/POST route; the audit page has
   an Issue control (confirm dialog) and an immutable-lineage panel with per-
   revision .md/.json downloads. E2E extends the full-path test through I1→I2.
   Issued snapshots are frozen by construction: runs only ever touch draft
   keys.

2. **Provided-requires-substance invariant (Input State decision).**
   `patchProject` rejects any merged record claiming `provided` without a
   non-blank value or ≥1 attachment, naming the input. Two existing merge-table
   cases were rewritten because they encoded exactly the now-invalid
   combination (blank detach-all on provided). The client no longer writes
   unsubstantiated claims: selecting Provided reveals affordances locally and
   the first substantive action (text blur with content, image attach,
   extractable upload) performs the write; AG-MANIFEST's defensive downgrade
   remains as the legacy-data guard.

Surprises worth keeping:

1. The invariant invalidated two *tests*, not just hypothetical clients —
   the old merge table enshrined blank-provided as legal. Contract-first
   thinking would have caught this earlier; the tests were amended to keep
   their original intent under the new rule.
2. Client-side, "reveal then substantiate" was needed to keep the paste-image
   flow usable (M2 e2e selects Provided before any substance exists). Blur on
   an empty textarea is now a deliberate no-op rather than a rejected write.

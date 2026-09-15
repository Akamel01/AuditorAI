---
id: H4
title: f1-judge-recovery
type: task
hitl: false
status: closed
assignee: 
blocked_by: []
blocks: []
created: 2026-09-15
resolved: 2026-09-15
grill: 
lane_gate: JUDGE_TRANSPORT
reviewer: 
self-approve: true
---
Category: Eval unblock
Summary: Close v2-F1 when judge transport recovers: rerun Tier-1 -> rebase/topup -> zero-drop + GF-9 verify.
Current: Zen 500s on muse-spark free models; x-preview-f-free 401s (retired). Zero spend so far.
Desired: On recovery (or owner-pinned new judge model + re-baseline per H7): full 11-fixture run, archive, close F1, unblock F4.

## Resolution

Solved + executed 2026-09-15 (merged with H7 fix): responses transport implemented, fresh Tier-1 2026-09-15T08-44-29-699Z (11/11, 22/22 judged), archived --rebase --topup, F1 CLOSED. Unblocks F4 (schema still owed by owner).

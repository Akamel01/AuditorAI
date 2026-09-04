MR3 — Regression tests for in-process lock + callback dedup
Context: Implement regression tests for in-process harvest lock (memory-based) and dedupe callback paths.

- Tests added:
  - src/__tests__/discovery/hold-r3.test.ts
    - busy: second harvest invocation is skipped when lock is held (in-process lock)
    - ordering: new dedupe clusters preserve insertion order
    - dedupe: duplicate/near_dup paths exercised via emptyDedupeIndex, claimFingerprints, checkDuplicate

- Approach:
  - Leveraged MemoryStore via setDataStoreForTests for hermetic tests.
  - Used withHarvestLock to exercise in-process locking semantics.
  - Used dedupe.ts primitives to validate fingerprint deduplication ordering and status paths.

Artifacts:
- src/__tests__/discovery/hold-r3.test.ts
- .autoforge/execution/M-R3.md (test execution note)

 RC-3 note onRun: included as a comment in test to reflect gating/guard semantics in harvest flow.

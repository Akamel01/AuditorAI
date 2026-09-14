Module: M-A4 - Per-hit provider.fetch with fallback in D04 Acquire

- What changed: src/discovery/pipeline.ts (d04Acquire) now attempts per-hit fetch via hit.provider_id; if that fetch throws or is unavailable, falls back to the legacy direct fetch path. Removed explicit withHostBudget wrapping around provider.fetch calls. Removed dead sequence placeholder.
- New test: tests/domain/discovery-pipeline-d04.test.ts to exercise the new path with a seed-portals provider that throws and a legacy fetch fallback path; asserts provider.fetch was invoked and that the pipeline runs without error.
- New test coverage file: ensures per-hit fetch invocation and fallback behavior; uses a fake provider that throws to validate fallback path.
- Documentation: brief summary file at runtime to aid reviewers.

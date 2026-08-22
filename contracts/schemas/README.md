# Schemas

Versioned, deterministic JSON Schemas for all shared artifacts: project metadata,
jurisdiction/framework/stage selection, input manifests, findings, evidence records,
policy packs, report envelopes.

Rules:

- Every schema file carries an `id` and `$version`; breaking changes bump the version.
- Schemas are the single source of truth for artifact shape; code validates against them.
- Golden fixtures in `tests/golden/` must validate against these schemas.

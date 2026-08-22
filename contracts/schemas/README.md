# Schemas

Versioned, deterministic JSON Schemas for all shared artifacts: project metadata,
jurisdiction/framework/stage selection, input manifests, findings, evidence records,
policy packs, report envelopes.

Rules:

- Every schema file carries an `$id`; breaking changes bump the version.
- Schemas are the single source of truth for artifact shape; contract tests in
  `tests/contract/` bind real engine/API output to these files — drift fails CI.

## Index

| Schema | Covers |
|---|---|
| `policy-pack.schema.json` | jurisdiction policy packs under `policies/*/pack.json` |
| `finding.schema.json` | typed findings (safety_concern / compliance_question), ADR-0003 |
| `audit-result.schema.json` | full AuditResult incl. manifest, missing info, questions ($refs finding) |
| `project.schema.json` | Project records incl. stage_selection + input_values states |

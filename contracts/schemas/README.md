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

## Request schemas

Request bodies validated at the trust boundary (`src/lib/request-schema.ts`);
the surface registry is `contracts/api-surface.json`. These own type and shape
only — the domain keeps the semantics and its 400s.

| Schema | Covers |
|---|---|
| `api/create-project-request.schema.json` | `POST /api/projects` body |
| `api/patch-project-request.schema.json` | `PATCH /api/projects/[projectId]` body |
| `api/audit-patch-request.schema.json` | `PATCH /api/projects/[projectId]/audits/[auditId]` body |
| `api/issue-request.schema.json` | `POST /api/projects/[projectId]/audits/[auditId]/issues` body |
| `api/upload-fields.schema.json` | `POST /api/upload` non-file multipart fields |
| `api/dev-run-request.schema.json` | `POST /api/dev/runs` body |
| `api/dev-run-edit-request.schema.json` | `POST /api/dev/runs/[runId]/edit` body |
| `api/dev-run-step-request.schema.json` | `POST /api/dev/runs/[runId]/step` body |
| `api/dev-discovery-run-request.schema.json` | `POST /api/dev/discovery/run` body |
| `api/dev-harvest-stream-request.schema.json` | `POST /api/dev/harvest-stream` body |
| `api/dev-secrets-request.schema.json` | `POST /api/dev/harvest-stream/secrets` body |

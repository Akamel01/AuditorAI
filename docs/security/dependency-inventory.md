# Runtime dependency inventory and policy

Last verified: 2026-10-26. Scope: production runtime dependencies only. The
authoritative transitive tree is `package-lock.json` (lockfile v3); `npm ci`
installs it exactly. Dev dependencies are out of scope for this policy.

## Runtime inventory

The dependency scan parses this table: the first cell is the package name in
backticks, the second cell is the exact pinned version in plain text, and there is
one row per runtime dependency. No other table in this document may start a row
with a backticked package name.

| Package | Pinned | Purpose |
|---|---|---|
| `ajv` | 8.20.0 | JSON Schema validation for AI candidates, request bodies and domain packs |
| `next` | 15.5.28 | Next.js framework: server routes, rendering and build |
| `pg` | 8.23.1 | PostgreSQL client for the tenant store |
| `react` | 19.2.8 | UI runtime for App Router client components |
| `react-dom` | 19.2.8 | React DOM renderer for the browser |
| `unpdf` | 1.8.1 | PDF text and page extraction for project drawings |

`package.json` carries the executable pin list. The scan fails if this table and
`package.json` disagree, if a row is missing or stale, or if a runtime spec is not
an exact `x.y.z` version.

## Updating a pin

1. Direct dependency: `npm install <package>@<exact-version> --save-exact`.
   `.npmrc` sets `save-exact=true`, so a plain `npm install <package>@<version>`
   also writes an exact spec. Commit `package.json` and `package-lock.json`
   together.
2. Transitive dependency: run `npm audit fix --omit=dev` (never `--force`). If a
   parent package declares the vulnerable range, add a root `overrides` entry
   with the fixed version, record why in the commit or PR, and re-evaluate when
   the parent ships a fix. The current override is
   `overrides: { "postcss": "8.5.26" }` for the postcss tree under Next.
3. Run `npm ci`, `npm audit --omit=dev --audit-level=high`, and the normal CI
   suite before pushing. Never commit `node_modules`.
4. Update the inventory table above in the same change.

## Scan, SBOM and gate

`.github/workflows/dependency-scan.yml` runs on pull requests, pushes to `main`,
weekly (Monday 06:41 UTC) and on demand. It checks this inventory against
`package.json`, generates a CycloneDX JSON SBOM with
`npm sbom --sbom-format cyclonedx --package-lock-only --omit=dev`, installs the
runtime tree with `npm ci --omit=dev`, and runs
`npm audit --omit=dev --audit-level=high`. High or critical findings fail the
job. The audit JSON and the SBOM are uploaded as the
`dependency-scan-<run_id>` artifact and kept for 30 days.

`.github/dependabot.yml` opens weekly update pull requests for npm and GitHub
Actions. Dependabot keeps the exact pins exact; review the resulting audit and CI
run before merging.

## Handling an audit failure

1. Open the failing run, read the step summary and download the artifact.
2. Identify the package, the advisory (GHSA), the severity, whether the
   dependency is direct or transitive, and whether a parent declares the
   vulnerable range.
3. Patch: direct dependency -> update the exact pin; transitive -> run
   `npm audit fix --omit=dev`; parent-pinned transitive -> add or update a root
   `overrides` entry and note when to re-evaluate it.
4. If no compatible fix exists, open a ticket for the breaking upgrade, record
   the decision and an expiry in that ticket, and do not add an allowlist or use
   `--force`. A high or critical finding keeps the scan red until it is fixed.
5. Verify locally with `npm ci && npm audit --omit=dev --audit-level=high`, push,
   and confirm the scan is green before closing the finding.

## Known limits

- Dev dependencies are not scanned; the full-tree audit is out of scope.
- The advisory source is npm/GHSA; absence of findings is not proof of safety.
- Scheduled runs can be delayed on inactive repositories; use
  `workflow_dispatch` to recheck on demand.
- The scan runs on pull requests, pushes to `main`, and weekly, not continuously.

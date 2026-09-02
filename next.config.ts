import type { NextConfig } from "next";

/*
 * Runtime fs reads: policy packs (policies/**) and the compiled evidence
 * registry (state/evidence-registry.json) are loaded from process.cwd() at
 * request time via dynamic paths that output-file tracing cannot see. Without
 * explicit includes, Vercel serverless lambdas ship without them and every
 * pack-reading endpoint 500s (works locally, breaks when deployed).
 */
const API_ROUTES = [
  "/api/jurisdictions",
  "/api/jurisdictions/[jur]/stages",
  "/api/inputs/[jur]",
  "/api/upload",
  "/api/projects",
  "/api/projects/[projectId]",
  "/api/projects/[projectId]/attachments/[attachmentId]",
  "/api/projects/[projectId]/audits",
  "/api/projects/[projectId]/audits/[auditId]",
  "/api/projects/[projectId]/audits/[auditId]/issues",
  "/api/dev/replay",
  "/api/dev/runs",
  "/api/dev/runs/[runId]",
  "/api/dev/runs/[runId]/edit",
  "/api/dev/runs/[runId]/finish",
  "/api/dev/runs/[runId]/step",
  "/api/dev/discovery",
  "/api/dev/discovery/run",
  "/api/dev/discovery/jobs",
  "/api/dev/discovery/jobs/[id]",
  "/api/dev/discovery/jobs/[id]/cancel",
  "/api/dev/health",
  "/api/dev/coverage",
  "/api/dev/odd",
  "/api/dev/readiness",
  "/api/dev/debug",
  "/api/dev/tickets",
];

const RUNTIME_FILES = ["./policies/**/*", "./state/evidence-registry.json", "./state/odd-coverage.json", "./state/dedupe-index.json", "./state/discovery-ledger.json", "./workflow/wayfinder/**/*"];

const outputFileTracingIncludes = Object.fromEntries(
  API_ROUTES.map((route) => [route, RUNTIME_FILES]),
);

const nextConfig: NextConfig = {
  outputFileTracingIncludes,
};

export default nextConfig;

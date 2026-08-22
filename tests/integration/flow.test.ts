// End-to-end flow through the real API route handlers:
// project → jurisdiction → stage → inputs → audit → findings → report.
// Uses the MemoryStore fallback (no KV env in tests).
import { describe, expect, it } from "vitest";
import { POST as createProject, GET as listProjects } from "@/app/api/projects/route";
import { GET as getProject, PATCH as patchProject } from "@/app/api/projects/[projectId]/route";
import { POST as runAuditRoute } from "@/app/api/projects/[projectId]/audits/route";
import { PATCH as patchAudit, GET as getAudit } from "@/app/api/projects/[projectId]/audits/[auditId]/route";
import type { AuditResult, Project } from "@/domain/types";

const KEY = "test-workspace-key-0123456789";
const H = { "x-workspace-key": KEY };

function jsonReq(url: string, method: string, body?: unknown) {
  return new Request(`http://local${url}`, {
    method,
    headers: { ...H, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params<T extends object>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

describe("end-to-end audit flow", () => {
  it("rejects requests without a workspace key", async () => {
    const res = await listProjects(new Request("http://local/api/projects"));
    expect(res.status).toBe(401);
  });

  it("creates a project, sets inputs, runs the audit, adjudicates findings", async () => {
    // 1. create
    const created = await createProject(
      jsonReq("/api/projects", "POST", {
        name: "E2E Corridor",
        jurisdiction: "UK",
        native_stage_id: "uk:S2",
      }),
    );
    expect(created.status).toBe(201);
    const project = ((await created.json()) as { project: Project }).project;
    expect(project.stage_selection.native_stage_id).toBe("uk:S2");

    // 2. list contains it
    const listed = await listProjects(jsonReq("/api/projects", "GET"));
    const projects = (await listed.json()) as { projects: Project[] };
    expect(projects.projects.some((p) => p.project_id === project.project_id)).toBe(true);

    // 3. set all Stage-2 inputs provided except previous responses (intentional gap)
    const inputs: Record<string, { state: string; value?: string }> = {
      scheme_description_objectives: { state: "provided", value: "x" },
      design_standards_applied: { state: "provided", value: "x" },
      design_speeds_and_speed_limits: { state: "provided", value: "60 km/h" },
      traffic_flows_existing_forecast: { state: "provided", value: "24k ADT" },
      vru_desire_lines: { state: "provided", value: "school desire line" },
      environmental_constraints_locality: { state: "provided", value: "none" },
      collision_data_analysis_36mo: { state: "provided", value: "STATS19 36mo" },
      drawing_document_register: { state: "provided", value: "v1" },
      previous_rsa_reports_and_responses: { state: "required_missing" },
    };
    const patched = await patchProject(
      jsonReq(`/api/projects/${project.project_id}`, "PATCH", { input_values: inputs }),
      params({ projectId: project.project_id }),
    );
    expect(patched.status).toBe(200);

    // 4. run audit
    const run = await runAuditRoute(
      jsonReq(`/api/projects/${project.project_id}/audits`, "POST"),
      params({ projectId: project.project_id }),
    );
    expect(run.status).toBe(201);
    const audit = ((await run.json()) as { audit: AuditResult }).audit;

    // determinism: identical rerun differs only by ran_at
    const run2 = await runAuditRoute(
      jsonReq(`/api/projects/${project.project_id}/audits`, "POST"),
      params({ projectId: project.project_id }),
    );
    const audit2 = ((await run2.json()) as { audit: AuditResult }).audit;
    const strip = (a: AuditResult) => JSON.stringify({ ...a, ran_at: "", audit_id: "" });
    expect(strip(audit2)).toBe(strip(audit));

    // process-gap finding present; no safety concerns fabricated
    expect(audit.findings.map((f) => f.finding_id)).toContain("F-R-UK-PREVRESP-uk-S2");
    expect(audit.findings.filter((f) => f.kind === "safety_concern")).toHaveLength(0);

    // 5. adjudicate: banned wording must be rejected
    const bad = await patchAudit(
      jsonReq(`/api/projects/${project.project_id}/audits/${audit.audit_id}`, "PATCH", {
        finding_updates: [
          {
            finding_id: "F-R-UK-PREVRESP-uk-S2",
            reviewer_status: "accepted_with_edits",
            recommendation: "Consider reviewing the Stage 1 response report",
          },
        ],
      }),
      params({ projectId: project.project_id, auditId: audit.audit_id }),
    );
    expect(bad.status).toBe(400);

    const good = await patchAudit(
      jsonReq(`/api/projects/${project.project_id}/audits/${audit.audit_id}`, "PATCH", {
        finding_updates: [
          {
            finding_id: "F-R-UK-PREVRESP-uk-S2",
            reviewer_status: "accepted",
            recommendation: "Obtain the Stage 1 response report and record agreed actions before Stage 3.",
          },
        ],
      }),
      params({ projectId: project.project_id, auditId: audit.audit_id }),
    );
    expect(good.status).toBe(200);
    const after = ((await good.json()) as { audit: AuditResult }).audit;
    const f = after.findings.find((x) => x.finding_id === "F-R-UK-PREVRESP-uk-S2");
    expect(f?.reviewer_status).toBe("accepted");

    // 6. persisted state round-trips
    const fetched = await getAudit(
      jsonReq(`/api/projects/${project.project_id}/audits/${audit.audit_id}`, "GET"),
      params({ projectId: project.project_id, auditId: audit.audit_id }),
    );
    expect(fetched.status).toBe(200);

    void getProject;
  });
});

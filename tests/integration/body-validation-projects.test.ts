// G-6: both PROJECT bodies go through the shared schema validator.
// The schema owns type/shape (422), the domain keeps its semantics (400), and
// the auth gate stays first: a 401 always precedes a 422, so a schema error is
// never visible to an unauthenticated caller.
import { describe, expect, it } from "vitest";
import { POST as createProject, GET as listProjects } from "@/app/api/projects/route";
import {
  GET as getProject,
  PATCH as patchProject,
} from "@/app/api/projects/[projectId]/route";
import { GET as listAudits } from "@/app/api/projects/[projectId]/audits/route";
import type { Project } from "@/domain/types";

// One workspace key per test: the rate limiter buckets by workspace hash
// (120/min), so a shared key would make a parallel vitest run flake.
function wsKey(name: string): string {
  return `bv-projects-${name}-0123456789`;
}

function rawReq(
  url: string,
  method: string,
  body?: string,
  key?: string,
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-workspace-key"] = key;
  const init: RequestInit = { method, headers };
  // GET/HEAD requests cannot carry a body.
  if (body !== undefined && method !== "GET" && method !== "HEAD") init.body = body;
  return new Request(`http://local${url}`, init);
}

function params<T extends object>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

async function makeProject(key: string): Promise<Project> {
  const res = await createProject(
    rawReq(
      "/api/projects",
      "POST",
      JSON.stringify({ name: "Body Validation Corridor", jurisdiction: "UK", native_stage_id: "uk:S2" }),
      key,
    ),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { project: Project }).project;
}

describe("POST /api/projects body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = wsKey("post-wrong-type");
    const res = await createProject(
      rawReq("/api/projects", "POST", JSON.stringify({ name: 123 }), key),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/name");
  });

  it("answers 422 for an unknown property", async () => {
    const key = wsKey("post-unknown-prop");
    const res = await createProject(
      rawReq(
        "/api/projects",
        "POST",
        JSON.stringify({ name: "X", jurisdiction: "UK", native_stage_id: "uk:S2", nope: true }),
        key,
      ),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toMatch(/additional propert/i);
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = wsKey("post-bad-json");
    const res = await createProject(rawReq("/api/projects", "POST", "{not json", key));
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    const res = await createProject(
      rawReq("/api/projects", "POST", JSON.stringify({ name: 123 })),
    );
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("leaves the store unchanged when the body is rejected", async () => {
    const key = wsKey("post-store-unchanged");
    const project = await makeProject(key);
    const before = await listProjects(rawReq("/api/projects", "GET", undefined, key));
    const beforeCount = ((await before.json()) as { projects: Project[] }).projects.length;

    const rejected = await createProject(
      rawReq("/api/projects", "POST", JSON.stringify({ name: 123 }), key),
    );
    expect(rejected.status).toBe(422);

    const after = await listProjects(rawReq("/api/projects", "GET", undefined, key));
    const afterProjects = ((await after.json()) as { projects: Project[] }).projects;
    expect(afterProjects.length).toBe(beforeCount);
    const audits = await listAudits(
      rawReq(`/api/projects/${project.project_id}/audits`, "GET", undefined, key),
      params({ projectId: project.project_id }),
    );
    expect(((await audits.json()) as { audits: unknown[] }).audits).toEqual([]);
  });

  it("keeps the domain 400s", async () => {
    const key = wsKey("post-domain-400");
    const blank = await createProject(
      rawReq("/api/projects", "POST", JSON.stringify({ name: "   " }), key),
    );
    expect(blank.status).toBe(400);
    expect(await errorOf(blank)).toBe("name is required");

    const missing = await createProject(
      rawReq("/api/projects", "POST", JSON.stringify({ name: "X" }), key),
    );
    expect(missing.status).toBe(400);
    expect(await errorOf(missing)).toMatch(/jurisdiction and native_stage_id are required/);

    const unknownStage = await createProject(
      rawReq(
        "/api/projects",
        "POST",
        JSON.stringify({ name: "X", jurisdiction: "UK", native_stage_id: "uk:NOPE" }),
        key,
      ),
    );
    expect(unknownStage.status).toBe(400);
    expect(await errorOf(unknownStage)).toMatch(/unknown native stage/);
  });

  it("answers 422 for a jurisdiction outside the enum", async () => {
    const key = wsKey("post-bad-jurisdiction");
    const res = await createProject(
      rawReq(
        "/api/projects",
        "POST",
        JSON.stringify({ name: "X", jurisdiction: "ZZ", native_stage_id: "uk:S2" }),
        key,
      ),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/jurisdiction");
  });

  it("accepts a valid body with 201", async () => {
    const key = wsKey("post-valid");
    const res = await createProject(
      rawReq(
        "/api/projects",
        "POST",
        JSON.stringify({ name: "Valid Corridor", jurisdiction: "UK", native_stage_id: "uk:S2" }),
        key,
      ),
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { project: Project }).project.project_id).toMatch(/^P-/);
  });
});

describe("PATCH /api/projects/[projectId] body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = wsKey("patch-wrong-type");
    const project = await makeProject(key);
    const res = await patchProject(
      rawReq(
        `/api/projects/${project.project_id}`,
        "PATCH",
        JSON.stringify({ metadata: { name: 123 } }),
        key,
      ),
      params({ projectId: project.project_id }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/metadata/name");
  });

  it("answers 422 for an unknown property", async () => {
    const key = wsKey("patch-unknown-prop");
    const project = await makeProject(key);
    const res = await patchProject(
      rawReq(
        `/api/projects/${project.project_id}`,
        "PATCH",
        JSON.stringify({ bogus: 1 }),
        key,
      ),
      params({ projectId: project.project_id }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toMatch(/additional propert/i);
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = wsKey("patch-bad-json");
    const project = await makeProject(key);
    const res = await patchProject(
      rawReq(`/api/projects/${project.project_id}`, "PATCH", "{not json", key),
      params({ projectId: project.project_id }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    const key = wsKey("patch-no-key");
    const project = await makeProject(key);
    const res = await patchProject(
      rawReq(`/api/projects/${project.project_id}`, "PATCH", JSON.stringify({ metadata: { name: 123 } })),
      params({ projectId: project.project_id }),
    );
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("leaves the store unchanged when the body is rejected", async () => {
    const key = wsKey("patch-store-unchanged");
    const project = await makeProject(key);
    const rejected = await patchProject(
      rawReq(
        `/api/projects/${project.project_id}`,
        "PATCH",
        JSON.stringify({ metadata: { name: 123 } }),
        key,
      ),
      params({ projectId: project.project_id }),
    );
    expect(rejected.status).toBe(422);

    const fetched = await getProject(
      rawReq(`/api/projects/${project.project_id}`, "GET", undefined, key),
      params({ projectId: project.project_id }),
    );
    const stored = ((await fetched.json()) as { project: Project }).project;
    expect(stored.input_values).toEqual({});
    expect(stored.updated_at).toBe(project.updated_at);
    const audits = await listAudits(
      rawReq(`/api/projects/${project.project_id}/audits`, "GET", undefined, key),
      params({ projectId: project.project_id }),
    );
    expect(((await audits.json()) as { audits: unknown[] }).audits).toEqual([]);
  });

  it("keeps the domain 400 for a non-string state", async () => {
    const key = wsKey("patch-domain-400");
    const project = await makeProject(key);
    const res = await patchProject(
      rawReq(
        `/api/projects/${project.project_id}`,
        "PATCH",
        JSON.stringify({ input_values: { drawing_document_register: { state: 42 } } }),
        key,
      ),
      params({ projectId: project.project_id }),
    );
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("bad value for drawing_document_register");
  });

  it("keeps the domain 400 for an unsubstantiated 'provided'", async () => {
    const key = wsKey("patch-unsubstantiated");
    const project = await makeProject(key);
    const res = await patchProject(
      rawReq(
        `/api/projects/${project.project_id}`,
        "PATCH",
        JSON.stringify({ input_values: { drawing_document_register: { state: "provided" } } }),
        key,
      ),
      params({ projectId: project.project_id }),
    );
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatch(/cannot be 'provided' without a value or attachment/);
  });

  it("accepts a valid body with 200", async () => {
    const key = wsKey("patch-valid");
    const project = await makeProject(key);
    const res = await patchProject(
      rawReq(
        `/api/projects/${project.project_id}`,
        "PATCH",
        JSON.stringify({ metadata: { name: "Renamed Corridor" } }),
        key,
      ),
      params({ projectId: project.project_id }),
    );
    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as { project: Project }).project.metadata.name,
    ).toBe("Renamed Corridor");
  });
});

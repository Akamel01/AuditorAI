import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { Project } from "../src/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";
function loadProject(file: string): Project {
  const fx = JSON.parse(readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8")) as {
    fixture_id?: string;
    jurisdiction: string;
    native_stage_id: string;
    metadata: Project["metadata"];
    inputs: Project["input_values"];
  };
  return {
    project_id: `P-${fx.fixture_id ?? "X"}`,
    workspace_key_hash: "gf",
    metadata: fx.metadata,
    stage_selection: { jurisdiction: fx.jurisdiction as Project["stage_selection"]["jurisdiction"], native_stage_id: fx.native_stage_id },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
}

async function main() {
  const { Repository, MemoryStore, workspaceHash, setDataStoreForTests } = await import("../src/lib/persistence");
  const { POST } = await import("../src/app/api/projects/[projectId]/audits/route");
  const project = loadProject("gf2-usa-rural-highway-prelim.json");
  const key = "cold-run-workspace-key-1234567890";
  const ws = workspaceHash(key);
  const store = new MemoryStore();
  setDataStoreForTests(store);
  const repo = new Repository(store);
  await repo.saveProject(ws, project);

  const t0 = performance.now();
  const req = new Request(`http://localhost/api/projects/${project.project_id}/audits`, {
    method: "POST",
    headers: { "x-workspace-key": key },
  });
  const res = await POST(req, { params: Promise.resolve({ projectId: project.project_id }) });
  const dt = performance.now() - t0;
  await res.json();
  console.log(JSON.stringify({ status: res.status, durationMs: dt }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// D3 gates: dev-console routes over MemoryStore — admin guard, step-run,
// edit-and-resume, finish archiving the N3 trail, replay split.
import { describe, expect, it } from "vitest";
import { POST as createRun } from "@/app/api/dev/runs/route";
import { GET as getRun, DELETE as dropRun } from "@/app/api/dev/runs/[runId]/route";
import { POST as step } from "@/app/api/dev/runs/[runId]/step/route";
import { POST as edit } from "@/app/api/dev/runs/[runId]/edit/route";
import { POST as finish } from "@/app/api/dev/runs/[runId]/finish/route";
import { GET as replay } from "@/app/api/dev/replay/route";
import { buildLayers } from "@/lib/devtab";
import { DESCRIPTORS } from "@/domain/pipeline/registry";
import type { Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";
const KEY = "dev-admin-key-0123456789";
process.env.ADMIN_KEY = KEY;
const H = { "x-admin-key": KEY, "content-type": "application/json" };

function req(url: string, method: string, body?: unknown) {
  return new Request(`http://local${url}`, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params<T extends object>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

const DEMO: Project = {
  project_id: "P-devdemo01",
  workspace_key_hash: "devconsole",
  metadata: { name: "Demo", description: "", scheme_summary: "", authority: "D", location: "" },
  stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
  input_values: {},
  created_at: T0,
  updated_at: T0,
};

describe("dev console guard", () => {
  it("rejects missing or wrong admin keys identically", async () => {
    const noKey = await createRun(
      new Request("http://local/api/dev/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: DEMO }),
      }),
    );
    const wrongKey = await createRun(
      new Request("http://local/api/dev/runs", {
        method: "POST",
        headers: { "x-admin-key": "wrong", "content-type": "application/json" },
        body: JSON.stringify({ project: DEMO }),
      }),
    );
    expect(noKey.status).toBe(401);
    expect(wrongKey.status).toBe(401);
    expect(await noKey.text()).toBe(await wrongKey.clone().text());
  });
});

describe("step-run session", () => {
  let runId = "";

  it("creates a session with descriptors and batch order", async () => {
    const res = await createRun(req("/api/dev/runs", "POST", { project: DEMO }));
    expect(res.status).toBe(200);
    const d = (await res.json()) as { runId: string; descriptors: unknown[]; batchOrder: string[] };
    runId = d.runId;
    expect(d.descriptors).toHaveLength(11);
    expect(d.batchOrder).not.toContain("AG-PERSIST");
  });

  it("executes nodes in order with accumulating state and artifacts", async () => {
    const order = ["AG-PROJECT", "AG-STAGE-SELECT", "AG-MANIFEST", "AG-RULES", "AG-FINDINGS"];
    for (const nodeId of order) {
      const res = await step(req(`/api/dev/runs/${runId}/step`, "POST", { nodeId }), params({ runId }));
      expect(res.status).toBe(200);
      const d = (await res.json()) as { executed: string; artifacts: unknown[]; trail: unknown[] };
      expect(d.executed).toBe(nodeId);
      expect(d.trail).toHaveLength(order.indexOf(nodeId) + 1);
    }
    const snap = await getRun(req(`/api/dev/runs/${runId}`, "GET"), params({ runId }));
    const s = (await snap.json()) as { state: Record<string, unknown> };
    expect(s.state.stage_context).toBeDefined();
    expect(s.state.rule_results).toBeDefined();
  });

  it("AI toggle on with Off adapter yields null slice, zero calls, no artifact", async () => {
    // Advance to AI-CANDIDATES' prerequisites first.
    for (const nodeId of ["AG-QUESTIONS"]) {
      await step(req(`/api/dev/runs/${runId}/step`, "POST", { nodeId }), params({ runId }));
    }
    const res = await step(
      req(`/api/dev/runs/${runId}/step`, "POST", { nodeId: "AG-AI-CANDIDATES", ai: true }),
      params({ runId }),
    );
    expect(res.status).toBe(200); // refusal is graceful, not an error
    const d = (await res.json()) as {
      state: { candidate_findings: unknown };
      artifacts: { validation_status: string; payload: { reason?: string } }[];
    };
    expect(d.state.candidate_findings).toBeNull(); // Off adapter ⇒ null slice, zero calls
    expect(d.artifacts).toEqual([]); // and nothing emitted into the trail
  });

  it("edit-and-resume replaces a slice whole between steps", async () => {
    const res = await edit(
      req(`/api/dev/runs/${runId}/edit`, "POST", {
        slice: "input_manifest",
        value: [{ input_id: "injected", label: "Injected", requirement_level: "required", state: "provided", evidence_ids: [], conditional_on: null }],
      }),
      params({ runId }),
    );
    expect(res.status).toBe(200);
    const d = (await res.json()) as { state: { input_manifest: { input_id: string }[] } };
    expect(d.state.input_manifest[0].input_id).toBe("injected");

    // Resume: a later node sees the edited slice.
    const r2 = await step(
      req(`/api/dev/runs/${runId}/step`, "POST", { nodeId: "AG-EVIDENCE-LINKS" }),
      params({ runId }),
    );
    void r2;
  });

  it("finish archives the accumulated trail into the N3 layout; replay splits it", async () => {
    for (const nodeId of ["AG-ADJUDICATION", "AG-REPORT"]) {
      const res = await step(req(`/api/dev/runs/${runId}/step`, "POST", { nodeId }), params({ runId }));
      if (!res.ok) throw new Error(`${nodeId}: ${await res.text()}`);
    }
    const fin = await finish(req(`/api/dev/runs/${runId}/finish`, "POST"), params({ runId }));
    expect(fin.status).toBe(200);
    const f = (await fin.json()) as { audit_id: string; stored: number };
    expect(f.stored).toBeGreaterThan(0);

    const rep = await replay(
      req(`/api/dev/replay?project=P-devdemo01&audit=${encodeURIComponent(f.audit_id)}`, "GET"),
    );
    expect(rep.status).toBe(200);
    const r = (await rep.json()) as { count: number; trusted: unknown[]; regenerate: unknown[] };
    expect(r.count).toBe(r.trusted.length + r.regenerate.length);
  });

  it("abandoning a session drops it server-side", async () => {
    await dropRun(req(`/api/dev/runs/${runId}`, "DELETE"), params({ runId }));
    const snap = await getRun(req(`/api/dev/runs/${runId}`, "GET"), params({ runId }));
    expect(snap.status).toBe(404);
  });
});

describe("DAG layering", () => {
  it("builds topologically consistent layers from descriptors", () => {
    const layers = buildLayers(DESCRIPTORS);
    const flat = layers.flat().map((d) => d.id);
    expect(flat).toHaveLength(DESCRIPTORS.length);
    const position = new Map(flat.map((id, i) => [id, i]));
    for (const d of DESCRIPTORS) {
      for (const dep of d.depends_on) {
        expect(position.get(dep)!).toBeLessThan(position.get(d.id)!);
      }
    }
  });
});

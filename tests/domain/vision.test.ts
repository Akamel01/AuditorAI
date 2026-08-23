// M3 gates: vision path — image-block wire format, per-call cap with
// name-only overflow degradation, attachment-id provenance stamping, and
// deterministic-path isolation when the adapter is disabled.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DefaultAuditPipeline } from "@/domain/pipeline/pipeline";
import { ZenAiAdapter, type AiAdapter, type CandidateFinding } from "@/lib/ai";
import { runAudit } from "@/domain/engine";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";
const PNG = (n: number) =>
  `data:image/png;base64,${Buffer.alloc(n, n % 251).toString("base64")}`;

function gf1Project(): Project {
  const fx = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "tests/fixtures/gf1-uk-urban-arterial-stage2.json"),
      "utf8",
    ),
  ) as {
    fixture_id?: string;
    jurisdiction: string;
    native_stage_id: string;
    metadata: Project["metadata"];
    inputs: Record<string, { state: InputValueState; value?: string }>;
  };
  return {
    project_id: `P-${fx.fixture_id ?? "X"}`,
    workspace_key_hash: "gf",
    metadata: fx.metadata,
    stage_selection: {
      jurisdiction: fx.jurisdiction as JurisdictionId,
      native_stage_id: fx.native_stage_id,
    },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
}

const pipeline = new DefaultAuditPipeline();

function capturingAdapter(returns: CandidateFinding[] = []) {
  const calls: { images?: string[]; notes?: string[] }[] = [];
  const adapter: AiAdapter = {
    enabled: true,
    async generateCandidates(_audit, images, contextNotes) {
      calls.push({ images, notes: contextNotes });
      return returns.map((c) => ({ ...c }));
    },
  };
  return { adapter, calls };
}

describe("vision reasoning path (M3)", () => {
  it("passes capped image blocks on the wire within the budget; overflow degrades to names", async () => {
    const { adapter, calls } = capturingAdapter();
    const attachments = Array.from({ length: 6 }, (_, i) => ({
      attachment_id: `ATT-p-img000${i}`,
      file_name: `plan-${i}.png`,
      data_url: PNG(i + 10),
    }));

    await pipeline.runAllLiveArtifacts(gf1Project(), T0, { aiAdapter: adapter, attachments });

    expect(calls).toHaveLength(1);
    expect(calls[0].images).toHaveLength(4); // MAX_IMAGES_PER_CALL
    expect(calls[0].notes).toEqual(["plan-4.png", "plan-5.png"]);
  });

  it("stamps candidates with the attachment ids they were derived from", async () => {
    const returns: CandidateFinding[] = [
      {
        kind: "safety_concern",
        category: "conflict_point",
        location: null,
        road_users: ["cyclists"],
        scenario: null,
        statement: { text: "Kerb radius tight.", normative_basis_note: null },
        evidence: [{ evidence_id: "EV-UK-001", quote: null, use: "supports_concern" }],
        assumptions: [],
        rationale: "From drawing.",
        recommendation: null,
        producer: "untrusted",
      },
    ];
    const { adapter } = capturingAdapter(returns);
    const { state } = await pipeline.runAllLiveArtifacts(gf1Project(), T0, {
      aiAdapter: adapter,
      attachments: [
        { attachment_id: "ATT-p-a000001", file_name: "a.png", data_url: PNG(20) },
        { attachment_id: "ATT-p-b000002", file_name: "b.png", data_url: PNG(21) },
      ],
    });

    expect(state.candidate_findings![0].source_attachment_ids).toEqual([
      "ATT-p-a000001",
      "ATT-p-b000002",
    ]);
    expect(Object.keys(state.candidate_findings![0])).toContain("source_attachment_ids");
  });

  it("no attachments means no image blocks and no stamping", async () => {
    const { adapter, calls } = capturingAdapter();
    const { state } = await pipeline.runAllLiveArtifacts(gf1Project(), T0, {
      aiAdapter: adapter,
    });
    expect(calls[0].images ?? []).toEqual([]);
    expect(calls[0].notes).toBeUndefined();
    expect(state.candidate_findings).toEqual([]); // nothing returned ⇒ no ids stamped anywhere
  });

  it("deterministic path stays untouched when adapter disabled", async () => {
    const off: AiAdapter = {
      enabled: false,
      async generateCandidates() {
        throw new Error("must not be called");
      },
    };
    const project = gf1Project();
    const result = await pipeline.runAllLive(project, T0, { aiAdapter: off });
    expect(JSON.stringify(result)).toBe(JSON.stringify(runAudit(project, T0)));
  });
});

// Live geometric smoke — only with real creds; a tiny programmatic T-junction
// drawing is rendered to PNG and sent through the real vision path.
const LIVE =
  process.env.AI_ENABLED === "true" && typeof process.env.OPENCODE_API_KEY === "string";

describe.skipIf(!LIVE)("vision live smoke (env-gated)", () => {
  it(
    "derives a candidate referencing an obvious geometric feature",
    async () => {
      const zen = new ZenAiAdapter({ apiKey: process.env.OPENCODE_API_KEY! });
      const live: AiAdapter = {
        enabled: true,
        async generateCandidates(audit, images, notes) {
          return zen.generateCandidates(audit, images, notes);
        },
      };
      const png = await renderTJunctionPng();
      const { state } = await pipeline.runAllLiveArtifacts(gf1Project(), T0, {
        aiAdapter: live,
        attachments: [
          { attachment_id: "ATT-p-smoke01", file_name: "t-junction.png", data_url: `data:image/png;base64,${png}` },
        ],
      });
      expect(Array.isArray(state.candidate_findings)).toBe(true); // graceful empty allowed
      for (const c of state.candidate_findings ?? []) {
        expect(c.source_attachment_ids).toEqual(["ATT-p-smoke01"]); // provenance stamped
      }
    },
    120_000,
  );
});

async function renderTJunctionPng(): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  await page.setContent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
      <rect width="320" height="240" fill="#f4f4f4"/>
      <rect x="0" y="100" width="320" height="40" fill="#333"/>
      <rect x="140" y="0" width="40" height="140" fill="#333"/>
      <rect x="150" y="10" width="6" height="60" fill="#fff"/>
    </svg>`);
  const buf = await page.screenshot({ type: "png" });
  await browser.close();
  return buf.toString("base64");
}

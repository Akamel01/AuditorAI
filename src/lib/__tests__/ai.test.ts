// A1 gates: strict boundary behavior of ZenAiAdapter against a fake fetch —
// happy path, malformed JSON repair, schema violation, transport failure,
// circuit breaker, effort wire-param discovery, env gating, prompt snapshot.
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  OffAiAdapter,
  ZenAiAdapter,
  buildPromptMessages,
  getAiAdapter,
  type ZenAiConfig,
} from "@/lib/ai";
import { runAudit } from "@/domain/engine";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.OPENCODE_API_KEY;
  vi.restoreAllMocks();
});

function gf1Audit() {
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
  const project: Project = {
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
  return runAudit(project, T0);
}

const VALID_CANDIDATE = [
  {
    kind: "compliance_question",
    category: "process_continuity",
    location: null,
    road_users: ["pedestrians"],
    scenario: null,
    statement: { text: "Crossing provision unclear at junction.", normative_basis_note: null },
    evidence: [{ evidence_id: "EV-UK-001", quote: null, use: "defines_requirement" }],
    assumptions: [],
    rationale: "Derived from manifest gap.",
    recommendation: "Record the intended crossing type before design freeze.",
  },
];

interface RecordedCall {
  url: string;
  body: Record<string, unknown>;
  headers: Headers;
}

type ScriptedResponse = { status: number; content?: string; raw?: string };

function makeFetch(responses: ScriptedResponse[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      headers: new Headers(init?.headers),
    });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const payload =
      r.content !== undefined
        ? JSON.stringify({ choices: [{ message: { content: r.content } }] })
        : (r.raw ?? "");
    return new Response(payload, { status: r.status });
  }) as typeof fetch;
  return { impl, calls };
}

function cfg(over: Partial<ZenAiConfig> = {}): ZenAiConfig {
  return { apiKey: "sk-test", ...over };
}

describe("adapter factory", () => {
  it("returns OffAiAdapter unless AI_ENABLED=true and credentials are present", () => {
    expect(getAiAdapter()).toBeInstanceOf(OffAiAdapter);
    expect(getAiAdapter().enabled).toBe(false);

    process.env.AI_ENABLED = "true";
    expect(getAiAdapter()).toBeInstanceOf(OffAiAdapter); // key still missing

    process.env.OPENCODE_API_KEY = "sk-live";
    expect(getAiAdapter().enabled).toBe(true);
  });
});

describe("ZenAiAdapter", () => {
  it("generates labelled candidates on the happy path", async () => {
    const { impl, calls } = makeFetch([
      { status: 200, content: JSON.stringify(VALID_CANDIDATE) },
    ]);
    const adapter = new ZenAiAdapter(cfg({ fetchImpl: impl }));

    const out = await adapter.generateCandidates(gf1Audit());

    expect(out).toHaveLength(1);
    expect(out[0].producer).toBe("safety-reasoning-agent");
    expect(calls[0].url).toBe("https://opencode.ai/zen/v1/chat/completions");
    expect(calls[0].body.model).toBe("x-preview-f-free");
    expect(calls[0].body.reasoning_effort).toBe("high");
    expect(calls[0].headers.get("Authorization")).toBe("Bearer sk-test");
  });

  it("repairs malformed JSON once, then accepts", async () => {
    const { impl, calls } = makeFetch([
      { status: 200, content: "I found issues ```json {not valid```" },
      { status: 200, content: JSON.stringify(VALID_CANDIDATE) },
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = new ZenAiAdapter(cfg({ fetchImpl: impl }));

    const out = await adapter.generateCandidates(gf1Audit());

    expect(out).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("degrades to empty after the single repair retry fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { impl, calls } = makeFetch([{ status: 200, content: "still not json" }]);
    const adapter = new ZenAiAdapter(cfg({ fetchImpl: impl }));

    const out = await adapter.generateCandidates(gf1Audit());

    expect(out).toEqual([]);
    expect(calls).toHaveLength(2); // initial + exactly one repair
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("one repair retry"));
  });

  it("rejects schema-violating payloads even when they parse as JSON", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = [{ kind: "safety_concern" }];
    const { impl, calls } = makeFetch([{ status: 200, content: JSON.stringify(bad) }]);
    const adapter = new ZenAiAdapter(cfg({ fetchImpl: impl }));

    const out = await adapter.generateCandidates(gf1Audit());

    expect(out).toEqual([]);
    expect(calls).toHaveLength(2); // one repair only
    expect(warn).toHaveBeenCalled();
  });

  it("fails safe on transport errors and switches to the fallback provider once", async () => {
    const urls: string[] = [];
    let i = 0;
    const impl = (async (url: string | URL | Request) => {
      urls.push(String(url));
      i += 1;
      if (i === 1) throw Object.assign(new Error("timeout"), { name: "AbortError" });
      return new Response(JSON.stringify({ choices: [{ message: { content: "[]" } }] }), {
        status: 200,
      });
    }) as typeof fetch;
    const adapter = new ZenAiAdapter(
      cfg({
        fetchImpl: impl,
        fallbackBaseUrl: "https://openrouter.ai/api/v1/",
        fallbackApiKey: "sk-or",
      }),
    );

    const out = await adapter.generateCandidates(gf1Audit());

    expect(out).toEqual([]);
    expect(urls[1]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("opens the circuit breaker after repeated failures and short-circuits", async () => {
    let fetchCount = 0;
    const impl = (async () => {
      fetchCount += 1;
      return new Response("", { status: 429 });
    }) as typeof fetch;
    const adapter = new ZenAiAdapter(cfg({ fetchImpl: impl, breakerThreshold: 2 }));

    await adapter.generateCandidates(gf1Audit());
    await adapter.generateCandidates(gf1Audit());
    const afterTwo = fetchCount;
    const out = await adapter.generateCandidates(gf1Audit());

    expect(out).toEqual([]);
    expect(afterTwo).toBeGreaterThan(0);
    expect(fetchCount).toBe(afterTwo); // breaker open ⇒ zero further calls
  });

  it("discovers reasoning_effort rejection and retries without the param", async () => {
    const bodies: Record<string, unknown>[] = [];
    let i = 0;
    const impl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      bodies.push(body);
      i += 1;
      if (i === 1) return new Response("unsupported arg reasoning_effort", { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "[]" } }] }), {
        status: 200,
      });
    }) as typeof fetch;
    const adapter = new ZenAiAdapter(cfg({ fetchImpl: impl }));

    const out = await adapter.generateCandidates(gf1Audit());

    expect(out).toEqual([]);
    expect(bodies[0].reasoning_effort).toBe("high");
    expect(bodies[1].reasoning_effort).toBeUndefined();
  });

  it("snapshots the prompt structure for regression visibility", () => {
    expect(buildPromptMessages(gf1Audit())).toMatchSnapshot();
  });

  it("accepts image blocks in the user content when supplied", () => {
    const messages = buildPromptMessages(gf1Audit(), ["data:image/png;base64,AAAA"]);
    const user = messages[1].content as { type: string; image_url?: unknown }[];
    expect(Array.isArray(user)).toBe(true);
    expect(user.some((p) => p.type === "image_url")).toBe(true);
  });
});

// Integration smoke — runs ONLY when live credentials are present in the
// environment (never in CI, where AI_ENABLED is unset).
const LIVE =
  process.env.AI_ENABLED === "true" && typeof process.env.OPENCODE_API_KEY === "string";

describe.skipIf(!LIVE)("live smoke (env-gated)", () => {
  it(
    "round-trips a real bounded-candidates request against Zen",
    async () => {
      const adapter = new ZenAiAdapter({ apiKey: process.env.OPENCODE_API_KEY! });
      const out = await adapter.generateCandidates(gf1Audit());
      expect(Array.isArray(out)).toBe(true); // graceful empty allowed; never throws
    },
    70_000,
  );
});

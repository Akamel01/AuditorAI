/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrototype, classifyExit, promptHash, EXTRACT_HASH, VERIFY_HASH, ConfigError, LoadError, TransportAbortError, ExtractionInvalidError } from "../../../scripts/calibration/prototype/pipeline";
import { buildDocument } from "../../../scripts/calibration/prototype/document";

describe("pipeline", () => {
  it("family guard same-family/unknown before any call", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    let calls = 0;
    const transport: any = async () => { calls++; return { ok: true, value: { content: "{}", finish_reason: "stop", http_status: 200, request_id: null, usage: null, duration_ms: 1 } }; };
    await expect(runPrototype({ docIds: ["CA-001"], extractor: "opencode-go/beam-free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => buildDocument(["hello world foo bar"], "0".repeat(64)) })).rejects.toBeInstanceOf(ConfigError);
    // unknown id
    await expect(runPrototype({ docIds: ["CA-001"], extractor: "nope", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport })).rejects.toBeInstanceOf(ConfigError);
    expect(calls).toBe(0);
    await rm(dir, { recursive: true });
  });

  it("sha mismatch => no call", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    let calls = 0;
    const transport: any = async () => { calls++; return { ok: true, value: { content: "{}", finish_reason: "stop", http_status: 200, request_id: null, usage: null, duration_ms: 1 } }; };
    const doc = buildDocument(["hello world foo bar"], "f".repeat(64)); // mismatched sha
    await expect(runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc })).rejects.toBeInstanceOf(LoadError);
    expect(calls).toBe(0);
    await rm(dir, { recursive: true });
  });

  it("finish_reason length => extraction_invalid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const doc = buildDocument(["hello world foo bar baz qux"], "0".repeat(64));
    // fix sha to match registry? registry CA-001 sha is 0af... not all zeros. Override loadDocument and bypass sha? pipeline checks sha. Use a reg with matching sha by using CA-001 but doc sha must equal. Set doc.doc_sha256 to registry sha.
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r1", usage: null, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: '{"scheme_description":null,"findings":[]}', finish_reason: "length", http_status: 200, request_id: "r2", usage: null, duration_ms: 1 } };
      return { ok: true, value: { content: '{"verified":true,"reason":"ok"}', finish_reason: "stop", http_status: 200, request_id: "r3", usage: null, duration_ms: 1 } };
    };
    const res = await runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc });
    expect(res.exitCode).toBe(4);
    await rm(dir, { recursive: true });
  });

  it("verifier 429 after deterministic pass => transport abort", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const doc = buildDocument(["hello world foo bar baz qux"], "0".repeat(64));
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r", usage: null, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: '{"scheme_description":null,"findings":[{"category":null,"location":null,"road_users":[],"description":"d","span":{"quote":"hello world foo","page":1},"taxonomy_gap":true}]}', finish_reason: "stop", http_status: 200, request_id: "r2", usage: null, duration_ms: 1 } };
      return { ok: false, failure: { kind: "transport", status: 429, reason: "rate_limited", detail: "429", http_status: 429 } };
    };
    await expect(runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc })).rejects.toBeInstanceOf(TransportAbortError);
    const rec = JSON.parse(await readFile(join(dir, "extractions/canada/FEASIBILITY_CONCEPT/CA-001.json"), "utf8"));
    expect(rec.status).toBe("model_unavailable");
    expect(rec.error.stage).toBe("verifier");
    expect(rec.error.http_status).toBe(429);
    await rm(dir, { recursive: true });
  });

  it("scheme missing/invalid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const doc = buildDocument(["hello world foo bar baz qux"], "0".repeat(64));
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r", usage: null, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: '{"scheme_description":null,"findings":[]}', finish_reason: "stop", http_status: 200, request_id: "r2", usage: null, duration_ms: 1 } };
      return { ok: true, value: { content: '{"verified":true,"reason":"ok"}', finish_reason: "stop", http_status: 200, request_id: "r3", usage: null, duration_ms: 1 } };
    };
    const res = await runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc });
    expect(res.summary.docs[0].counts.scheme.raw).toBe(0);
    await rm(dir, { recursive: true });
  });

  it("preflight failure aborts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const doc = buildDocument(["hello world foo bar"], "0".repeat(64));
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: false, failure: { kind: "transport", status: 500, reason: "server_error", detail: "500", http_status: 500 } };
      return { ok: true, value: { content: "{}", finish_reason: "stop", http_status: 200, request_id: "r", usage: null, duration_ms: 1 } };
    };
    await expect(runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc })).rejects.toBeInstanceOf(TransportAbortError);
    await rm(dir, { recursive: true });
  });

  it("dry-run no keys/no calls", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    let calls = 0;
    const transport: any = async () => { calls++; return { ok: true, value: { content: "{}", finish_reason: "stop", http_status: 200, request_id: null, usage: null, duration_ms: 1 } }; };
    // dry-run should not require keys; pass empty keys
    const res = await runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: true, keys: {} }, { transport, loadDocument: async () => buildDocument(["hello world foo bar"], "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95") });
    expect(calls).toBe(0);
    expect(res.summary.run.status).toBe("dry_run");
    await rm(dir, { recursive: true });
  });

  it("summary docs/cells/totals and CA-010 absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const doc = buildDocument(["hello world foo bar baz qux"], "0".repeat(64));
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r", usage: null, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: '{"scheme_description":null,"findings":[]}', finish_reason: "stop", http_status: 200, request_id: "r2", usage: null, duration_ms: 1 } };
      return { ok: true, value: { content: '{"verified":true,"reason":"ok"}', finish_reason: "stop", http_status: 200, request_id: "r3", usage: null, duration_ms: 1 } };
    };
    const res = await runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc });
    expect(res.summary.docs.length).toBe(1);
    expect(res.summary.cells.length).toBeGreaterThanOrEqual(1);
    expect(res.summary.totals.docs_requested).toBe(1);
    const _json = JSON.stringify(res.summary);
    expect(res.summary.docs.map((d:any)=>d.doc_id)).not.toContain("CA-010");
    expect(res.summary.totals.rates).toBeNull(); // zero findings gives a null denominator
    await rm(dir, { recursive: true });
  });

  it("partial totals null when one requested doc is incomplete", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const small = buildDocument(["hello world foo bar baz qux"], "0".repeat(64));
    (small as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const big = buildDocument(["x".repeat(300001)], "0".repeat(64));
    (big as any).doc_sha256 = "bb9850fe4780789ffe20b17c0a3d3182906b3e4010942d768abab4e920af343d";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r0", usage: null, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: '{"scheme_description":null,"findings":[]}', finish_reason: "stop", http_status: 200, request_id: "r1", usage: null, duration_ms: 1 } };
      return { ok: true, value: { content: '{"verified":true,"reason":"ok"}', finish_reason: "stop", http_status: 200, request_id: "r2", usage: null, duration_ms: 1 } };
    };
    const res = await runPrototype({ docIds: ["CA-001", "CA-002"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async (p: string) => (p.includes("neahd") ? small : big) });
    expect(res.summary.docs.length).toBe(2);
    expect(res.summary.docs.find((d: any) => d.doc_id === "CA-002").status).toBe("doc_too_large");
    expect(res.summary.totals.docs_complete).toBe(1);
    expect(res.summary.totals.rates).toBeNull();
    expect(res.summary.cells.every((c: any) => c.rates === null)).toBe(true);
    expect(classifyExit(new ConfigError("x"))).toBe(1);
    expect(classifyExit(new LoadError("x"))).toBe(2);
    expect(classifyExit(new TransportAbortError("x"))).toBe(3);
    expect(classifyExit(new ExtractionInvalidError("x"))).toBe(4);
    await rm(dir, { recursive: true });
  });

  it("record keys and no report text", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const doc = buildDocument(["hello world foo bar baz qux"], "0".repeat(64));
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r", usage: null, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: '{"scheme_description":null,"findings":[]}', finish_reason: "stop", http_status: 200, request_id: "r2", usage: null, duration_ms: 1 } };
      return { ok: true, value: { content: '{"verified":true,"reason":"ok"}', finish_reason: "stop", http_status: 200, request_id: "r3", usage: null, duration_ms: 1 } };
    };
    const res = await runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc });
    const recPath = res.records[0].path!;
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(recPath, "utf8");
    expect(raw).not.toContain(doc.normalized_text);
    await rm(dir, { recursive: true });
  });


  it("complete record exposes counts/rates/calls/preflight and no report text", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const text = "The interchange spacing appears to be rather close. The drawings do not indicate pedestrian facilities at the ramp.";
    const doc = buildDocument([text], "0".repeat(64));
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r0", usage: { total_tokens: 1 }, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: JSON.stringify({ scheme_description: { text: "A close-spacing scheme.", span: { quote: "The interchange spacing appears to be rather close", page: 1 } }, findings: [
        { category: "junctions_interchanges", location: null, road_users: ["drivers"], description: "Close interchange spacing causes weaving.", span: { quote: "The interchange spacing appears to be rather close", page: 1 }, taxonomy_gap: false },
        { category: null, location: null, road_users: [], description: "No pedestrian facilities are shown.", span: { quote: "The drawings do not indicate pedestrian facilities", page: 1 }, taxonomy_gap: true },
      ] }), finish_reason: "stop", http_status: 200, request_id: "r1", usage: { total_tokens: 10 }, duration_ms: 1 } };
      return { ok: true, value: { content: JSON.stringify({ verified: true, reason: "supported" }), finish_reason: "stop", http_status: 200, request_id: "r2", usage: { total_tokens: 5 }, duration_ms: 1 } };
    };
    const res = await runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc });
    expect(res.exitCode).toBe(0);
    const rec = JSON.parse(await readFile(res.records[0].path!, "utf8"));
    expect(rec.counts.raw).toBe(2);
    expect(rec.counts.deterministic_passed).toBe(2);
    expect(rec.counts.verified).toBe(2);
    expect(rec.counts.established).toBe(2);
    expect(rec.counts.discarded).toBe(0);
    expect(rec.counts.scheme.established).toBe(1);
    expect(rec.rates.pass).toBe(1);
    expect(rec.rates.verify).toBe(1);
    expect(rec.scheme_description).not.toBeNull();
    expect(rec.findings.length).toBe(2);
    expect(rec.calls.filter((c: any) => c.stage === "preflight").length).toBe(2);
    expect(rec.calls.filter((c: any) => c.stage === "extractor").length).toBe(1);
    expect(rec.calls.filter((c: any) => c.stage === "verifier").length).toBe(3);
    expect(rec.preflight.length).toBe(2);
    expect(JSON.stringify(rec)).not.toContain(text);
    expect(res.summary.totals.raw).toBe(2);
    expect(res.summary.totals.rates.pass).toBe(1);
    expect(res.summary.docs.map((d: any) => d.doc_id)).not.toContain("CA-010");
    await rm(dir, { recursive: true });
  });

  it("invalid JSON failure payload is capped and hashed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "p-"));
    const doc = buildDocument(["hello world foo bar baz qux"], "0".repeat(64));
    (doc as any).doc_sha256 = "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95";
    const raw = "x".repeat(10000);
    const transport: any = async (o: any) => {
      if (o.max_tokens === 8) return { ok: true, value: { content: "OK", finish_reason: "stop", http_status: 200, request_id: "r0", usage: null, duration_ms: 1 } };
      if (o.max_tokens === 32768) return { ok: true, value: { content: raw, finish_reason: "stop", http_status: 200, request_id: "r1", usage: null, duration_ms: 1 } };
      return { ok: true, value: { content: "{}", finish_reason: "stop", http_status: 200, request_id: "r2", usage: null, duration_ms: 1 } };
    };
    const res = await runPrototype({ docIds: ["CA-001"], extractor: "nvidia/nemotron-3.5-super-vl:free", verifier: "opencode-go/beam-free", out: dir, dryRun: false, keys: { openrouter: "k", go: "k" } }, { transport, loadDocument: async () => doc });
    expect(res.exitCode).toBe(4);
    const rec = JSON.parse(await readFile(res.records[0].path!, "utf8"));
    expect(rec.status).toBe("extraction_invalid");
    expect(rec.failures[0].raw_item_excerpt.length).toBeLessThanOrEqual(500);
    expect(rec.failures[0].raw_item_sha256).toHaveLength(64);
    await rm(dir, { recursive: true });
  });

  it("prompt hash stability and committed run hashes", async () => {
    const a = promptHash("extraction prompt");
    expect(a).toHaveLength(64);
    expect(promptHash("extraction prompt")).toBe(a);
    expect(promptHash("extraction prompt 2")).not.toBe(a);
    const rec = JSON.parse(await readFile("state/calibration/extractions/canada/FEASIBILITY_CONCEPT/CA-001.json", "utf8"));
    expect(EXTRACT_HASH).toBe(rec.prompt_hash);
    expect(VERIFY_HASH).toBe(rec.verifier_prompt_hash);
  });
});

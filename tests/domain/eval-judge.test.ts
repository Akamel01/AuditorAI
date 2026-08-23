// Phase-4 gates: judge transport and prior-run lookup extracted from the E4
// harness are unit-testable with injected fakes (fetch, scorecards dir).
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { judgeComplete, findPriorRunMean } from "../../scripts/run-eval";

const API_KEY = "sk-judge";

function fakeFetch(payloads: { status?: number; body?: string }[], calls: string[] = []) {
  let i = 0;
  return (async (url: string | URL | Request) => {
    calls.push(String(url));
    const p = payloads[Math.min(i, payloads.length - 1)];
    i += 1;
    const status = p.status ?? 200;
    if (status >= 400) return new Response(p.body ?? "", { status });
    return new Response(
      p.body ?? JSON.stringify({ choices: [{ message: { content: "{\"finding_id\":\"f1\"}" } }] }),
      { status },
    );
  }) as typeof fetch;
}

describe("judgeComplete", () => {
  it("posts the rubric request to the zen gateway and returns message content", async () => {
    const calls: string[] = [];
    let capturedBody: Record<string, unknown> | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: "VERDICT" } }] }), {
        status: 200,
      });
    }) as typeof fetch;

    const out = await judgeComplete([{ role: "system", content: "sys" }], API_KEY, fetchImpl);

    expect(out).toBe("VERDICT");
    expect(calls).toEqual(["https://opencode.ai/zen/v1/chat/completions"]);
    expect(capturedBody!.model).toBe("x-preview-f-free");
    expect(capturedBody!.reasoning_effort).toBe("max");
  });

  it("throws on non-ok gateway responses", async () => {
    const fetchImpl = fakeFetch([{ status: 503 }]);
    await expect(judgeComplete([], API_KEY, fetchImpl)).rejects.toThrow("judge HTTP 503");
  });

  it("throws when the response carries no message content", async () => {
    const fetchImpl = fakeFetch([{ body: JSON.stringify({ choices: [] }) }]);
    await expect(judgeComplete([], API_KEY, fetchImpl)).rejects.toThrow("missing content");
  });
});

describe("findPriorRunMean", () => {
  it("reads the mean score from the most recent run containing the fixture", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "eval-scorecards-"));
    try {
      mkdirSync(path.join(dir, "run-a"), { recursive: true });
      mkdirSync(path.join(dir, "run-b"), { recursive: true });
      writeFileSync(
        path.join(dir, "run-a", "gf6.json"),
        JSON.stringify({ mean_score: 7.5 }),
      );
      writeFileSync(
        path.join(dir, "run-b", "gf6.json"),
        JSON.stringify({ mean_score: 8.25 }),
      );

      expect(findPriorRunMean("gf6", dir)).toBe(8.25);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to older runs and skips unparsable scorecards", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "eval-scorecards-"));
    try {
      mkdirSync(path.join(dir, "run-a"), { recursive: true });
      mkdirSync(path.join(dir, "run-b"), { recursive: true });
      writeFileSync(path.join(dir, "run-a", "gf9.json"), JSON.stringify({ mean_score: 6 }));
      writeFileSync(path.join(dir, "run-b", "gf9.json"), "{not json");

      expect(findPriorRunMean("gf9", dir)).toBe(6);
      expect(findPriorRunMean("gf404", dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when no scorecards directory exists", () => {
    expect(findPriorRunMean("gf1", path.join(os.tmpdir(), "no-such-dir-eval"))).toBeNull();
  });
});

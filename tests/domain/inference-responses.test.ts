// H7: Responses-API transport contract (mocked fetch, no network).
import { describe, expect, it, vi } from "vitest";
import { responsesComplete, type ChatMessage } from "@/lib/inference";

const EP = { baseUrl: "https://opencode.ai/zen/v1", apiKey: "k" };
const MSGS: ChatMessage[] = [
  { role: "system", content: "SYS" },
  { role: "user", content: "U1" },
];

function okFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function msgResp(text: string) {
  return {
    output: [
      { type: "reasoning", status: "completed" },
      { type: "message", status: "completed", content: [{ type: "output_text", text }] },
    ],
  };
}

describe("responsesComplete", () => {
  it("posts to /responses with session header, maps max effort to high, returns text", async () => {
    const fetchImpl = okFetch(msgResp("VERDICT"));
    const out = await responsesComplete(
      { endpoint: EP, model: "muse-spark-1.3-contributor-free", effort: "max", fetchImpl },
      MSGS,
    );
    expect(out).toBe("VERDICT");
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://opencode.ai/zen/v1/responses");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("muse-spark-1.3-contributor-free");
    expect(body.reasoning).toEqual({ effort: "high" });
    expect(body.stream).toBe(false);
    expect((init.headers as Record<string, string>)["x-opencode-session"]).toBe("auditorai-eval-judge");
  });

  it("maps low effort to minimal and splits system into instructions", async () => {
    const fetchImpl = okFetch(msgResp("OK"));
    await responsesComplete(
      { endpoint: EP, model: "m", effort: "low", fetchImpl },
      MSGS,
    );
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.reasoning).toEqual({ effort: "minimal" });
    expect(body.instructions).toBe("SYS");
    expect(body.input).toContain("user: U1");
  });

  it("throws on 429 and on missing message text", async () => {
    await expect(
      responsesComplete(
        { endpoint: EP, model: "m", effort: "low", fetchImpl: okFetch({}, 429) },
        [{ role: "user", content: "Q" }],
      ),
    ).rejects.toThrow("429");
    await expect(
      responsesComplete(
        { endpoint: EP, model: "m", effort: "low", fetchImpl: okFetch({ output: [] }) },
        [{ role: "user", content: "Q" }],
      ),
    ).rejects.toThrow("missing output message text");
  });
});

export interface ModelResult {
  content: string;
  reasoning_content: string | null;
/* eslint-disable @typescript-eslint/no-explicit-any */
  finish_reason: string | null;
  http_status: number;
  request_id: string | null;
  usage: unknown;
  duration_ms: number;
}

export interface ModelTransportFailure {
  kind: "transport";
  status: number | null;
  reason: string;
  detail: string;
  http_status?: number;
}

export type ModelCallOutcome =
  | { ok: true; value: ModelResult }
  | { ok: false; failure: ModelTransportFailure };

export interface ModelSpec {
  id: string;
  family: string;
  provider: string;
  base_url: string;
  api_model: string;
}

export const MODEL_TABLE: Record<string, ModelSpec> = {
  "nvidia/nemotron-3.5-super-vl:free": {
    id: "nvidia/nemotron-3.5-super-vl:free",
    family: "nemotron",
    provider: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    api_model: "nvidia/nemotron-3.5-super-vl:free",
  },
  "opencode-go/beam-free": {
    id: "opencode-go/beam-free",
    family: "beam",
    provider: "opencode-go",
    base_url: "https://opencode.ai/inference/go/v1",
    api_model: "beam-free",
  },
  "google/gemma-4-31b-it:free": {
    id: "google/gemma-4-31b-it:free",
    family: "gemma",
    provider: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    api_model: "google/gemma-4-31b-it:free",
  },
};

export function assertFamilyDisjoint(extractor: string, verifier: string): void {
  const e = MODEL_TABLE[extractor];
  const v = MODEL_TABLE[verifier];
  if (!e || !v) throw new Error("config: unknown model id");
  if (e.family === v.family) throw new Error("config: same family");
}

export function resolveBaseUrl(spec: ModelSpec, override?: string): string {
  if (override) return override;
  return spec.base_url;
}

export async function chatCompletion(opts: {
  spec: ModelSpec;
  base_url: string;
  apiKey: string;
  messages: { role: string; content: string }[];
  max_tokens: number;
  runId?: string;
  timeout_ms?: number;
}): Promise<ModelCallOutcome> {
  const url = `${opts.base_url.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    "Content-Type": "application/json",
  };
  if (opts.spec.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/Akamel01/AuditorAI";
    headers["X-Title"] = "AuditorAI calibration #95";
  } else {
    headers["x-opencode-session"] = `auditorai-calibration-95-${opts.runId ?? "run"}`;
  }
  const body = {
    model: opts.spec.api_model,
    messages: opts.messages,
    temperature: 0,
    top_p: 1,
    seed: 42,
    max_tokens: opts.max_tokens,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout_ms ?? 120000);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const duration_ms = Date.now() - start;
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, failure: { kind: "transport", status: res.status, reason: "bad_response", detail: `HTTP ${res.status} non-JSON`, http_status: res.status } };
    }
    if (!res.ok) {
      const reason = res.status === 429 ? "rate_limited" : res.status >= 500 ? "server_error" : "bad_response";
      return { ok: false, failure: { kind: "transport", status: res.status, reason, detail: `HTTP ${res.status}`, http_status: res.status } };
    }
    const choice = json?.choices?.[0];
    const content = choice?.message?.content ?? "";
    const reasoning = choice?.message?.reasoning_content ?? null;
    const finish_reason = choice?.finish_reason ?? null;
    return {
      ok: true,
      value: {
        content: String(content),
        reasoning_content: reasoning === null ? null : String(reasoning),
        finish_reason: finish_reason ? String(finish_reason) : null,
        http_status: res.status,
        request_id: (res.headers.get("x-request-id") ?? json?.id ?? null) as string | null,
        usage: json?.usage ?? null,
        duration_ms: duration_ms,
      },
    };
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError";
    return {
      ok: false,
      failure: {
        kind: "transport",
        status: null,
        reason: isTimeout ? "timeout" : "network",
        detail: String(e?.message ?? e),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

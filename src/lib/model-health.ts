// Cheap 5-minute-cached probe of the configured auditor default model.
// Only HTTP 400 whose body contains "Model is unavailable" flips providers:false.
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "@/lib/model-config";
import { setProviderDegraded } from "@/discovery/health-state";
import { log } from "@/lib/logger";

export type ModelHealth = "reachable" | "unavailable" | "unknown";

const PROVIDER_ID = "ai-default";
const TTL_MS = 300_000;
const PROBE_TIMEOUT_MS = 5_000;

let cached: { value: ModelHealth; expiresAt: number } | null = null;

export function resetDefaultModelReachabilityCache(): void {
  cached = null;
}

export async function checkDefaultModelHealth(opts?: {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}): Promise<ModelHealth> {
  const nowFn = opts?.now ?? Date.now;
  const timeoutMs = opts?.timeoutMs ?? PROBE_TIMEOUT_MS;

  // Gate: disabled or no key -> unknown, clear only our flag + cache, no fetch.
  if (process.env.AI_ENABLED !== "true" || !process.env.OPENCODE_API_KEY) {
    cached = null;
    setProviderDegraded(PROVIDER_ID, false);
    return "unknown";
  }

  // Cache hit: re-apply the flag, no fetch.
  if (cached && nowFn() < cached.expiresAt) {
    const v = cached.value;
    if (v === "unavailable") setProviderDegraded(PROVIDER_ID, true);
    else if (v === "reachable") setProviderDegraded(PROVIDER_ID, false);
    return v;
  }

  const fetcher = opts?.fetchImpl ?? fetch;
  const baseUrl = process.env.AI_BASE_URL ?? DEFAULT_BASE_URL;
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;
  const key = process.env.OPENCODE_API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let status: number | null = null;
  let result: ModelHealth = "unknown";
  try {
    const res = await fetcher(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    status = res.status;
    if (res.ok) {
      result = "reachable";
      setProviderDegraded(PROVIDER_ID, false);
    } else if (res.status === 400) {
      try {
        const text = await res.text();
        if (text.includes("Model is unavailable")) {
          result = "unavailable";
          setProviderDegraded(PROVIDER_ID, true);
        } else {
          result = "unknown";
        }
      } catch {
        result = "unknown";
      }
    } else {
      result = "unknown";
    }
  } catch {
    result = "unknown";
    status = null;
  } finally {
    clearTimeout(timer);
  }

  cached = { value: result, expiresAt: nowFn() + TTL_MS };
  log(result === "reachable" ? "info" : "warn", "default model health probe", {
    model,
    status,
    result,
  });
  return result;
}

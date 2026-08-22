// Lightweight rate limiting for API requests (§35).
// - KV-backed fixed window when KV env vars exist (atomic INCR + EXPIRE; correct
//   across serverless instances)
// - In-memory fallback for dev/tests (per-instance only — documented caveat)
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 120;

const memoryCounters = new Map<string, { count: number; windowStart: number }>();

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvIncrement(key: string): Promise<number | null> {
  try {
    // Upstash REST accepts ONE flat command per request; pipeline-form bodies
    // ([[..],[..]]) are rejected as a malformed single command (found via the
    // M1 storage probes, issue #6) — which silently disabled KV-mode limiting.
    const incr = await fetch(process.env.KV_REST_API_URL as string, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["INCR", key]),
      cache: "no-store",
    });
    if (!incr.ok) return null;
    const incrJson = (await incr.json()) as { result?: number };
    if (typeof incrJson.result !== "number") return null;
    if (incrJson.result === 1) {
      await fetch(process.env.KV_REST_API_URL as string, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EXPIRE", key, WINDOW_SECONDS]),
        cache: "no-store",
      });
    }
    return incrJson.result;
  } catch {
    return null; // fail-open rather than block auditors on infra hiccups
  }
}

export async function checkRateLimit(
  identity: string,
  max = MAX_REQUESTS,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % WINDOW_SECONDS);

  if (kvConfigured()) {
    const count = await kvIncrement(`ratelimit:${identity}:${windowStart}`);
    if (count !== null && count > max) {
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }
    return { allowed: true };
  }

  // In-memory fallback (dev/tests only; per-instance on serverless).
  const entry = memoryCounters.get(identity);
  if (!entry || entry.windowStart !== windowStart) {
    memoryCounters.set(identity, { count: 1, windowStart });
    return { allowed: true };
  }
  entry.count += 1;
  if (entry.count > max) return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
  return { allowed: true };
}

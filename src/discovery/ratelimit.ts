// Politeness runtime shared by all providers: 1 request/second per host,
// max 2 concurrent per host (owner decision 2026-08-25). Respects Retry-After
// on 429 by sleeping; never bypasses robots.txt decisions made by callers.
const MIN_INTERVAL_MS = 1000;
const MAX_CONCURRENT_PER_HOST = 2;

interface HostBudget {
  lastAt: number;
  inflight: number;
  queue: (() => void)[];
}

const budgets = new Map<string, HostBudget>();

function budgetFor(host: string): HostBudget {
  let b = budgets.get(host);
  if (!b) {
    b = { lastAt: 0, inflight: 0, queue: [] };
    budgets.set(host, b);
  }
  return b;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Runs `fn` under the host budget: at most one start per second and two
 * concurrent requests per host. Accepts either a full URL or a bare hostname.
 */
export function hostOf(urlOrHost: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(urlOrHost) ? new URL(urlOrHost).host : urlOrHost;
}

export async function withHostBudget<T>(urlOrHost: string, fn: () => Promise<T>): Promise<T> {
  const host = hostOf(urlOrHost);
  const b = budgetFor(host);

  while (b.inflight >= MAX_CONCURRENT_PER_HOST) {
    await new Promise<void>((resolve) => b.queue.push(resolve));
  }
  b.inflight += 1;
  try {
    const wait = Math.max(0, b.lastAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    b.lastAt = Date.now();
    return await fn();
  } finally {
    b.inflight -= 1;
    const next = b.queue.shift();
    if (next) next();
  }
}

export function retryAfterMs(headers: Headers): number | null {
  const ra = headers.get("retry-after");
  if (!ra) return null;
  const secs = Number(ra);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(ra);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** Test hook: clear all budgets. */
export function resetHostBudgets(): void {
  budgets.clear();
}

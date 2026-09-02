// Lightweight in-memory health state for discovery providers
// This is intentionally simple and zero-p-dependency; used by the
// execution plan to observe degradation without changing API.

type DegradedMap = Map<string, boolean>;
type CounterMap = Map<string, number>;

const degradedFlags: DegradedMap = new Map();
const zeroHitCounters: CounterMap = new Map();

export function setProviderDegraded(providerId: string, degraded: boolean) {
  degradedFlags.set(providerId, degraded);
}

export function isProviderDegraded(providerId: string): boolean {
  return degradedFlags.get(providerId) ?? false;
}

export function isAnyProviderDegraded(): boolean {
  for (const v of degradedFlags.values()) if (v) return true;
  return false;
}

export function recordZeroHitOutcome(providerId: string, zeroHit: boolean) {
  if (zeroHit) {
    const c = (zeroHitCounters.get(providerId) ?? 0) + 1;
    zeroHitCounters.set(providerId, c);
    if (c >= 2) {
      setProviderDegraded(providerId, true);
    }
  } else {
    zeroHitCounters.set(providerId, 0);
  }
}

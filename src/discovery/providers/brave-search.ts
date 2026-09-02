// Brave Search adapter — replacement for the retired Bing Search API v7
// (Microsoft decommissioned it 2025-08-11; endpoints return HTTP 410 and new
// signups are closed). Same DiscoveryProvider seam, same allowlist discipline,
// same polite host budget. OFF without a key (env or Keychain).
import { hitId } from "@/discovery/ids";
import { withHostBudget, retryAfterMs } from "@/discovery/ratelimit";
import { DISCOVERY_SECRETS, resolveSecret } from "@/discovery/keychain";
import type { DiscoveryHit } from "@/discovery/types";
import type { JurisdictionId } from "@/domain/types";
import {
  providerEnabled,
  registerProvider,
  type DiscoverQuery,
  type DiscoveryProvider,
  type FetchResult,
} from "./provider-types";
import { setProviderDegraded } from "@/discovery/health-state";

const JUR_SITE_FILTER: Record<JurisdictionId, string[]> = {
  UK: ["site:standardsforhighways.co.uk", "site:national-infrastructure-consenting.planningregistry.co.uk", "site:gov.uk"],
  US: ["site:dot.gov", "site:rosap.ntl.bts.gov", "site:dot.state.mn.us"],
  CA: ["site:open.alberta.ca", "site:gov.bc.ca", "site:ontario.ca"],
  AE: ["site:qcc.abudhabi.ae", "site:dmt.gov.ae"],
  INT: ["site:carecprogram.org", "site:pleanala.ie", "site:piarc.org"],
};

interface BraveWebResult {
  url?: string;
  title?: string;
}

class BraveSearchProvider implements DiscoveryProvider {
  readonly id = "brave-search";
  readonly source_type = "search-engine" as const;

  async discover(query: DiscoverQuery): Promise<DiscoveryHit[]> {
    const token = resolveSecret(DISCOVERY_SECRETS.brave);
    if (!token) throw new Error("brave-search requires DISCOVERY_BRAVE_API_KEY (or Keychain auditorai/discovery-brave)");
    const themes = query.themes.length ? query.themes : ['"road safety audit"'];
    const hits: DiscoveryHit[] = [];
    let lastError: string | null = null;
    for (const jur of query.jurisdictions) {
      for (const theme of themes) {
        const siteFilters = JUR_SITE_FILTER[jur].map((s) => `${s}`).join(" OR ");
        const q = encodeURIComponent(`${theme} (${siteFilters})`);
        const res = await withHostBudget("api.search.brave.com", () =>
          fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=${Math.min(query.limit ?? 10, 20)}&result_filter=web`, {
            headers: {
              "X-Subscription-Token": token,
              Accept: "application/json",
            },
          }),
        );
        if (res.status === 429) {
          const wait = retryAfterMs(res.headers);
          if (wait) await new Promise((r) => setTimeout(r, Math.min(wait, 60_000)));
          continue;
        }
        if (!res.ok) {
          lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
          // 402 = quota exceeded — don't loop forever, treat as terminal for this jur/theme
          if (res.status === 402) continue;
          continue;
        }
        const json = (await res.json()) as { web?: { results?: BraveWebResult[] } };
        const now = new Date().toISOString();
        for (const item of json.web?.results ?? []) {
          if (!item.url) continue;
          hits.push({
            hit_id: hitId(this.id, item.url),
            url: item.url,
            source_type: this.source_type,
            provider_id: this.id,
            portal_id: null,
            discovered_at: now,
            licence_hint: "unknown",
            http_status: res.status,
            sha256_hint: null,
            title_hint: item.title ?? null,
            jurisdiction_guess: jur,
          });
        }
      }
    }
    // Update health state based on discovery outcome (persisted across runs via health-state module)
    // Import and use a lightweight counter to detect two consecutive zero-hits across runs.
    // We only degrade after two consecutive zero-hit runs for the same provider.
    // Degradation decision is handled in health-state.ts.
    const { recordZeroHitOutcome } = await import("@/discovery/health-state");
    recordZeroHitOutcome(this.id, hits.length === 0);
    if (hits.length === 0 && lastError) {
      // Quota exceeded (402) is terminal but non-fatal — return empty so pipeline can continue with seeds
      if (lastError.includes("402") || lastError.includes("USAGE_LIMIT_EXCEEDED")) {
        // Propagate a lightweight warning in logs for observability
        console.warn(`[brave-search] quota reached: ${lastError}`);
        // Still mark degraded to help monitoring (best-effort per task contract)
        setProviderDegraded(this.id, true);
        return hits;
      }
      throw new Error(`brave-search discovered nothing: ${lastError}`);
    }
    return hits;
  }

  async fetch(url: string): Promise<FetchResult> {
    return withHostBudget(url, async () => {
      const res = await fetch(url);
      return { bytes: new Uint8Array(await res.arrayBuffer()), status: res.status, headers: res.headers };
    });
  }
}

if (providerEnabled("brave-search")) {
  registerProvider("brave-search", () => new BraveSearchProvider());
}

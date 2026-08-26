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
    const hits: DiscoveryHit[] = [];
    for (const jur of query.jurisdictions) {
      const siteFilters = JUR_SITE_FILTER[jur].map((s) => `${s}`).join(" OR ");
      const q = encodeURIComponent(`"road safety audit" (${siteFilters})`);
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
      if (!res.ok) continue;
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

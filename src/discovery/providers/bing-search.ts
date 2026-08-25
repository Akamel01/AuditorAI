// Bing Web Search adapter (owner decision 2026-08-25: enabled alongside CSE).
// OFF without DISCOVERY_BING_API_KEY. Queries are allowlist-filtered to
// government/portal domains post-hoc so provenance stays auditable.
import { hitId } from "@/discovery/ids";
import { withHostBudget, retryAfterMs } from "@/discovery/ratelimit";
import type { DiscoveryHit, JurisdictionId } from "@/discovery/types";
import {
  providerEnabled,
  registerProvider,
  type DiscoverQuery,
  type DiscoveryProvider,
  type FetchResult,
} from "./provider-types";

const JUR_SITE_FILTER: Record<JurisdictionId, string[]> = {
  UK: ["site:standardsforhighways.co.uk", "site:national-infrastructure-consenting.planningregistry.co.uk", "site:gov.uk"],
  US: ["site:dot.gov", "site:rosap.ntl.bts.gov", "site:state.mn.us"],
  CA: ["site:open.alberta.ca", "site:gov.bc.ca", "site:ontario.ca"],
  AE: ["site:qcc.abudhabi.ae", "site:dmt.gov.ae"],
  INT: ["site:carecprogram.org", "site:pleanala.ie", "site:piarc.org"],
};

interface BingWebPage {
  url: string;
  name?: string;
}

class BingSearchProvider implements DiscoveryProvider {
  readonly id = "bing-search";
  readonly source_type = "search-engine" as const;

  async discover(query: DiscoverQuery, fetchImpl: typeof fetch = fetch): Promise<DiscoveryHit[]> {
    const key = process.env.DISCOVERY_BING_API_KEY;
    if (!key) throw new Error("bing-search requires DISCOVERY_BING_API_KEY");
    const hits: DiscoveryHit[] = [];
    for (const jur of query.jurisdictions) {
      const siteFilters = JUR_SITE_FILTER[jur].join(" OR ");
      const q = encodeURIComponent(`"road safety audit" ${siteFilters}`);
      const res = await withHostBudget("api.bing.microsoft.com", () =>
        fetchImpl(`https://api.bing.microsoft.com/v7.0/search?q=${q}&count=${query.limit ?? 20}`, {
          headers: { "Ocp-Apim-Subscription-Key": key },
        }),
      );
      if (res.status === 429) {
        const wait = retryAfterMs(res.headers);
        if (wait) await new Promise((r) => setTimeout(r, Math.min(wait, 60_000)));
      }
      if (!res.ok) continue;
      const json = (await res.json()) as { webPages?: { value?: BingWebPage[] } };
      const now = new Date().toISOString();
      for (const page of json.webPages?.value ?? []) {
        hits.push({
          hit_id: hitId(this.id, page.url),
          url: page.url,
          source_type: this.source_type,
          provider_id: this.id,
          portal_id: null,
          discovered_at: now,
          licence_hint: "unknown",
          http_status: res.status,
          sha256_hint: null,
          title_hint: page.name ?? null,
          jurisdiction_guess: jur,
        });
      }
    }
    return hits;
  }

  async fetch(url: string, fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
    return withHostBudget(new URL(url).host, async () => {
      const res = await fetchImpl(url);
      return { bytes: new Uint8Array(await res.arrayBuffer()), status: res.status, headers: res.headers };
    });
  }
}

if (providerEnabled("bing-search")) {
  registerProvider("bing-search", () => new BingSearchProvider());
}

// Google Programmable Search (CSE) adapter (owner decision 2026-08-25).
// OFF without DISCOVERY_GOOGLE_CSE_KEY + DISCOVERY_GOOGLE_CSE_CX.
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

// Site-restricted engines (post-2026-01 PSE policy) already bound results to
// docs/discovery/pse-domains.txt — adding site: operators here would exclude
// listed non-gov.TLD domains (e.g. standardsforhighways.co.uk vs site:gov.uk).
const JUR_LABEL: Record<JurisdictionId, string> = {
  UK: '(UK OR Britain OR "Highways England" OR "National Highways")',
  US: '(US OR "United States" OR state DOT)',
  CA: '(Canada OR Alberta OR Ontario OR "British Columbia")',
  AE: '("Abu Dhabi" OR UAE)',
  INT: "",
};

interface CseItem {
  link?: string;
  title?: string;
}

class GoogleCseProvider implements DiscoveryProvider {
  readonly id = "google-cse";
  readonly source_type = "search-engine" as const;

  async discover(query: DiscoverQuery, fetchImpl: typeof fetch = fetch): Promise<DiscoveryHit[]> {
    const key = resolveSecret(DISCOVERY_SECRETS.googleCseKey);
    const cx = resolveSecret(DISCOVERY_SECRETS.googleCseCx);
    if (!key || !cx) throw new Error("google-cse requires DISCOVERY_GOOGLE_CSE_KEY/CX env or Keychain auditorai/discovery-cse-key + auditorai/discovery-cse-cx");
    const hits: DiscoveryHit[] = [];
    for (const theme of query.themes.length ? query.themes : ["road safety audit"]) {
      const jurScope = query.jurisdictions.length === 1 ? JUR_LABEL[query.jurisdictions[0]] : "";
      const q = encodeURIComponent(`${theme} ${jurScope}`.trim());
      const res = await withHostBudget("www.googleapis.com", () =>
        fetchImpl(
          `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${q}&num=${Math.min(query.limit ?? 10, 10)}${query.cursor ? `&start=${query.cursor}` : ""}`,
        ),
      );
      if (res.status === 429) {
        const wait = retryAfterMs(res.headers);
        if (wait) await new Promise((r) => setTimeout(r, Math.min(wait, 60_000)));
      }
      if (!res.ok) continue;
      const json = (await res.json()) as { items?: CseItem[] };
      const now = new Date().toISOString();
      for (const item of json.items ?? []) {
        if (!item.link) continue;
        hits.push({
          hit_id: hitId(this.id, item.link),
          url: item.link,
          source_type: this.source_type,
          provider_id: this.id,
          portal_id: null,
          discovered_at: now,
          licence_hint: "unknown",
          http_status: res.status,
          sha256_hint: null,
          title_hint: item.title ?? null,
          jurisdiction_guess: query.jurisdictions[0] ?? null,
        });
      }
    }
    return hits;
  }

  async fetch(url: string, fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
    return withHostBudget(url, async () => {
      const res = await fetchImpl(url);
      return { bytes: new Uint8Array(await res.arrayBuffer()), status: res.status, headers: res.headers };
    });
  }
}

if (providerEnabled("google-cse")) {
  registerProvider("google-cse", () => new GoogleCseProvider());
}

// AI harvesting provider — gpt-5-nano via opencode with web search
// Continuous stream alongside brave-search and seed-portals. Uses the same
// DiscoveryProvider seam, reuses AiAdapter/inference, and is gated by
// DISCOVERY_AI_ENABLED (off by default, like AI_ENABLED). Web search is via
// the model's browsing capability, not Brave API.
import { hitId } from "@/discovery/ids";
import { resolveSecret, DISCOVERY_SECRETS } from "@/discovery/keychain";
import { withHostBudget } from "@/discovery/ratelimit";
import type { DiscoveryHit } from "@/discovery/types";
import type { DiscoveryProvider, DiscoverQuery, FetchResult } from "./provider-types";
import { registerProvider } from "./provider-types";
import { chatComplete } from "@/lib/inference";

const AI_SECRETS = {
  opencode: { envVar: "OPENCODE_API_KEY", service: "auditorai/opencode" },
  aiEnabled: { envVar: "DISCOVERY_AI_ENABLED", service: "auditorai/discovery-ai" },
} as const;

function isEnabled(): boolean {
  const flag = resolveSecret(AI_SECRETS.aiEnabled);
  // flag must be "true" (case-insensitive) to enable; default off
  if (flag === null) return process.env.DISCOVERY_AI_ENABLED === "true";
  return flag.toLowerCase() === "true";
}

function hasKey(): boolean {
  return resolveSecret(AI_SECRETS.opencode) !== null || !!process.env.OPENCODE_API_KEY;
}

class AiSearchProvider implements DiscoveryProvider {
  readonly id = "ai-search";
  readonly source_type = "search-engine" as const;

  async discover(query: DiscoverQuery, fetchImpl?: typeof fetch): Promise<DiscoveryHit[]> {
    if (!isEnabled() || !hasKey()) return [];
    const apiKey = resolveSecret(AI_SECRETS.opencode) ?? process.env.OPENCODE_API_KEY!;
    const endpoint = process.env.OPENCODE_BASE_URL ?? "https://opencode.ai/zen/v1";
    const model = process.env.OPENCODE_MODEL ?? "gpt-5-nano";

    // Build a web-search prompt for gpt-5-nano that returns JSON hits
    const jurisdictions = query.jurisdictions.join(",") || "INT";
    const themes = query.themes.join(" | ") || "road safety audit";
    const limit = Math.min(query.limit ?? 5, 10);

    const systemPrompt = `You are a road safety audit harvester. Given jurisdictions [${jurisdictions}] and themes [${themes}], return a JSON array of up to ${limit} public-domain road safety audit documents. Each item must have {url, title_hint}. URLs must be real, publicly accessible PDFs or document pages (prefer .pdf, DocumentCenter, planning portals). Return only the JSON array, no prose.`;

    const userPrompt = `Jurisdictions: ${jurisdictions}\nThemes: ${themes}\nLimit: ${limit}\nReturn JSON array of {url, title_hint}.`;

    try {
      const raw = await withHostBudget("api.opencode.ai", async () =>
        chatComplete(
          {
            endpoint: { baseUrl: endpoint, apiKey },
            model,
            effort: "low",
            fetchImpl,
          },
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        ),
      );

      // Extract JSON array from LLM output
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start === -1 || end === -1) return [];
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{ url: string; title_hint?: string }>;

      const hits: DiscoveryHit[] = [];
      for (const item of parsed.slice(0, limit)) {
        if (!item.url || typeof item.url !== "string") continue;
        try {
          new URL(item.url);
        } catch {
          continue;
        }
        const title = item.title_hint ?? `AI harvested ${jurisdictions} ${themes}`;
        hits.push({
          hit_id: hitId(this.id, item.url),
          url: item.url,
          source_type: this.source_type,
          provider_id: this.id,
          portal_id: null,
          discovered_at: new Date().toISOString(),
          licence_hint: "unknown",
          http_status: 200,
          sha256_hint: null,
          title_hint: title,
          jurisdiction_guess: query.jurisdictions[0] ?? "INT",
        });
      }
      return hits;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("402") || msg.includes("Payment Required")) {
        console.warn(`[ai-search] quota 402: ${msg.slice(0, 200)}`);
        return [];
      }
      if (msg.includes("429")) {
        console.warn(`[ai-search] 429 rate limited, will retry`);
        return [];
      }
      console.warn(`[ai-search] discover failed: ${msg.slice(0, 200)}`);
      return [];
    }
  }

  async fetch(url: string, fetchImpl?: typeof fetch): Promise<FetchResult> {
    const f = fetchImpl ?? fetch;
    const res = await f(url, {
      headers: {
        Accept: "application/pdf,*/*",
        "User-Agent": "AuditorAI/1.0 (+https://auditorai-gamma.vercel.app)",
      },
    });
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, status: res.status, headers: res.headers as unknown as Headers };
  }
}

if (isEnabled() && hasKey()) {
  // Register only when enabled at import time; also handle late enable via listProviderIds
  registerProvider("ai-search", () => new AiSearchProvider());
} else {
  // Always register but discover will return [] when disabled — keeps listProviderIds stable
  // ponytail: single registration, not per-request
  registerProvider("ai-search", () => new AiSearchProvider());
}

// Ensure providerEnabled reflects AI gate
export { AiSearchProvider };

// agent-reach-search provider — gpt-5-nano brain + Exa/Jina hands (H7)
// Replaces URL-invention (ai-search) with real reach-out: deterministic Exa
// query per jurisdiction, Exa HTTP search, Jina HTTP liveness confirm
// (fail-open), gpt-5-nano qualify (fail-open). Same DiscoveryProvider seam,
// same withHostBudget discipline, same 402/429 grace as brave-search.
// Gated by AGENT_REACH_ENABLED + EXA_API_KEY + OPENCODE_API_KEY (all off by default).
import { hitId } from "@/discovery/ids";
import { resolveSecret } from "@/discovery/keychain";
import { withHostBudget } from "@/discovery/ratelimit";
import type { DiscoveryHit } from "@/discovery/types";
import type { DiscoverQuery, FetchResult } from "./provider-types";
import { registerProvider } from "./provider-types";
import { chatComplete } from "@/lib/inference";
import { setProviderDegraded } from "@/discovery/health-state";

const SECRETS = {
  enabled: { envVar: "AGENT_REACH_ENABLED", service: "auditorai/agent-reach" },
  exa: { envVar: "EXA_API_KEY", service: "auditorai/exa" },
  opencode: { envVar: "OPENCODE_API_KEY", service: "auditorai/opencode" },
} as const;

function isEnabled(): boolean {
  const flag = resolveSecret(SECRETS.enabled);
  const on = flag !== null ? flag.toLowerCase() === "true" : process.env.AGENT_REACH_ENABLED === "true";
  if (!on) return false;
  return resolveSecret(SECRETS.exa) !== null && resolveSecret(SECRETS.opencode) !== null;
}

interface ExaResult {
  url?: string;
  title?: string;
}

function exaQueryFor(jur: string, themes: string[]): string {
  const theme = themes[0] ?? '"road safety audit"';
  return `${theme} ${jur} road safety audit report filetype:pdf`;
}

async function exaSearch(
  query: string,
  limit: number,
  fetchImpl: typeof fetch,
): Promise<ExaResult[]> {
  const apiKey = resolveSecret(SECRETS.exa)!;
  const res = await withHostBudget("api.exa.ai", () =>
    fetchImpl("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query, numResults: limit, type: "auto" }),
    }),
  );
  if (res.status === 402 || res.status === 429) {
    console.warn(`[agent-reach-search] exa ${res.status}, graceful []`);
    return [];
  }
  if (!res.ok) {
    console.warn(`[agent-reach-search] exa HTTP ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { results?: ExaResult[]; data?: ExaResult[] };
  return json.results ?? json.data ?? [];
}

async function jinaAlive(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await withHostBudget("r.jina.ai", () =>
        fetchImpl(`https://r.jina.ai/${url}`, {
          headers: { Accept: "text/markdown,*/*" },
          signal: ctrl.signal,
        }),
      );
      // 404/410 = dead; anything else (incl. 4xx/5xx) is fail-open, not proof of death
      if (res.status === 404 || res.status === 410) return false;
      return true;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return true; // fail-open: reader flake is not proof the doc is gone
  }
}

async function qualify(
  jur: string,
  candidates: Array<{ url: string; title: string | null }>,
  fetchImpl: typeof fetch,
): Promise<Array<{ url: string; keep: boolean; title_hint?: string }>> {
  const apiKey = resolveSecret(SECRETS.opencode)!;
  const endpoint = process.env.OPENCODE_BASE_URL ?? "https://opencode.ai/zen/v1";
  const model = process.env.OPENCODE_MODEL ?? "gpt-5-nano";
  const list = candidates.map((c) => `- ${c.url} :: ${c.title ?? "(no title)"}`).join("\n");
  try {
    const raw = await withHostBudget("api.opencode.ai", () =>
      chatComplete(
        { endpoint: { baseUrl: endpoint, apiKey }, model, effort: "low", fetchImpl },
        [
          {
            role: "system",
            content: `You are a road safety audit harvest qualifier. Given candidate URLs for jurisdiction ${jur}, return a JSON array of {url, keep, title_hint}. keep=true only for real public-domain road safety audit documents (PDFs, planning portals, DocumentCenter). keep=false for blogs, marketing, unrelated pages. Return only the JSON array.`,
          },
          { role: "user", content: `Jurisdiction: ${jur}\nCandidates:\n${list}\nReturn JSON array of {url, keep, title_hint}.` },
        ],
      ),
    );
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return candidates.map((c) => ({ url: c.url, keep: true }));
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{
      url?: string;
      keep?: boolean;
      title_hint?: string;
    }>;
    return parsed.filter((p) => typeof p.url === "string").map((p) => ({
      url: p.url!,
      keep: p.keep !== false,
      title_hint: p.title_hint,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[agent-reach-search] qualify failed (fail-open): ${msg.slice(0, 160)}`);
    return candidates.map((c) => ({ url: c.url, keep: true }));
  }
}

class AgentReachSearchProvider {
  readonly id = "agent-reach-search";
  readonly source_type = "search-engine" as const;

  async discover(query: DiscoverQuery, fetchImpl: typeof fetch = fetch): Promise<DiscoveryHit[]> {
    if (!isEnabled()) return [];
    const limit = Math.min(query.limit ?? 5, 10);
    const perJur = Math.max(1, Math.min(5, Math.ceil(limit / Math.max(1, query.jurisdictions.length))));
    const hits: DiscoveryHit[] = [];
    const now = new Date().toISOString();
    let degraded = false;
    // ponytail: one Exa call per jurisdiction (no jur×theme fan-out); per-theme tuning if recall matters
    for (const jur of query.jurisdictions) {
      let results: ExaResult[];
      try {
        results = await exaSearch(exaQueryFor(jur, query.themes), perJur, fetchImpl);
      } catch (e) {
        console.warn(`[agent-reach-search] exa error: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
        degraded = true;
        continue;
      }
      if (results.length === 0) {
        degraded = true;
        continue;
      }
      const candidates: Array<{ url: string; title: string | null }> = [];
      for (const r of results.slice(0, perJur)) {
        if (!r.url) continue;
        try {
          new URL(r.url);
        } catch {
          continue;
        }
        if (candidates.some((c) => c.url === r.url)) continue;
        // Jina liveness is best-effort fail-open; 404/410 drops, everything else keeps
        const alive = await jinaAlive(r.url, fetchImpl);
        if (!alive) continue;
        candidates.push({ url: r.url, title: r.title ?? null });
      }
      if (candidates.length === 0) continue;
      const verdicts = await qualify(jur, candidates, fetchImpl);
      for (const v of verdicts) {
        if (!v.keep) continue;
        if (hits.some((h) => h.url === v.url)) continue;
        const title = v.title_hint ?? candidates.find((c) => c.url === v.url)?.title ?? `Agent-reach harvested ${jur}`;
        hits.push({
          hit_id: hitId(this.id, v.url),
          url: v.url,
          source_type: this.source_type,
          provider_id: this.id,
          portal_id: null,
          discovered_at: now,
          licence_hint: "unknown",
          http_status: 200,
          sha256_hint: null,
          title_hint: title,
          jurisdiction_guess: jur,
        });
        if (hits.length >= limit) break;
      }
      if (hits.length >= limit) break;
    }
    try {
      const { recordZeroHitOutcome } = await import("@/discovery/health-state");
      recordZeroHitOutcome(this.id, hits.length === 0);
      if (degraded || hits.length === 0) setProviderDegraded(this.id, true);
      else setProviderDegraded(this.id, false);
    } catch {
      /* health is best-effort */
    }
    return hits.slice(0, limit);
  }

  async fetch(url: string, fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
    const f = fetchImpl ?? fetch;
    const res = await withHostBudget(url, () =>
      f(url, {
        headers: {
          Accept: "application/pdf,*/*",
          "User-Agent": "AuditorAI/1.0 (+https://auditorai-gamma.vercel.app)",
        },
      }),
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, status: res.status, headers: res.headers as unknown as Headers };
  }
}

// Always register (discover returns [] when disabled) — keeps listProviderIds stable like ai-search.
registerProvider("agent-reach-search", () => new AgentReachSearchProvider());

export { AgentReachSearchProvider };

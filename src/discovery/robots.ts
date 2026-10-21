// robots.txt gate for the Track A harvester (ticket #40).
//
// Nothing in the repo enforced robots.txt before (see .autoforge/discovery/probe.md),
// so every Track A request is checked here first. Pure parsing is separated from
// fetching so the rules can be tested offline; fetching reuses the shared host
// budget (1 request/second per host, src/discovery/ratelimit.ts).
import { withHostBudget } from "./ratelimit";

/** Neutral UA: no AI-agent tokens (some provincial portals ban them). */
export const HARVEST_USER_AGENT = "AuditorAI-RSA-Harvest/1.0 (+public documents only)";

export interface RobotsGroup {
  /** Lower-cased user-agent tokens; "*" matches everything. */
  agents: string[];
  allow: string[];
  disallow: string[];
  /** Crawl-delay in milliseconds, when the group declares one. */
  crawlDelayMs: number | null;
}

export interface RobotsFile {
  groups: RobotsGroup[];
  /** robots.txt absent (404/410) — nothing is disallowed. */
  allowAll: boolean;
  /** robots.txt unreadable (401/403/5xx/network) — fail closed. */
  denyAll: boolean;
  /** Why the file is denyAll, when it is. */
  skipReason?: string;
}

const ALLOW_ALL: RobotsFile = { groups: [], allowAll: true, denyAll: false };

function denyAll(skipReason: string): RobotsFile {
  return { groups: [], allowAll: false, denyAll: true, skipReason };
}

function pathToRegex(pattern: string): RegExp {
  // Google-style: "*" matches any sequence, "$" anchors the end.
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const anchored = escaped.endsWith("\\$") ? `${escaped.slice(0, -2)}$` : escaped;
  return new RegExp(`^${anchored}`);
}

function matchLength(pattern: string): number {
  // Specificity = length of the rule pattern (wildcards excluded), like Google.
  return pattern.replace(/[*$]/g, "").length;
}

/** Parses a robots.txt body into groups. Pure; never throws. */
export function parseRobots(text: string): RobotsFile {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (current && lastWasAgent) {
        current.agents.push(value.toLowerCase());
      } else {
        current = { agents: [value.toLowerCase()], allow: [], disallow: [], crawlDelayMs: null };
        groups.push(current);
        lastWasAgent = true;
      }
      continue;
    }
    if (!current) continue;
    lastWasAgent = false;

    if (field === "allow") {
      if (value) current.allow.push(value);
    } else if (field === "disallow") {
      // "Disallow:" with an empty value means "allow everything".
      if (value) current.disallow.push(value);
    } else if (field === "crawl-delay") {
      const secs = Number(value);
      if (Number.isFinite(secs)) current.crawlDelayMs = Math.max(0, secs * 1000);
    }
  }
  return { groups, allowAll: false, denyAll: false };
}

function matchingGroups(robots: RobotsFile, ua: string): RobotsGroup[] {
  const token = ua.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] ?? "";
  const exact = robots.groups.filter((g) => g.agents.some((a) => a !== "*" && token.startsWith(a)));
  if (exact.length) return exact;
  const wildcard = robots.groups.filter((g) => g.agents.includes("*"));
  return wildcard;
}

/** Longest-match precedence; Allow wins at equal specificity. */
export function isAllowed(robots: RobotsFile, path: string, ua: string = HARVEST_USER_AGENT): boolean {
  if (robots.denyAll) return false;
  if (robots.allowAll) return true;

  const groups = matchingGroups(robots, ua);
  if (!groups.length) return true;

  let bestLength = -1;
  let bestAllow = true;
  for (const group of groups) {
    for (const pattern of group.disallow) {
      const len = matchLength(pattern);
      if (!pathToRegex(pattern).test(path)) continue;
      if (len > bestLength) {
        bestLength = len;
        bestAllow = false;
      }
    }
    for (const pattern of group.allow) {
      const len = matchLength(pattern);
      if (!pathToRegex(pattern).test(path)) continue;
      // Allow wins ties: equal specificity -> Allow.
      if (len >= bestLength) {
        bestLength = len;
        bestAllow = true;
      }
    }
  }
  return bestAllow;
}

/** Crawl-delay in milliseconds for the matching group, or null when undeclared. */
export function crawlDelayMs(robots: RobotsFile, ua: string = HARVEST_USER_AGENT): number | null {
  if (robots.denyAll || robots.allowAll) return null;
  for (const group of matchingGroups(robots, ua)) {
    if (group.crawlDelayMs !== null) return group.crawlDelayMs;
  }
  return null;
}

const cache = new Map<string, RobotsFile>();

/** Test hook: clear the per-host robots cache. */
export function resetRobotsCache(): void {
  cache.clear();
}

/**
 * Fetches and caches <origin>/robots.txt for a URL.
 * 404/410 -> allow all; 401/403 -> deny all; 5xx or network error -> deny all
 * with a skip_reason (fail closed).
 */
export async function robotsFor(url: string, ua: string = HARVEST_USER_AGENT): Promise<RobotsFile> {
  const origin = new URL(url).origin;
  const cached = cache.get(origin);
  if (cached) return cached;

  let file: RobotsFile;
  try {
    const res = await withHostBudget(origin, () =>
      fetch(`${origin}/robots.txt`, { headers: { "user-agent": ua } }),
    );
    if (res.status === 404 || res.status === 410) {
      file = ALLOW_ALL;
    } else if (res.status === 401 || res.status === 403) {
      file = denyAll(`robots.txt HTTP ${res.status}`);
    } else if (!res.ok) {
      file = denyAll(`robots.txt HTTP ${res.status}`);
    } else {
      file = parseRobots(await res.text());
    }
  } catch (err) {
    file = denyAll(`robots.txt fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  cache.set(origin, file);
  return file;
}

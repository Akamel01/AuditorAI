// DiscoveryProvider seam (mirrors AiAdapter doctrine, ADR-0001): provider-
// agnostic, OFF by default, fetch injectable for tests. One adapter per portal
// family; adapters never widen the Hit schema.
import type { DiscoveryHit } from "@/discovery/types";
import type { JurisdictionId } from "@/domain/types";

export interface DiscoverQuery {
  jurisdictions: JurisdictionId[];
  themes: string[];
  cursor?: string;
  limit?: number;
}

export interface FetchResult {
  bytes: Uint8Array;
  status: number;
  headers: Headers;
}

export interface DiscoveryProvider {
  readonly id: string;
  readonly source_type: DiscoveryHit["source_type"];
  discover(query: DiscoverQuery, fetchImpl?: typeof fetch): Promise<DiscoveryHit[]>;
  fetch(url: string, fetchImpl?: typeof fetch): Promise<FetchResult>;
}

type Factory = () => DiscoveryProvider;

const FACTORIES: Record<string, Factory> = {};

export function registerProvider(id: string, factory: Factory): void {
  FACTORIES[id] = factory;
}

export function listProviderIds(): string[] {
  return Object.keys(FACTORIES);
}

/**
 * Live providers are opt-in via env keys; without keys only the offline seed
 * provider resolves. Mirrors AI_ENABLED=false determinism guarantee.
 */
export function resolveProvider(id: string): DiscoveryProvider | null {
  const factory = FACTORIES[id];
  if (!factory) return null;
  return factory();
}

export function providerEnabled(id: string): boolean {
  switch (id) {
    case "bing-search":
      return !!process.env.DISCOVERY_BING_API_KEY;
    case "google-cse":
      return !!process.env.DISCOVERY_GOOGLE_CSE_KEY && !!process.env.DISCOVERY_GOOGLE_CSE_CX;
    case "seed-portals":
      return true; // offline curated seeds — always available
    default:
      return false;
  }
}

// DiscoveryProvider seam (mirrors AiAdapter doctrine, ADR-0001): provider-
// agnostic, OFF by default, fetch injectable for tests. One adapter per portal
// family; adapters never widen the Hit schema.
import type { DiscoveryHit } from "@/discovery/types";
import type { JurisdictionId } from "@/domain/types";
import { DISCOVERY_SECRETS, resolveSecret } from "@/discovery/keychain";

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
 * Live providers are opt-in via secrets (env var first, then macOS Keychain
 * under auditorai/*); without a secret only the offline seed provider resolves.
 * Mirrors AI_ENABLED=false determinism guarantee.
 */
export function providerEnabled(id: string): boolean {
  switch (id) {
    case "brave-search":
      return resolveSecret(DISCOVERY_SECRETS.brave) !== null;
    case "google-cse":
      return (
        resolveSecret(DISCOVERY_SECRETS.googleCseKey) !== null &&
        resolveSecret(DISCOVERY_SECRETS.googleCseCx) !== null
      );
    case "seed-portals":
      return true; // offline curated seeds — always available
    default:
      return false;
  }
}

export function resolveProvider(id: string): DiscoveryProvider | null {
  const factory = FACTORIES[id];
  if (!factory) return null;
  return factory();
}

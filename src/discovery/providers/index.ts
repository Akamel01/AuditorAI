// Provider registry bootstrap: importing this module registers every built-in
// adapter whose credentials resolve (env first, then Keychain auditorai/*).
// seed-portals is always on (offline dry-run backbone).
//
// Bing Search API note (2026-08-25): Microsoft retired Bing Search v7 on
// 2025-08-11 (HTTP 410; signups closed). The original bing-search adapter was
// replaced by brave-search before first live use — same seam, same allowlists.
import "./seed-portals";
import "./brave-search";
import "./google-cse";
import "./ai-search";

export {
  listProviderIds,
  resolveProvider,
  providerEnabled,
  type DiscoverQuery,
  type DiscoveryProvider,
  type FetchResult,
} from "./provider-types";

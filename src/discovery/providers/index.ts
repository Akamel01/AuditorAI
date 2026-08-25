// Provider registry bootstrap: importing this module registers every built-in
// adapter. Enabled set is env-driven; seed-portals is always on.
import "./seed-portals";
import "./bing-search";
import "./google-cse";

export {
  listProviderIds,
  resolveProvider,
  providerEnabled,
  type DiscoverQuery,
  type DiscoveryProvider,
  type FetchResult,
} from "./provider-types";

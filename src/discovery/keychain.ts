// Secret resolution for live discovery providers. Precedence: explicit env var
// wins (CI / containers), then macOS Keychain under the auditorai/* service
// namespace (AGENTS.md convention). Values never leave the process; callers
// only receive the string or null.
import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

export interface SecretRef {
  /** Environment variable checked first, e.g. DISCOVERY_BRAVE_API_KEY. */
  envVar: string;
  /** Keychain service name, e.g. auditorai/discovery-brave. */
  service: string;
}

const cache = new Map<string, string | null>();

export type KeychainReader = (account: string, service: string) => string | null;

function defaultReader(account: string, service: string): string | null {
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-a", account, "-s", service, "-w"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const value = out.toString("utf8").trim();
    return value.length > 0 ? value : null;
  } catch {
    return null; // not stored / non-macOS / user denied — stay OFF
  }
}

/** Inject `reader` in tests; production uses the real `security` CLI. */
export function resolveSecret(ref: SecretRef, reader: KeychainReader = defaultReader): string | null {
  const fromEnv = process.env[ref.envVar];
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  if (!cache.has(ref.service)) {
    let value: string | null = null;
    try {
      value = reader(userInfo().username, ref.service);
    } catch {
      value = null;
    }
    cache.set(ref.service, value);
  }
  return cache.get(ref.service) ?? null;
}

/** Test hook. */
export function resetSecretCache(): void {
  cache.clear();
}

export const DISCOVERY_SECRETS = {
  brave: { envVar: "DISCOVERY_BRAVE_API_KEY", service: "auditorai/discovery-brave" },
  googleCseKey: { envVar: "DISCOVERY_GOOGLE_CSE_KEY", service: "auditorai/discovery-cse-key" },
  googleCseCx: { envVar: "DISCOVERY_GOOGLE_CSE_CX", service: "auditorai/discovery-cse-cx" },
} as const;

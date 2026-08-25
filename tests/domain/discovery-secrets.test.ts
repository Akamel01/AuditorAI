// Secret resolution: env precedence, Keychain fallback, OFF-by-default safety.
import { afterEach, describe, expect, it } from "vitest";
import { DISCOVERY_SECRETS, resolveSecret, resetSecretCache } from "@/discovery/keychain";
import { providerEnabled } from "@/discovery/providers/provider-types";

afterEach(() => {
  resetSecretCache();
  delete process.env[DISCOVERY_SECRETS.brave.envVar];
});

describe("resolveSecret", () => {
  it("prefers a non-empty env var over any reader", () => {
    process.env[DISCOVERY_SECRETS.brave.envVar] = "env-token";
    const got = resolveSecret(DISCOVERY_SECRETS.brave, () => "keychain-token");
    expect(got).toBe("env-token");
  });

  it("falls back to the injected keychain reader when env is unset", () => {
    const got = resolveSecret(DISCOVERY_SECRETS.brave, () => "kc-value");
    expect(got).toBe("kc-value");
  });

  it("returns null (stay OFF) when both env and keychain miss", () => {
    const got = resolveSecret(DISCOVERY_SECRETS.brave, () => null);
    expect(got).toBeNull();
  });

  it("treats whitespace-only env as absent", () => {
    process.env[DISCOVERY_SECRETS.brave.envVar] = "   ";
    const got = resolveSecret(DISCOVERY_SECRETS.brave, () => null);
    expect(got).toBeNull();
  });
});

describe("providerEnabled gating", () => {
  it("seed-portals is always enabled", () => {
    expect(providerEnabled("seed-portals")).toBe(true);
  });
});

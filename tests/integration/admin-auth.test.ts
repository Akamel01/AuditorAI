// requireAdmin gate: developer-only auth for /dev + /api/dev/* surfaces (issue #2).
// Fail-closed semantics; unset env is indistinguishable from a wrong key.
import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_HEADER, requireAdmin } from "@/lib/api";

const KEY = "test-admin-key-0123456789abcdef";
const OTHER = "another-candidate-key-9988776655";

function req(headers?: Record<string, string>) {
  return new Request("http://local/api/dev/ping", { headers });
}

function denial(res: { status: number; body: unknown }) {
  return JSON.stringify({ status: res.status, body: res.body });
}

describe("requireAdmin", () => {
  const ORIGINAL = process.env.ADMIN_KEY;
  const restore = () => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = ORIGINAL;
  };
  afterEach(restore);

  it("denies with identical response when env unset vs wrong key", async () => {
    delete process.env.ADMIN_KEY;
    const unsetRes = await requireAdmin(req({ [ADMIN_HEADER]: KEY }));
    expect(unsetRes.ok).toBe(false);
    if (unsetRes.ok) return;
    const unsetJson = await unsetRes.res.json();
    const unsetShape = denial({ status: unsetRes.res.status, body: unsetJson });

    process.env.ADMIN_KEY = KEY;
    const wrongRes = await requireAdmin(req({ [ADMIN_HEADER]: OTHER }));
    expect(wrongRes.ok).toBe(false);
    if (wrongRes.ok) return;
    const wrongJson = await wrongRes.res.json();

    // Byte-identical denials: existence of the configured surface leaks nothing.
    expect(denial({ status: wrongRes.res.status, body: wrongJson })).toBe(unsetShape);
    expect(wrongRes.res.status).toBe(401);
  });

  it("accepts the correct key when configured", async () => {
    process.env.ADMIN_KEY = KEY;
    const r = await requireAdmin(req({ [ADMIN_HEADER]: KEY }));
    expect(r.ok).toBe(true);
  });

  it("denies a missing header", async () => {
    process.env.ADMIN_KEY = KEY;
    const r = await requireAdmin(req());
    expect(r.ok).toBe(false);
  });

  it("denies malformed header values safely", async () => {
    process.env.ADMIN_KEY = KEY;
    // Note: empty, control-character, and non-ByteString (e.g. emoji) header
    // values are rejected by the platform Headers API and cannot reach app code.
    // Constructible-hostile = long values and high-byte latin-1.
    for (const v of ["x".repeat(10_000), "\u00ff\u00fe".repeat(300)]) {
      const r = await requireAdmin(req({ [ADMIN_HEADER]: v }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.res.status).toBe(401);
    }
  });

  it("rate limits repeated attempts on one credential", async () => {
    process.env.ADMIN_KEY = OTHER;
    let sawLimit = false;
    for (let i = 0; i < 40 && !sawLimit; i++) {
      const r = await requireAdmin(req({ [ADMIN_HEADER]: OTHER }));
      if (!r.ok && r.res.status === 429) sawLimit = true;
    }
    expect(sawLimit).toBe(true);
  });
});

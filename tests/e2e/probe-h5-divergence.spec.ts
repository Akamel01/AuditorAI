// @probe payload-hash determinism across reloads. Probe-only, read-only (GETs only).
// Excluded from default gate: file self-skips unless PROBE_H5=1.
// Run: PROBE_H5=1 npx playwright test probe-h5-divergence
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

test.skip(process.env.PROBE_H5 !== "1", "probe-only: set PROBE_H5=1 to run (@probe excluded from default gate)");

async function getHashes(page: import("@playwright/test").Page, path: string) {
  const seen = new Map<string, string>();
  const onResp = async (res: import("@playwright/test").Response) => {
    try {
      if (res.request().method() !== "GET" || seen.has(res.url())) return;
      const buf = await res.body().catch(() => null);
      if (buf) seen.set(res.url(), createHash("sha256").update(buf).digest("hex"));
    } catch {}
  };
  page.on("response", onResp);
  await page.goto(path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(500);
  page.off("response", onResp);
  return seen;
}

for (const path of ["/projects/probe-nonexistent/audits/probe-nonexistent", "/dev/mission-control"]) {
  test(`@probe zero hash divergence across reloads: ${path}`, async ({ page }) => {
    const first = await getHashes(page, path);
    expect(first.size).toBeGreaterThan(0);
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    const second = await getHashes(page, path);
    const divergent = [...first.entries()].filter(([u, h]) => second.has(u) && second.get(u) !== h);
    expect(divergent).toEqual([]);
  });
}

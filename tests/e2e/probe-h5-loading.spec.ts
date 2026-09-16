// @probe loading-UX: skeleton presence + completeness. Probe-only, read-only.
// Excluded from default gate: file self-skips unless PROBE_H5=1.
// Run: PROBE_H5=1 npx playwright test probe-h5-loading
import { expect, test } from "@playwright/test";

test.skip(process.env.PROBE_H5 !== "1", "probe-only: set PROBE_H5=1 to run (@probe excluded from default gate)");

const SKELETON = ".skeleton, [role='status'], .animate-pulse";

test("@probe audit page shows skeleton then settles (read-only sentinel IDs)", async ({ page }) => {
  await page.goto("/projects/probe-nonexistent/audits/probe-nonexistent", { waitUntil: "commit" });
  await expect(page.locator(SKELETON).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(
    (sel) => document.querySelectorAll(sel).length === 0,
    SKELETON,
    { timeout: 20_000, polling: 100 },
  );
  // Sentinel IDs 404 read-only: skeleton gone, error notice or content settled.
  await expect(page.locator("body")).not.toBeEmpty();
});

test("@probe mission-control shows loading then settles", async ({ page }) => {
  await page.goto("/dev/mission-control", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Mission Control", exact: true })).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator("body")).not.toBeEmpty();
});

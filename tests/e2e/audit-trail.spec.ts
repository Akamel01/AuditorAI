import { expect, test } from "@playwright/test";
import fs from "node:fs";

const KEY = "e2e-trail-workspace-key-00000000";

test("audit trail: verified chain, export signed JSON", async ({ page }) => {
  await page.addInitScript(
    ([k]) => localStorage.setItem("auditorai.workspace_key", k as string),
    [KEY],
  );

  await page.goto("/projects");
  await page.getByPlaceholder(/mill road junction upgrade/i).fill("Playwright Trail");
  await page.locator("select").first().selectOption("UK");
  await page.locator("#stage-select").selectOption("uk:S2");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.locator("a", { hasText: "Playwright Trail" }).first()).toBeVisible();

  await page.goto("/audit-trail");
  await expect(page.getByTestId("trail-verify-ok")).toBeVisible();
  await expect(page.locator("tr", { hasText: "project.saved" })).toBeVisible();
  await expect(page.getByText(/Trail begins at .* prior history is not chained\./)).toBeVisible();
  await expect(page.getByTestId("trail-print")).toHaveText("print / save PDF");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("trail-export").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^audit-trail-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const raw = fs.readFileSync(path!, "utf8");
  const exported = JSON.parse(raw) as {
    format: string;
    signature: { alg: string; value: string };
    verification: { ok: boolean };
    entries: { action: string }[];
  };
  expect(exported.format).toBe("audit-trail/export@1");
  expect(exported.signature.alg).toBe("hmac-sha256");
  expect(exported.signature.value).toMatch(/^[0-9a-f]{64}$/);
  expect(exported.verification.ok).toBe(true);
  expect(exported.entries.some((e) => e.action === "project.saved")).toBe(true);
});

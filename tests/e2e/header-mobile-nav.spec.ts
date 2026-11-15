import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("header mobile nav: no horizontal scroll, all links visible", async ({ page }) => {
  await page.goto("/");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);

  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.click();

  const panel = page.getByTestId("mobile-nav-menu");
  await expect(panel).toBeVisible();

  for (const name of ["Method", "Workspace", "Audit trail", "Mission Control"]) {
    await expect(panel.getByRole("link", { name })).toBeVisible();
  }

  // Escape closes the menu.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

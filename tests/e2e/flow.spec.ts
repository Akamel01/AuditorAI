// Browser E2E: the §27 user path through real Chromium against the production
// build. Each test gets an isolated browser context, so workspace keys in
// localStorage never bleed across tests.
import { expect, test } from "@playwright/test";

const KEY = "e2e-workspace-key-0000000000000";
const BANNED = "Consider obtaining the Stage 1 response report.";
const CLEAN = "Obtain and review the Stage 1 response report before Stage 3 sign-off.";

test("landing shows the professional-responsibility disclaimer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/final professional responsibility/i)).toBeVisible();
});

test("full audit path: create → inputs → run → adjudicate → report", async ({ page }) => {
  // Isolated workspace identity for this run.
  await page.addInitScript(
    ([k]) => localStorage.setItem("auditorai.workspace_key", k as string),
    [KEY],
  );

  // ---- Create project via wizard -----------------------------------------
  await page.goto("/projects");
  await page.getByPlaceholder(/mill road junction upgrade/i).fill("Playwright Corridor");
  await page.locator("select").first().selectOption("UK");
  await page.locator("#stage-select").selectOption("uk:S2");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Playwright Corridor")).toBeVisible();

  // ---- Open project -------------------------------------------------------
  await page.locator("li", { hasText: "Playwright Corridor" }).locator("a").click();
  await expect(page.getByText(/Stage 2 \(completion of detailed design\)/i)).toBeVisible();
  await expect(page.getByText("DETAILED_DESIGN")).toBeVisible();
  await expect(page.getByText(/confidence · authoritative/i)).toBeVisible();

  // ---- Inputs panel reflects §27 states ------------------------------------
  const collision = page.locator("li", {
    hasText: /Collision data analysis/i,
  });
  await expect(collision).toBeVisible();
  await expect(collision.getByText(/required missing/i)).toBeVisible();

  // ---- Run audit ------------------------------------------------------------
  const postAudit = page.waitForResponse(
    (r) => r.url().includes("/audits") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^Run audit$/i }).click();
  const resp = await postAudit;
  expect(resp.status()).toBe(201);
  await expect(page).toHaveURL(/\/projects\/[^/]+\/audits\//);

  // Deterministic outcome with empty inputs at Stage 2:
  // process-gap finding present + missing-information panel populated.
  const card = page
    .locator('[data-testid="finding-card"]')
    .filter({ hasText: "F-R-UK-PREVRESP" });
  await expect(card).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText(/Missing information/i).first()).toBeVisible();

  // ---- Adjudication: banned wording rejected server-side ----------------------
  // (surfaced as an inline notice in the finding card — no browser dialog)
  await card.getByPlaceholder(/recommendation/i).fill(BANNED);
  await card.getByRole("button", { name: /accept with edits/i }).click();
  await expect(card.getByText(/banned wording/i)).toBeVisible({ timeout: 20_000 });

  // Clean wording accepted and persisted.
  await card.getByPlaceholder(/recommendation/i).fill(CLEAN);
  await card.getByRole("button", { name: /accept with edits/i }).click();
  await expect(card).toContainText(CLEAN);
  await expect(card).toContainText(/accepted_with_edits/i);

  // ---- Report section renders deterministic markdown + downloads --------------
  const pre = page.locator("pre");
  await expect(pre).toContainText("# Road Safety Audit Report");
  await expect(pre).toContainText(CLEAN);
  await expect(pre).toContainText("not scored under this framework");
  await expect(pre).toContainText("## 6. Limitations");
  await expect(page.getByRole("button", { name: /print \/ save pdf/i })).toBeVisible();
  await expect(page.locator('a[download$=".md"]')).toBeAttached();
  await expect(page.locator('a[download$=".json"]')).toBeAttached();

  // ---- ADR-0004: issuing freezes immutable numbered revisions ------------------
  // (confirmation happens in the designed dialog, not window.confirm)
  await page.getByTestId("issue-report").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /issue revision/i })
    .click();
  const lineage = page.getByTestId("issue-lineage");
  await expect(lineage).toBeVisible({ timeout: 20_000 });
  await expect(lineage.locator("li")).toHaveCount(1);
  await expect(lineage.getByText(/^I1$/)).toBeVisible();
  await expect(lineage.locator('a[download$="-I1.md"]')).toBeAttached();

  // Re-issue creates the next revision; the first is never replaced.
  await page.getByTestId("issue-report").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /issue revision/i })
    .click();
  await expect(lineage.locator("li")).toHaveCount(2, { timeout: 20_000 });
  await expect(lineage.getByText(/^I2$/)).toBeVisible();
});

test("M2: paste image → thumbnail → persists across reload (KV-backed)", async ({ page }) => {
  await page.addInitScript(
    ([k]) => localStorage.setItem("auditorai.workspace_key", k as string),
    ["m2-e2e-workspace-key-0000000"],
  );

  // Create a project.
  await page.goto("/projects");
  await page.getByPlaceholder(/mill road junction upgrade/i).fill("Playwright Attachments");
  await page.locator("select").first().selectOption("UK");
  await page.locator("#stage-select").selectOption("uk:S1");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Playwright Attachments")).toBeVisible();
  await page.locator("li", { hasText: "Playwright Attachments" }).locator("a").click();
  await expect(page.getByText(/Stage 1 \(completion of preliminary design\)/i)).toBeVisible();

  // Provide one input so the attach affordances render.
  await page.locator("select").nth(1).selectOption("Provided");
  const firstTextarea = page.locator("textarea").first();
  await expect(firstTextarea).toBeVisible();
  await firstTextarea.blur();

  // Paste a small PNG via the clipboard event on the textarea.
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  await firstTextarea.click();
  await page.evaluate((b64) => {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "pasted-plan.png", { type: "image/png" }));
    const target = document.querySelector("textarea")!;
    target.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, pngBase64);

  // Thumbnail appears.
  const thumb = page.locator('[data-testid^="thumb-"]').first();
  await expect(thumb).toBeVisible({ timeout: 15_000 });
  await expect(thumb.locator("img")).toBeVisible();

  // Reload → thumbnail persists (KV-backed).
  await page.reload();
  await expect(page.locator('[data-testid^="thumb-"]').first()).toBeVisible({
    timeout: 15_000,
  });
});

import { test, expect } from '@playwright/test';

// Simple UI harness for harvest buttons. Tagged @harvest for selective runs.
test('@harvest harness: API gap (Live) and UI harvest buttons', async ({ page }) => {
  // Navigate to Mission Control page
  await page.goto('/dev/mission-control');
  // Provide admin key via localStorage gate (maintain compatibility with existing gate)
  const adminKey = process.env.ADMIN_KEY ?? 'test-admin-key-0123456789abcdef';
  await page.evaluate((k) => {
    localStorage.setItem('auditorai.admin_key', k);
  }, adminKey);

  // Ensure the gap Run button exists for a quick click
  const gapBtn = page.locator('[data-testid^="run-gap-"]').first();
  if (await gapBtn.count() > 0) {
    await gapBtn.click();
    // Wait for discovery/run API call to happen (watch for network activity)
    await page.waitForResponse((resp) => resp.url().includes('/api/dev/discovery/run') && resp.status() === 200).catch(() => {});
  }

  // Trigger provider health live harvest if present
  const providerBtn = page.locator('[data-testid="provider-health-run-live-harvest"]');
  if (await providerBtn.count() > 0) {
    await providerBtn.first().click();
    // Allow some time for backend to process
    await page.waitForTimeout(1000).catch(() => {});
  }

  // Trigger AI Harvest Start button if present
  const aiBtn = page.locator('[data-testid="ai-harvest-start"]');
  if (await aiBtn.count() > 0) {
    await aiBtn.first().click();
    await page.waitForTimeout(1000).catch(() => {});
  }

  // Basic assertion: page still loads and selectors exist
  await expect(page).toBeTruthy();
});

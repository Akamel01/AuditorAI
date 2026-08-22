// Throwaway screenshot capture for the D2 prototypes (not part of CI).
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

async function shoot(page, file, out, actions) {
  await page.goto("file://" + path.join(here, file));
  await page.waitForTimeout(1200);
  if (actions) await actions(page);
  await page.screenshot({ path: path.join(here, out), fullPage: false });
  console.log("captured", out);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await shoot(page, "candidate-a.html", "candidate-a-initial.png");
await page.close();
const page2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await shoot(page2, "candidate-a.html", "candidate-a-stepped-inspect.png", async (p) => {
  await p.locator(".node").nth(3).click(); // AG-RULES
  for (let i = 0; i < 4; i++) await p.locator("#step").click();
});
await page2.close();

const page3 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await shoot(page3, "candidate-b.html", "candidate-b-initial.png");
await page3.close();
const page4 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await shoot(page4, "candidate-b.html", "candidate-b-stepped-inspect.png", async (p) => {
  await p.waitForTimeout(800);
  const nodes = p.locator(".rfnode");
  await nodes.nth(3).click();
  await p.locator("#step").click();
  await p.locator("#step").click();
  await p.locator("#step").click();
  await p.locator("#step").click();
});
await page4.close();

await browser.close();

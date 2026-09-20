const { test, expect } = require("@playwright/test");

test("Sangam brand mark and palette are wired through entry and workspace", async ({ page }) => {
  await page.goto("http://localhost:3456/index.html");
  await page.waitForFunction(() => Boolean(window.sangamApp));

  const entryMark = page.locator("#view-landing .entry-brand-mark");
  await expect(entryMark).toBeVisible();
  expect(await entryMark.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator("#hero-get-started-btn")).toHaveCSS("background-color", "rgb(245, 166, 35)");

  await page.evaluate(() => window.sangamApp.switchView("dashboard", { skipGuard: true }));
  await expect(page.locator("#view-workspace .brand-mark img")).toBeVisible();

  const brandTokens = await page.evaluate(() => ({
    orange: getComputedStyle(document.documentElement).getPropertyValue("--brand-orange").trim(),
    blue: getComputedStyle(document.documentElement).getPropertyValue("--brand-blue").trim(),
    green: getComputedStyle(document.documentElement).getPropertyValue("--brand-green").trim(),
  }));
  expect(brandTokens).toEqual({ orange: "#f5a623", blue: "#2f82d9", green: "#18a86b" });
});

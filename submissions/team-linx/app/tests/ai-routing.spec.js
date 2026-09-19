const { test, expect } = require("@playwright/test");

test("factual manager prompts use live data without an AI request", async ({ page }) => {
  let aiRequests = 0;
  page.on("request", (request) => {
    if (/generativelanguage\.googleapis\.com|functions\/v1\/ai-coordinator/.test(request.url())) aiRequests += 1;
  });

  await page.goto("http://localhost:3456/index.html");
  await page.waitForFunction(() => Boolean(window.sangamApp));
  await page.evaluate(() => window.sangamApp.switchView("dashboard"));
  await page.getByRole("button", { name: "Open AI Briefing" }).click();
  await page.locator("#gemini-prompt-input").fill("List the operational teams and leaders");
  await page.locator("#gemini-input-form").press("Enter");

  const response = page.locator("#gemini-thread .ai-msg.bot").last();
  await expect(response).toContainText("Operational teams");
  await expect(response.locator(".ai-source-badge")).toHaveText("Live event data");
  expect(aiRequests).toBe(0);
});

test("the dependency-free workspace smoke suite passes", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("http://localhost:3456/tests/ui-smoke.html");
  await page.getByRole("button", { name: "Run tests" }).click();
  await expect(page.locator("#results li").last()).toContainText("PASS", { timeout: 55_000 });
  await expect(page.locator("#results .fail")).toHaveCount(0);
});

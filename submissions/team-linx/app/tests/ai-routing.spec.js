const { test, expect } = require("@playwright/test");

test("factual manager prompts use live data without an AI request", async ({ page }) => {
  let aiRequests = 0;
  page.on("request", (request) => {
    if (/generativelanguage\.googleapis\.com|functions\/v1\/ai-coordinator/.test(request.url())) aiRequests += 1;
  });

  await page.goto("http://localhost:3456/index.html");
  await page.waitForFunction(() => Boolean(window.sangamApp));
  await page.evaluate(() => {
    window.sangamApp.auth.setCustomUser({ id: "usr-manager", name: "Sarah Jenkins", role: "manager" });
    window.sangamApp.state.currentEvent = { id: "evt-test", title: "Kraft Night 2026", sixDigitCode: "482910", venue: "Main Auditorium" };
    window.sangamApp.state.groups = [
      { id: "grp-stage", name: "Stage & Audio", leaderName: "Athul Krishna" },
      { id: "grp-food", name: "Food Coordination", leaderName: "Sonia Chen" }
    ];
    window.sangamApp.switchView("dashboard", { skipGuard: true });
  });
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

test("Gateway Plan with Gemini opens dedicated planner modal, supports templates and creates event", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("http://localhost:3456/index.html");
  await page.waitForFunction(() => Boolean(window.sangamApp));
  await page.evaluate(() => {
    window.sangamApp.switchView("gateway", { skipGuard: true });
  });

  // 1. Click Plan with Gemini
  const planBtn = page.locator("#btn-plan-event");
  await expect(planBtn).toBeVisible();
  await planBtn.click();

  // 2. Modal appears
  const modal = page.locator("#modal-event-planner");
  await expect(modal).toBeVisible();

  // 3. Templates are rendered
  const templates = modal.locator(".planner-tpl-card");
  await expect(templates).toHaveCount(4);

  // 4. Click Wedding template
  await modal.locator('.planner-tpl-card[data-tpl-id="wedding"]').click();
  await expect(modal.locator("#planner-event-title")).toHaveValue("Grand Wedding Celebration");
  await expect(modal.locator("#planner-groups-list .planner-item-row")).toHaveCount(5);

  // 5. Test AI prompt input and generate
  await modal.locator("#planner-ai-input").fill("Add an e-sports tournament and live streaming crew");
  await modal.locator("#btn-planner-ai-submit").click();

  // 6. Wait for generation to complete (button re-enabled)
  await expect(modal.locator("#btn-planner-ai-submit")).toBeEnabled({ timeout: 25000 });

  // Verify blueprint has populated departments
  const groupCount = await modal.locator("#planner-groups-list [data-group-row]").count();
  expect(groupCount).toBeGreaterThanOrEqual(5);

  // 7. Click Create Event from Plan
  await modal.locator("#btn-planner-create-event").click();

  // 8. Modal closes and switches to dashboard
  await expect(modal).toBeHidden();
  await expect(page.locator("#view-workspace")).toBeVisible();
});


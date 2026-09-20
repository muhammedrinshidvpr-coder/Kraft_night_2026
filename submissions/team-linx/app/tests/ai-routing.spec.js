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

test("Gateway Plan with Gemini requires real Gemini, resets cleanly, and stores history in Session & Access", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("http://localhost:3456/index.html");
  await page.waitForFunction(() => Boolean(window.sangamApp));
  const managerId = `usr-manager-test-${Date.now()}`;
  await page.evaluate((mid) => {
    localStorage.removeItem("sangam_all_events");
    localStorage.removeItem("sangam_event_snapshots");
    localStorage.removeItem("sangam_current_event");
    localStorage.removeItem("sangam_groups");
    localStorage.removeItem("sangam_programmes");
    localStorage.removeItem("sangam_joined_people");
    localStorage.removeItem("sangam_messages");
    localStorage.removeItem("sangam_role_slots");
    window.sangamApp.state.currentEvent = null;
    window.sangamApp.state.groups = [];
    window.sangamApp.state.joinedPeople = [];
    window.sangamApp.state.messages = {};
    window.sangamApp.state.roleSlots = [];
    window.sangamApp.taskManager.setProgrammes([]);
    window.sangamApp.chatManager.setMessages({});
    window.sangamApp.auth.setCustomUser({ id: mid, name: "Test Manager", email: `${mid}@test.app`, avatar: "TM", role: "manager", department: "Event Organizer" });
    window.sangamApp.switchView("gateway", { skipGuard: true });
  }, managerId);

  const planBtn = page.locator("#btn-plan-event");
  await expect(planBtn).toBeVisible();
  await planBtn.click();

  const modal = page.locator("#modal-event-planner");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".planner-tpl-card")).toHaveCount(4);
  // New sessions always start from the Hackathon preset.
  await expect(modal.locator("#planner-event-title")).toHaveValue("HackSangam 2026: 24-Hour Sprint");

  // Wedding preset loads cleanly.
  await modal.locator('.planner-tpl-card[data-tpl-id="wedding"]').click();
  await expect(modal.locator("#planner-event-title")).toHaveValue("Grand Wedding Celebration");
  await expect(modal.locator("#planner-groups-list .planner-item-row")).toHaveCount(5);

  // Without a live Supabase manager session, Gemini shows a visible retryable error and keeps the preset.
  await modal.locator("#planner-ai-input").fill("Add an e-sports tournament and live streaming crew");
  await modal.locator("#btn-planner-ai-submit").click();
  await expect(modal.locator("#btn-planner-ai-submit")).toBeEnabled({ timeout: 25000 });
  await expect(modal.locator("#planner-source-badge")).toContainText("Gemini unavailable");
  await expect(modal.locator("#planner-groups-list .planner-item-row")).toHaveCount(5);

  // Creating the preset plan stores it and opens the workspace.
  await modal.locator("#btn-planner-create-event").click();
  await expect(modal).toBeHidden();
  await expect(page.locator("#view-workspace")).toBeVisible();

  // Session & Access history contains the created event.
  await page.locator("#profile-btn").click();
  await expect(page.locator("#profile-popover")).toBeVisible();
  await expect(page.locator("#session-history-list .session-history-item")).toHaveCount(1);
  await expect(page.locator("#session-history-list")).toContainText("Grand Wedding Celebration");
  await page.locator("#btn-profile-close").click();

  // Returning to the gateway resets the active workspace but preserves history.
  await page.locator("#profile-btn").click();
  await page.locator("#btn-side-back-gateway").click();
  await expect(page.locator("#view-gateway")).toBeVisible();
  const afterGateway = await page.evaluate(() => ({
    currentEvent: window.sangamApp.state.currentEvent,
    groups: window.sangamApp.state.groups.length,
    programmes: window.sangamApp.taskManager.getProgrammes().length,
    history: JSON.parse(localStorage.getItem("sangam_all_events") || "[]").length,
  }));
  expect(afterGateway.currentEvent).toBeNull();
  expect(afterGateway.groups).toBe(0);
  expect(afterGateway.programmes).toBe(0);
  expect(afterGateway.history).toBe(1);

  // The next planner session starts clean and does not stack programmes.
  await page.locator("#btn-plan-event").click();
  await expect(modal).toBeVisible();
  await expect(modal.locator("#planner-event-title")).toHaveValue("HackSangam 2026: 24-Hour Sprint");
  const programmeCount = await modal.locator("#planner-programmes-list [data-prog-row]").count();
  expect(programmeCount).toBe(6);
  await modal.locator("#btn-planner-cancel").click();
  await expect(modal).toBeHidden();
});

test("secure default: without the testing flag the browser never calls Google directly", async ({ page }) => {
  let googleCalls = 0;
  page.on("request", (request) => {
    if (/generativelanguage\.googleapis\.com/.test(request.url())) googleCalls += 1;
  });

  await page.goto("http://localhost:3456/index.html");
  await page.waitForFunction(() => Boolean(window.sangamApp));

  // Secure default: testing flag off and no browser key. Attempting a Gemini
  // plan without a Supabase session must fail visibly without ever
  // contacting Google directly from the browser.
  await page.evaluate(() => {
    window.ENV_ALLOW_BROWSER_GEMINI_TESTING = false;
    window.ENV_GEMINI_API_KEY = undefined;
    const mid = `usr-manager-keyguard-${Date.now()}`;
    window.sangamApp.auth.setCustomUser({ id: mid, name: "Keyguard Manager", email: `${mid}@test.app`, avatar: "KM", role: "manager", department: "Event Organizer" });
    window.sangamApp.switchView("gateway", { skipGuard: true });
  });
  await page.locator("#btn-plan-event").click();
  const modal = page.locator("#modal-event-planner");
  await expect(modal).toBeVisible();
  await modal.locator("#planner-ai-input").fill("Plan a test summit");
  await modal.locator("#btn-planner-ai-submit").click();
  await expect(modal.locator("#btn-planner-ai-submit")).toBeEnabled({ timeout: 25000 });
  await expect(modal.locator("#planner-source-badge")).toContainText("Gemini unavailable");
  expect(googleCalls).toBe(0);
  await modal.locator("#btn-planner-cancel").click();
  await expect(modal).toBeHidden();
});

test("testing flag routes the Edge fallback through the browser key", async ({ page }) => {
  let googleCalls = 0;
  // Abort before any real request leaves the browser: this proves the
  // fallback wiring without spending quota or needing a valid key.
  await page.route("**/generativelanguage.googleapis.com/**", (route) => {
    googleCalls += 1;
    route.abort();
  });

  await page.goto("http://localhost:3456/index.html");
  await page.waitForFunction(() => Boolean(window.sangamApp));

  await page.evaluate(() => {
    window.ENV_ALLOW_BROWSER_GEMINI_TESTING = true;
    window.ENV_GEMINI_API_KEY = "test-key-does-not-leave-browser";
    const mid = `usr-manager-testflag-${Date.now()}`;
    window.sangamApp.auth.setCustomUser({ id: mid, name: "Flag Manager", email: `${mid}@test.app`, avatar: "FM", role: "manager", department: "Event Organizer" });
    window.sangamApp.switchView("gateway", { skipGuard: true });
  });
  await page.locator("#btn-plan-event").click();
  const modal = page.locator("#modal-event-planner");
  await expect(modal).toBeVisible();
  await modal.locator("#planner-ai-input").fill("Plan a test summit");
  await modal.locator("#btn-planner-ai-submit").click();
  await expect(modal.locator("#btn-planner-ai-submit")).toBeEnabled({ timeout: 25000 });
  // Edge has no session, so the testing fallback must have attempted Google.
  expect(googleCalls).toBeGreaterThanOrEqual(1);
  // The aborted attempt surfaces as a visible, retryable planner error.
  await expect(modal.locator("#planner-source-badge")).toContainText("Gemini unavailable");
  await modal.locator("#btn-planner-cancel").click();
  await expect(modal).toBeHidden();
});


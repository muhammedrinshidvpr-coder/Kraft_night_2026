// Sangam dependency-free UI smoke tests. No frameworks, no bundlers.
//
// Design: every step re-reads the live iframe document/app (never caches
// references across reloads), each run cleans up its own probes, and the
// delete test removes only the probe it created (seed data is never eaten,
// so repeated runs stay green).
const results = document.getElementById("results");
const frame = document.getElementById("app-frame");

function report(name, passed, detail = "") {
  const li = document.createElement("li");
  li.className = passed ? "pass" : "fail";
  li.textContent = `${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`;
  results.appendChild(li);
  return passed;
}

// Always read CURRENT iframe state: after a reload the old document and
// window (and any cached sangamApp) are detached and must not be used.
function live() {
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  const app = win && win.sangamApp;
  if (!doc || !doc.getElementById("view-workspace") || !app) return null;
  const q = (sel) => doc.querySelector(sel);
  const qa = (sel) => Array.from(doc.querySelectorAll(sel));
  return { doc, win, app, q, qa };
}

function waitForApp(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const state = live();
      if (state) return resolve(state);
      if (Date.now() - start > timeoutMs) return reject(new Error("app did not boot"));
      setTimeout(tick, 100);
    };
    tick();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reload the iframe and resolve only once the NEW app instance has booted.
// (Polling for mere existence can catch the old, still-alive document.)
async function reloadApp(timeoutMs = 10000) {
  const before = frame.contentWindow && frame.contentWindow.sangamApp;
  frame.contentWindow.location.reload();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cur = frame.contentWindow && frame.contentWindow.sangamApp;
    if (cur && cur !== before) break;
    await sleep(100);
  }
  return waitForApp();
}

async function run() {
  results.innerHTML = "";
  let allPass = true;
  try {
    // Isolate persistence, then reboot the app so managers re-init from
    // clean seed defaults (clearing alone leaves stale in-memory state).
    await waitForApp();
    frame.contentWindow.localStorage.clear();
    let s = await reloadApp();

    // Initialize clean manager session for smoke suite
    s.app.auth.setCustomUser({
      id: "usr-test-manager",
      name: "Test Manager",
      role: "manager",
      department: "Executive Committee"
    });
    const generalGroup = {
      id: "grp-general",
      name: "General Announcements",
      icon: "📢",
      leaderName: "Test Manager",
      memberCount: 1
    };
    s.app.state.currentEvent = {
      id: "evt-test-" + Date.now(),
      title: "Test Event",
      sixDigitCode: "123456",
      venue: "TBD",
      status: "active",
      manager_id: "usr-test-manager",
      manager_name: "Test Manager"
    };
    s.app.state.groups = [generalGroup];
    s.app.state.joinedPeople = [{
      id: "usr-test-manager",
      name: "Test Manager",
      role: "manager",
      roleBadge: "Event Manager",
      groupId: "grp-general",
      groupName: "General Announcements",
      status: "active"
    }];
    s.app.state.programmes = [];
    s.app.state.messages = { "grp-general": [] };
    s.app.taskManager.setProgrammes([]);
    s.app.chatManager.setActiveGroup("grp-general");
    s.app.chatManager.setMessages({ "grp-general": [] });
    s.app.persistState();

    // 1. Workspace shell exists with 5 pages.
    const pages = ["dashboard", "assign-roles", "create-program", "groups", "about-event"];
    allPass = report("workspace shell exposes five pages", pages.every((p) => !!s.doc.getElementById(`page-${p}`))) && allPass;

    // 2. Navigation switches page, title and active state.
    s.app.switchView("dashboard");
    const navOk = s.doc.getElementById("page-dashboard") && !s.doc.getElementById("page-dashboard").hidden
      && s.doc.getElementById("workspace-page-title").textContent === "Dashboard"
      && s.q('[data-workspace-page="dashboard"]').classList.contains("active");
    allPass = report("dashboard navigation updates title and active state", !!navOk) && allPass;

    // 3. FEATURE VERIFICATION: create programme on Create Program, see it on Dashboard, survive reload.
    const probe = `Smoke Probe ${Date.now()}`;
    s.app.switchView("create-program");
    s.doc.getElementById("prog-title-inline").value = probe;
    s.doc.getElementById("prog-venue-inline").value = "Test Hall";
    s.doc.getElementById("prog-start-inline").value = "20:00";
    s.doc.getElementById("prog-end-inline").value = "21:00";
    s.doc.getElementById("form-create-program-inline").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    const inCreateList = s.doc.getElementById("programs-list").textContent.includes(probe);
    allPass = report("new programme appears in Create Program list", inCreateList) && allPass;

    s.app.switchView("dashboard");
    const inDashboard = s.doc.getElementById("timeline-list").textContent.includes(probe);
    allPass = report("same programme appears on Dashboard timeline", inDashboard) && allPass;

    frame.contentWindow.location.reload();
    s = await reloadApp();
    s.app.switchView("dashboard");
    const persisted = s.doc.getElementById("timeline-list").textContent.includes(probe);
    allPass = report("programme persists after reload", persisted) && allPass;

    // 4. Legacy chat view normalizes to groups.
    s.app.switchView("chat");
    const normalized = !s.doc.getElementById("page-groups").hidden && s.app.currentView === "groups";
    allPass = report("legacy chat view normalizes to groups", normalized) && allPass;

    // 5. RBAC scaffold: permissions banner and AI thread exist.
    s.app.switchView("groups");
    const bannerExists = !!s.doc.getElementById("chat-read-only-banner");
    const aiThreadExists = !!s.doc.getElementById("gemini-thread");
    allPass = report("chat permissions banner and AI thread exist", bannerExists && aiThreadExists) && allPass;

    // 6. About page derives live counts.
    s.app.switchView("about-event");
    const aboutText = s.doc.getElementById("page-about-event").textContent;
    const aboutOk = aboutText.includes("Operational groups") && aboutText.includes("Organizers");
    allPass = report("about page renders groups and organizers", aboutOk) && allPass;

    // 7. FEATURE VERIFICATION: edit programme modal updates all fields and syncs.
    s.app.switchView("create-program");
    await sleep(400);
    s = await waitForApp();
    const editBtn = s.qa("#programs-list .program-card").map((card) => ({
      card,
      btn: card.querySelector("[data-edit]"),
    })).find((x) => x.card.textContent.includes(probe) && x.btn);
    if (editBtn) editBtn.btn.click();
    await sleep(200);
    const modalVisible = s.doc.getElementById("edit-program-modal") && !s.doc.getElementById("edit-program-modal").hidden;
    const titleVal = s.doc.getElementById("edit-prog-title").value;
    const prefillOk = modalVisible && titleVal === probe;

    const editedProbe = `${probe} - Edited`;
    s.doc.getElementById("edit-prog-title").value = editedProbe;
    s.doc.getElementById("edit-prog-venue").value = "Updated Venue 42";
    s.doc.getElementById("edit-prog-desc").value = "Updated Description Details";
    s.doc.getElementById("form-edit-program").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(300);

    const editSavedInCreate = s.doc.getElementById("programs-list").textContent.includes(editedProbe)
      && s.doc.getElementById("programs-list").textContent.includes("Updated Venue 42");
    allPass = report("edit modal pre-fills and updates programme fields", prefillOk && editSavedInCreate) && allPass;

    s.app.switchView("dashboard");
    const editSavedInDash = s.doc.getElementById("timeline-list").textContent.includes(editedProbe);
    allPass = report("edited programme appears on Dashboard timeline", editSavedInDash) && allPass;

    // 8. REGRESSION: deleting the probe removes exactly that entry (seeds untouched).
    s.app.switchView("create-program");
    await sleep(400);
    s = await waitForApp();
    const countBefore = s.qa("#programs-list .program-card").length;
    const delBtn = s.qa("#programs-list .program-card").map((card) => ({
      card,
      btn: card.querySelector("[data-delete]"),
    })).find((x) => x.card.textContent.includes(editedProbe) && x.btn);
    s.win.confirm = () => true;
    if (delBtn) delBtn.btn.click();
    // Poll: the delete path is sync, but re-query live state until settled.
    let listText = "";
    let countAfter = countBefore;
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      s = await waitForApp();
      listText = s.doc.getElementById("programs-list").textContent;
      countAfter = s.qa("#programs-list .program-card").length;
      if (!listText.includes(editedProbe)) break;
    }
    allPass = report("delete removes exactly the created probe", !!delBtn && !listText.includes(editedProbe) && countAfter === countBefore - 1, `found=${!!delBtn} ${countBefore} -> ${countAfter}`) && allPass;

    // 8. REGRESSION: executive briefing appends instead of crashing.
    s.app.switchView("dashboard");
    await sleep(200);
    s = await waitForApp();
    const threadBefore = s.doc.getElementById("gemini-thread").children.length;
    s.doc.getElementById("btn-ai-briefing").click();
    await sleep(800);
    s = await waitForApp();
    allPass = report("executive briefing appends to AI thread", s.doc.getElementById("gemini-thread").children.length > threadBefore) && allPass;

    // 9. FEATURE VERIFICATION: factual manager prompt stays local and exposes source.
    const originalFetch = s.win.fetch;
    let aiFetches = 0;
    s.win.fetch = () => {
      aiFetches += 1;
      throw new Error("Local factual responses must not call a provider.");
    };
    await s.app.submitGeminiPrompt("List the operational teams and leaders");
    await sleep(100);
    s = await waitForApp();
    const latestAiText = s.doc.getElementById("gemini-thread").lastElementChild.textContent;
    const latestSource = s.doc.getElementById("gemini-thread").lastElementChild.querySelector(".ai-source-badge")?.textContent;
    allPass = report("factual AI prompt uses live event data without a Gemini request", aiFetches === 0 && latestAiText.includes("Operational teams") && latestSource === "Live event data") && allPass;
    s.win.fetch = originalFetch;

    // 10. REGRESSION: RBAC enforced per role (test role permissions directly).
    s.app.auth.setRole("overseer");
    s.app.handleUserRoleChanged(s.app.auth.getCurrentUser());
    await sleep(300);
    s = await waitForApp();
    const overseerLocked = s.doc.getElementById("chat-text-input").disabled
      && !s.doc.getElementById("chat-read-only-banner").hidden
      && s.doc.getElementById("prog-title-inline").disabled;
    allPass = report("overseer is read-only across chat and schedule", overseerLocked) && allPass;

    s.app.auth.setRole("volunteer");
    s.app.handleUserRoleChanged(s.app.auth.getCurrentUser());
    await sleep(300);
    s = await waitForApp();
    const volunteerAccess = s.doc.getElementById("prog-title-inline").disabled;
    allPass = report("volunteer has restricted coordinator access", volunteerAccess) && allPass;

    s.app.auth.setRole("manager");
    s.app.handleUserRoleChanged(s.app.auth.getCurrentUser());
    await sleep(300);
    s = await waitForApp();
    const managerFull = !s.doc.getElementById("chat-text-input").disabled
      && !s.doc.getElementById("prog-title-inline").disabled;
    allPass = report("manager has full schedule and chat control", managerFull) && allPass;

    // Session popover displays user & event PIN, and Logout redirects to landing page.
    s.doc.getElementById("profile-btn").click();
    await sleep(200);
    s = await waitForApp();
    const popVisible = !s.doc.getElementById("profile-popover").hidden;
    const popUserMatches = s.doc.getElementById("popover-user-name").textContent.length > 0;
    const popCodeMatches = s.doc.getElementById("nav-code-display").textContent.length === 6;
    allPass = report("session & access popover opens with profile card and 6-digit PIN", popVisible && popUserMatches && popCodeMatches) && allPass;

    s.doc.getElementById("btn-logout").click();
    await sleep(200);
    s = await waitForApp();
    const isLoginView = s.app.currentView === "login"
      && !s.doc.getElementById("view-login").hidden
      && s.doc.getElementById("view-workspace").hidden;
    allPass = report("logout redirects to entry Login page and hides workspace", isLoginView) && allPass;

    // 11. FEATURE VERIFICATION: Sign Up creates a new user, updates auth, and opens Gateway.
    s.doc.getElementById("btn-login-to-signup").click();
    await sleep(200);
    s = await waitForApp();
    const isSignUpView = s.app.currentView === "signup" && !s.doc.getElementById("view-signup").hidden;
    allPass = report("navigation switches from Login to Sign Up view", isSignUpView) && allPass;

    const testUser = "Alex Rivera";
    s.doc.getElementById("input-signup-name").value = testUser;
    s.doc.getElementById("input-signup-email").value = "alex.rivera@example.com";
    s.doc.getElementById("input-signup-password").value = "securepass123";
    s.doc.getElementById("signup-form").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(400);
    s = await waitForApp();

    const isGatewayAfterSignUp = s.app.currentView === "gateway" && !s.doc.getElementById("view-gateway").hidden;
    const badgeText = s.doc.getElementById("gateway-active-user-name").textContent;
    const userRecognized = badgeText.includes(testUser);
    allPass = report("Sign Up authenticates new user and navigates to Event Gateway", isGatewayAfterSignUp && userRecognized) && allPass;

    // 12. FEATURE VERIFICATION: Creating an event assigns the logged-in user as Manager.
    const customEventTitle = "Global Tech Fest 2026";
    s.doc.getElementById("input-event-title").value = customEventTitle;
    s.doc.getElementById("create-event-form").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(400);
    s = await waitForApp();

    const inWorkspaceAfterCreate = s.app.currentView === "dashboard" && !s.doc.getElementById("view-workspace").hidden;
    const sideEventTitle = s.doc.getElementById("side-event-title").textContent;
    const userRoleDisplay = s.doc.getElementById("user-name-display").textContent;
    allPass = report("creating an event enters Workspace Dashboard with user as Manager", inWorkspaceAfterCreate && sideEventTitle === customEventTitle && userRoleDisplay === testUser) && allPass;

    // 13. FEATURE VERIFICATION: Logging out and logging back in with credentials.
    s.doc.getElementById("btn-sidebar-logout").click();
    await sleep(200);
    s = await waitForApp();
    const isLoginAgain = s.app.currentView === "login";
    allPass = report("sidebar logout returns to Login view", isLoginAgain) && allPass;

    s.doc.getElementById("input-login-name").value = testUser;
    s.doc.getElementById("input-login-password").value = "securepass123";
    s.doc.getElementById("login-form").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(400);
    s = await waitForApp();
    const isGatewayAfterLogin = s.app.currentView === "gateway"
      && s.doc.getElementById("gateway-active-user-name").textContent.includes(testUser);
    allPass = report("Login authenticates credentials and opens Event Gateway", isGatewayAfterLogin) && allPass;

    // Enter workspace as Manager Alex Rivera
    s.app.switchView("dashboard");
    await sleep(200);
    s = await waitForApp();
    const activePin = s.app.state.currentEvent?.sixDigitCode || "482910";

    // 14. FEATURE VERIFICATION: Invite Members Modal (Link generation & SendGrid email dispatch)
    s.doc.getElementById("btn-open-invite").click();
    await sleep(200);
    s = await waitForApp();
    const inviteModal = s.doc.getElementById("invite-member-modal");
    const inviteModalOpened = inviteModal && !inviteModal.hidden;
    const pinMatches = s.doc.getElementById("invite-modal-pin").textContent === activePin;
    const urlContainsPin = s.doc.getElementById("invite-url-text").textContent.includes(activePin);
    allPass = report("Invite Members dialog opens with 6-digit PIN and join link", inviteModalOpened && pinMatches && urlContainsPin) && allPass;

    // Dispatch email invitation via form
    s.doc.getElementById("invite-recipient-name").value = "Maya Patel";
    s.doc.getElementById("invite-recipient-email").value = "maya.patel@example.com";
    s.doc.getElementById("invite-role-select").value = "volunteer";
    s.doc.getElementById("form-send-invite").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(300);
    s = await waitForApp();
    const inviteAlert = s.doc.getElementById("invite-alert");
    const inviteAlertOk = inviteAlert && !inviteAlert.hidden && inviteAlert.classList.contains("success");
    const mayaInRoster = s.app.state.joinedPeople.some((p) => p.name === "Maya Patel");
    allPass = report("SendGrid invitation dispatches and records invited member", inviteAlertOk && mayaInRoster) && allPass;
    s.doc.getElementById("btn-invite-close").click();
    await sleep(100);

    // 15. FEATURE VERIFICATION: Second Person (Sonia Chen) signs up and joins event using 6-Digit PIN
    s.app.logout();
    await sleep(200);
    s = await waitForApp();

    s.doc.getElementById("btn-login-to-signup").click();
    await sleep(150);
    s = await waitForApp();

    const attendeeName = "Sonia Chen";
    s.doc.getElementById("input-signup-name").value = attendeeName;
    s.doc.getElementById("input-signup-email").value = "sonia.chen@example.com";
    s.doc.getElementById("input-signup-password").value = "soniapassword";
    s.doc.getElementById("signup-form").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(400);
    s = await waitForApp();

    // At Gateway, Sonia joins using the active 6-digit PIN
    const pinDigits = s.doc.querySelectorAll(".pin-digit");
    activePin.split("").forEach((d, i) => {
      if (pinDigits[i]) pinDigits[i].value = d;
    });
    s.doc.getElementById("find-event-form").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(400);
    s = await waitForApp();

    const soniaInWorkspace = s.app.currentView === "dashboard" && !s.doc.getElementById("view-workspace").hidden;
    const soniaRecorded = s.app.state.joinedPeople.some((p) => p.name === attendeeName && p.status === "active");
    allPass = report("Second person (Sonia Chen) joins using PIN and appears in event roster", soniaInWorkspace && soniaRecorded) && allPass;

    // 16. FEATURE VERIFICATION: Manager assigns Sonia Chen as Team Leader in Food Coordination
    // Ensure Food Coordination group exists on the newly created event
    if (!s.app.state.groups.some(g => g.id === "grp-food")) {
      s.app.state.groups.push({
        id: "grp-food",
        name: "Food Coordination Group",
        icon: "🥗",
        leaderName: attendeeName,
        memberCount: 1
      });
      s.app.persistState();
    }
    s.app.switchView("assign-roles");
    await sleep(200);
    s = await waitForApp();

    // Manager assigns role and group to Sonia via inline click-to-assign
    const soniaMember = s.app.state.joinedPeople.find((p) => p.name === attendeeName);
    const soniaCard = s.doc.querySelector(`[data-person-id="${soniaMember.id}"]`) ||
      [...s.doc.querySelectorAll(".roster-card")].find((c) => c.textContent.includes(attendeeName));
    if (soniaCard) {
      const header = soniaCard.querySelector(".roster-header") || soniaCard;
      header.click();
      await sleep(150);
      s = await waitForApp();
      const activeCard = s.doc.querySelector(`[data-person-id="${soniaMember.id}"]`) || soniaCard;
      const roleSel = activeCard.querySelector(".roster-role-input");
      const groupSel = activeCard.querySelector(".roster-group-input");
      if (roleSel) roleSel.value = "lead";
      if (groupSel) groupSel.value = "grp-food";
      const saveBtn = activeCard.querySelector(".roster-save-btn");
      if (saveBtn) saveBtn.click();
    } else if (soniaMember) {
      s.app.assignMemberRoleAndGroup(soniaMember.id, "lead", "grp-food");
    }
    await sleep(300);
    s = await waitForApp();

    const updatedSonia = s.app.state.joinedPeople.find((p) => p.name === attendeeName);
    const assignedAsLead = updatedSonia && updatedSonia.role === "lead" && updatedSonia.groupId === "grp-food";
    allPass = report("Manager assigns joined attendee as Team Leader in Food Coordination", !!assignedAsLead) && allPass;

    // 17. FEATURE VERIFICATION: Team Lead Sonia Chen posts in Food Coordination channel
    s.app.auth.setCustomUser({
      id: soniaMember ? soniaMember.id : "usr-sonia",
      name: attendeeName,
      role: "lead",
      assignedGroupId: "grp-food",
      department: "Food Coordination"
    });
    s.app.switchView("groups");
    await sleep(200);
    s = await waitForApp();

    // Select Food channel and post message
    s.app.chatManager.setActiveGroup("grp-food");
    s.app.renderChatChannels();
    s.app.renderChatMessages(s.app.chatManager.getMessages());
    const canPostInFood = !s.doc.getElementById("chat-text-input").disabled;

    const testChatMessage = "Food supplies verified: 250 lunch packets ready for dispatch!";
    s.doc.getElementById("chat-text-input").value = testChatMessage;
    s.doc.getElementById("chat-send-form").dispatchEvent(new s.win.Event("submit", { bubbles: true, cancelable: true }));
    await sleep(300);
    s = await waitForApp();

    const messageSent = s.doc.getElementById("chat-bubbles-scroll").textContent.includes(testChatMessage);
    allPass = report("Assigned Team Leader can post live message in Food Coordination channel", canPostInFood && messageSent) && allPass;

    // 18. FEATURE VERIFICATION: Manager reviews full event stats and programme management
    s.app.auth.setRole("manager");
    s.app.taskManager.addProgramme({
      title: "Opening Ceremony",
      startTime: "09:00",
      endTime: "10:00",
      venue: "Main Hall",
      status: "scheduled"
    });
    s.app.switchView("dashboard");
    await sleep(200);
    s = await waitForApp();

    const totalMembers = Number(s.doc.getElementById("stat-hackers-count").textContent);
    const hasPrograms = Number(s.doc.getElementById("stat-total-prog").textContent) > 0;
    allPass = report("Manager dashboard reflects live multi-user roster count and schedule stats", totalMembers >= 2 && hasPrograms) && allPass;

    // 19. FEATURE VERIFICATION: Expandable AI Chat side drawer via bottom-right floating button
    const aiFab = s.doc.getElementById("btn-ai-fab");
    const aiRail = s.doc.getElementById("ai-rail");
    const fabExists = aiFab && aiFab.textContent.includes("AI Briefing") && aiFab.getAttribute("aria-controls") === "ai-rail";
    const railInitialClosed = aiRail && !aiRail.classList.contains("open") && aiFab.getAttribute("aria-expanded") === "false";
    allPass = report("Floating AI trigger button is present at bottom-right with drawer collapsed by default", !!(fabExists && railInitialClosed)) && allPass;

    // Click FAB to expand AI drawer
    aiFab.click();
    await sleep(250);
    s = await waitForApp();
    const railExpanded = aiRail.classList.contains("open") && aiFab.getAttribute("aria-expanded") === "true";
    allPass = report("Clicking bottom-right button smoothly expands AI drawer", !!railExpanded) && allPass;

    // Close via close button
    const closeBtn = s.doc.getElementById("btn-close-ai");
    if (closeBtn) closeBtn.click();
    await sleep(250);
    s = await waitForApp();
    const railClosedByBtn = !aiRail.classList.contains("open") && aiFab.getAttribute("aria-expanded") === "false";
    allPass = report("Clicking close button collapses AI drawer and resets trigger state", !!railClosedByBtn) && allPass;

    // Expand again and close with Escape key
    aiFab.click();
    await sleep(200);
    s.doc.dispatchEvent(new s.win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(200);
    s = await waitForApp();
    // 20. FEATURE VERIFICATION: Mobile navigation drawer stacking & background blur
    const sidebar = s.doc.getElementById("sidebar");
    const backdrop = s.doc.getElementById("workspace-backdrop");
    s.app.openDrawers("nav");
    await sleep(250);
    s = await waitForApp();

    const sidebarOpen = sidebar && sidebar.classList.contains("open") && sidebar.getAttribute("aria-hidden") === "false";
    const backdropShown = backdrop && !backdrop.hidden && backdrop.classList.contains("show");

    const sidebarZ = s.win.parseInt(s.win.getComputedStyle(sidebar).zIndex, 10);
    const backdropZ = s.win.parseInt(s.win.getComputedStyle(backdrop).zIndex, 10);
    const correctStacking = sidebarZ > backdropZ;

    allPass = report("Opening mobile sidebar positions drawer above blurred backdrop", !!(sidebarOpen && backdropShown && correctStacking)) && allPass;

    // Close sidebar via backdrop click
    if (backdrop) backdrop.click();
    await sleep(300);
    s = await waitForApp();
    const sidebarClosed = sidebar && !sidebar.classList.contains("open") && sidebar.getAttribute("aria-hidden") === "true";
    allPass = report("Clicking blurred backdrop smoothly dismisses sidebar drawer", !!sidebarClosed) && allPass;

    report("overall smoke result", allPass);
  } catch (err) {
    report("smoke harness completed", false, String(err && err.message || err));
  }
}

document.getElementById("run").addEventListener("click", run);
if (document.readyState === "complete") setTimeout(() => { if (!results.childElementCount) run(); }, 800);
else window.addEventListener("load", () => setTimeout(() => { if (!results.childElementCount) run(); }, 800));

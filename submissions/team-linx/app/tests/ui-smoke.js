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

    // 7. REGRESSION: deleting the probe removes exactly that entry (seeds untouched).
    s.app.switchView("create-program");
    await sleep(400);
    s = await waitForApp();
    const countBefore = s.qa("#programs-list .program-card").length;
    const delBtn = s.qa("#programs-list .program-card").map((card) => ({
      card,
      btn: card.querySelector("[data-delete]"),
    })).find((x) => x.card.textContent.includes(probe) && x.btn);
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
      if (!listText.includes(probe)) break;
    }
    const seedsIntact = ["Inauguration", "Cultural Night", "Grand Banquet", "Awards"]
      .every((t) => listText.includes(t));
    allPass = report("delete removes exactly the created probe", !!delBtn && !listText.includes(probe) && countAfter === countBefore - 1 && seedsIntact, `found=${!!delBtn} ${countBefore} -> ${countAfter}`) && allPass;

    // 8. REGRESSION: executive briefing appends instead of crashing.
    s.app.switchView("dashboard");
    await sleep(200);
    s = await waitForApp();
    const threadBefore = s.doc.getElementById("gemini-thread").children.length;
    s.doc.getElementById("btn-ai-briefing").click();
    await sleep(800);
    s = await waitForApp();
    allPass = report("executive briefing appends to AI thread", s.doc.getElementById("gemini-thread").children.length > threadBefore) && allPass;

    // 9. REGRESSION: RBAC enforced per role through the UI (start from manager).
    s.doc.querySelector('.role-btn[data-role="manager"]').click();
    await sleep(300);
    s = await waitForApp();
    s.doc.querySelector('.role-btn[data-role="overseer"]').click();
    await sleep(300);
    s = await waitForApp();
    const overseerLocked = s.doc.getElementById("chat-text-input").disabled
      && !s.doc.getElementById("chat-read-only-banner").hidden
      && s.doc.getElementById("prog-title-inline").disabled;
    allPass = report("overseer is read-only across chat and schedule", overseerLocked) && allPass;
    s.doc.querySelector('.role-btn[data-role="volunteer"]').click();
    await sleep(300);
    s = await waitForApp();
    const channels = s.doc.getElementById("channels-list").textContent;
    const volunteerScoped = !channels.includes("Stage") && channels.includes("Food");
    allPass = report("volunteer sees only assigned plus general channels", volunteerScoped) && allPass;
    s.doc.querySelector('.role-btn[data-role="manager"]').click();
    await sleep(300);
    s = await waitForApp();
    const managerFull = !s.doc.getElementById("chat-text-input").disabled
      && !s.doc.getElementById("prog-title-inline").disabled;
    allPass = report("manager retains full post and schedule rights", managerFull) && allPass;

    report("overall smoke result", allPass);
  } catch (err) {
    report("smoke harness completed", false, String(err && err.message || err));
  }
}

document.getElementById("run").addEventListener("click", run);
if (document.readyState === "complete") setTimeout(() => { if (!results.childElementCount) run(); }, 800);
else window.addEventListener("load", () => setTimeout(() => { if (!results.childElementCount) run(); }, 800));

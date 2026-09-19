// =============================================================================
// SANGAM - Main Application Controller & Workspace Router (vanilla JS, no frameworks)
// Team LINX - Kraft Night 2026
// =============================================================================

import { getLocalState, saveLocalState } from "./config.js";
import { auth } from "./auth.js";
import { taskManager } from "./tasks.js";
import { chatManager } from "./chat.js";
import { aiCoordinator } from "./ai.js";

const WORKSPACE_PAGES = ["dashboard", "assign-roles", "create-program", "groups", "about-event"];
const ALL_VIEWS = ["landing", "gateway", ...WORKSPACE_PAGES];
const PAGE_TITLES = {
  dashboard: "Dashboard",
  "assign-roles": "Assign Roles",
  "create-program": "Create Program",
  groups: "Groups",
  "about-event": "About Event",
};
const AVATAR_COLORS = ["#db2777", "#ea580c", "#7c3aed", "#059669", "#0284c7", "#d97706"];

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialsFor(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name) {
  const s = String(name || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function statusPill(status) {
  if (status === "in_progress") return { cls: "live", label: "Live" };
  if (status === "completed") return { cls: "done", label: "Done" };
  if (status === "delayed") return { cls: "delayed", label: "Delayed" };
  return { cls: "soon", label: "Soon" };
}

function normalizeView(viewId) {
  if (viewId === "chat") return "groups";
  if (ALL_VIEWS.includes(viewId)) return viewId;
  return "landing";
}

class AppController {
  constructor() {
    this.state = getLocalState();
    this.currentView = normalizeView(this.state.activeView || "landing");
    this.selectedProgramId = null;
    this.aiSeeded = false;
    this.lastLiveProgramId = null;
    this.hasScrolledInitialTimeline = false;
    this.userIsScrollingTimeline = false;
    this.timelineScrollTimeout = null;
  }

  init() {
    auth.onUserChange((user) => this.handleUserRoleChanged(user));
    this.bindViewNavigation();
    this.bindGatewayForms();
    this.bindWorkspaceForms();
    this.bindChatSystem();
    this.bindGeminiAssistant();
    this.bindSessionPopover();
    this.bindTimelineAutoScroll();
    taskManager.onProgrammesChange(() => {
      this.renderDashboard();
      this.renderProgramsPage();
      this.renderAbout();
      this.updateStats();
    });
    this.updateHeaderDate();
    this.switchView(this.currentView, { skipSave: true });
    this.updateEventDisplay();
    this.updateStats();

    // Live real-time tick: updates navbar clock and auto-refreshes schedule status on minute turnover
    setInterval(() => {
      this.updateHeaderDate();
      taskManager.syncStatusesWithRealTime();
    }, 1000);
  }

  // ------------------------------------------------------------------ routing
  // Single write path: sync manager-owned slices before persisting so page
  // navigation or roster edits never overwrite fresh programmes/messages
  // with the stale copies held on this.state.
  persistState() {
    this.state.programmes = taskManager.getProgrammes();
    this.state.messages = chatManager.messages;
    this.state.currentUser = auth.getCurrentUser();
    saveLocalState(this.state);
  }

  switchView(viewId, opts = {}) {
    const next = normalizeView(viewId);
    this.currentView = next;
    if (!opts.skipSave) {
      this.state.activeView = next;
      this.persistState();
    } else {
      this.state.activeView = next;
    }

    const landing = document.getElementById("view-landing");
    const gateway = document.getElementById("view-gateway");
    const workspace = document.getElementById("view-workspace");
    const inWorkspace = WORKSPACE_PAGES.includes(next);
    if (landing) {
      landing.classList.toggle("active", next === "landing");
      landing.hidden = next !== "landing";
    }
    if (gateway) {
      gateway.classList.toggle("active", next === "gateway");
      gateway.hidden = next !== "gateway";
    }
    if (workspace) {
      workspace.classList.toggle("active", inWorkspace);
      workspace.hidden = !inWorkspace;
    }

    WORKSPACE_PAGES.forEach((page) => {
      const el = document.getElementById(`page-${page}`);
      if (el) el.hidden = page !== next;
    });

    const contentEl = document.getElementById("workspace-content");
    if (contentEl) {
      contentEl.classList.toggle("groups-view-active", next === "groups");
    }

    document.querySelectorAll("[data-workspace-page]").forEach((btn) => {
      const active = btn.dataset.workspacePage === next;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    const titleEl = document.getElementById("workspace-page-title");
    if (titleEl && PAGE_TITLES[next]) titleEl.textContent = PAGE_TITLES[next];

    if (inWorkspace) this.renderWorkspacePage(next);
    if (next === "dashboard") {
      requestAnimationFrame(() => this.scrollToLiveEvent(false, true));
    }
    this.closeDrawers();
    const scroller = document.getElementById("workspace-content");
    if (scroller) scroller.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  }

  switchWorkspacePage(page) {
    this.switchView(page);
  }

  renderWorkspacePage(page) {
    if (page === "dashboard") this.renderDashboard();
    if (page === "assign-roles") this.renderAssignRoles();
    if (page === "create-program") this.renderProgramsPage();
    if (page === "groups") {
      this.renderChatChannels();
      this.renderChatMessages(chatManager.getMessages());
    }
    if (page === "about-event") this.renderAbout();
  }

  bindViewNavigation() {
    const go = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    };
    go("hero-get-started-btn", () => this.switchView("gateway"));
    go("hero-demo-login-btn", () => this.switchView("dashboard"));
    go("btn-side-back-gateway", () => {
      this.closePopover();
      this.switchView("gateway");
    });
    document.querySelectorAll("[data-workspace-page]").forEach((btn) => {
      btn.addEventListener("click", () => this.switchWorkspacePage(btn.dataset.workspacePage));
    });
    go("btn-open-nav", () => this.openDrawers("nav"));
    go("btn-close-nav", () => this.closeDrawers("btn-close-nav"));
    go("btn-open-ai", () => this.openDrawers("ai"));
    go("btn-close-ai", () => this.closeDrawers("btn-close-ai"));
    const backdrop = document.getElementById("workspace-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => this.closeDrawers());
      backdrop.addEventListener("pointerdown", () => this.closeDrawers());
    }
    this.bindDrawerSwipe();
    this.bindKeyboardAvoidance();

    document.querySelectorAll(".role-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        auth.setRole(btn.dataset.role);
        this.syncRoleButtons();
      });
    });

    const copyBtn = document.getElementById("btn-copy-code");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const code = this.state.currentEvent?.sixDigitCode || "";
        if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeDrawers();
        this.closePopover();
      }
    });
  }

  openDrawers(which) {
    const sidebar = document.getElementById("sidebar");
    const rail = document.getElementById("ai-rail");
    const backdrop = document.getElementById("workspace-backdrop");
    const navBtn = document.getElementById("btn-open-nav");
    const aiBtn = document.getElementById("btn-open-ai");
    this.lastDrawerFocus = document.activeElement;
    if (which === "nav" && sidebar) {
      sidebar.classList.add("open");
      sidebar.setAttribute("aria-hidden", "false");
      sidebar.setAttribute("aria-modal", "true");
    }
    if (which === "ai" && rail) {
      rail.classList.add("open");
      rail.setAttribute("aria-hidden", "false");
      rail.setAttribute("aria-modal", "true");
    }
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.classList.add("show");
    }
    document.body.classList.add("lock-scroll");
    if (navBtn) navBtn.setAttribute("aria-expanded", which === "nav" ? "true" : "false");
    if (aiBtn) aiBtn.setAttribute("aria-expanded", which === "ai" ? "true" : "false");
    // Move focus into the opened drawer for AT / keyboard users.
    const target = which === "nav" ? sidebar : rail;
    const focusable = target ? target.querySelector("button:not([disabled]), input, select, a[href]") : null;
    if (focusable && window.matchMedia("(max-width: 1180px)").matches) {
      setTimeout(() => { try { focusable.focus({ preventScroll: true }); } catch {} }, 60);
    }
  }

  closeDrawers(returnFocusTo) {
    const sidebar = document.getElementById("sidebar");
    const rail = document.getElementById("ai-rail");
    const backdrop = document.getElementById("workspace-backdrop");
    const wasOpen = (sidebar && sidebar.classList.contains("open")) || (rail && rail.classList.contains("open"));
    if (sidebar) {
      sidebar.classList.remove("open");
      sidebar.setAttribute("aria-hidden", "true");
      sidebar.removeAttribute("aria-modal");
    }
    if (rail) {
      rail.classList.remove("open");
      rail.setAttribute("aria-hidden", "true");
      rail.removeAttribute("aria-modal");
    }
    if (backdrop) {
      backdrop.classList.remove("show");
      backdrop.hidden = true;
    }
    document.body.classList.remove("lock-scroll");
    const navBtn = document.getElementById("btn-open-nav");
    const aiBtn = document.getElementById("btn-open-ai");
    if (navBtn) navBtn.setAttribute("aria-expanded", "false");
    if (aiBtn) aiBtn.setAttribute("aria-expanded", "false");
    if (wasOpen) {
      const fallback = document.getElementById(returnFocusTo) || this.lastDrawerFocus;
      if (fallback && document.contains(fallback)) {
        try { fallback.focus({ preventScroll: true }); } catch {}
      }
      this.lastDrawerFocus = null;
    }
  }

  bindDrawerSwipe() {
    if (this.drawerSwipeBound) return;
    this.drawerSwipeBound = true;
    let startX = null;
    let startY = null;
    document.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null;
      startY = null;
      if (Math.abs(dy) > 60 || Math.abs(dx) < 70) return;
      const sidebar = document.getElementById("sidebar");
      const rail = document.getElementById("ai-rail");
      if (dx < 0 && sidebar && sidebar.classList.contains("open")) this.closeDrawers();
      if (dx > 0 && rail && rail.classList.contains("open")) this.closeDrawers();
    }, { passive: true });
    // Android system Back closes drawer first via history trap.
    window.addEventListener("popstate", () => this.closeDrawers());
  }

  bindKeyboardAvoidance() {
    if (this.keyboardBound) return;
    this.keyboardBound = true;
    ["chat-text-input", "gemini-prompt-input"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("focus", () => {
        setTimeout(() => {
          try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch {}
        }, 250);
      });
    });
    if (window.visualViewport) {
      let t = null;
      window.visualViewport.addEventListener("resize", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const active = document.activeElement;
          if (active && (active.id === "chat-text-input" || active.id === "gemini-prompt-input")) {
            try { active.scrollIntoView({ block: "nearest" }); } catch {}
          }
        }, 100);
      });
    }
  }

  bindSessionPopover() {
    const btn = document.getElementById("profile-btn");
    const pop = document.getElementById("profile-popover");
    const close = document.getElementById("btn-profile-close");
    if (!btn || !pop) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = pop.hidden;
      pop.hidden = !willOpen;
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) this.syncRoleButtons();
    });
    if (close) close.addEventListener("click", () => this.closePopover());
    if (!this.popoverOutsideBound) {
      this.popoverOutsideBound = true;
      document.addEventListener("pointerdown", (e) => {
        const p = document.getElementById("profile-popover");
        const b = document.getElementById("profile-btn");
        if (!p || p.hidden) return;
        if (p.contains(e.target) || (b && b.contains(e.target))) return;
        this.closePopover();
      });
    }
  }

  closePopover() {
    const pop = document.getElementById("profile-popover");
    const btn = document.getElementById("profile-btn");
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  syncRoleButtons() {
    const role = auth.getCurrentUser()?.role;
    document.querySelectorAll(".role-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.role === role);
    });
  }

  updateHeaderDate() {
    const el = document.getElementById("header-datetime");
    if (!el) return;
    try {
      const now = new Date();
      const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const text = `${date} · ${time}`;
      if (el.textContent !== text) {
        el.textContent = text;
      }
    } catch {
      el.textContent = "Sep 19, 2026 · 10:23 AM";
    }
  }

  // ------------------------------------------------------------- entry forms
  bindGatewayForms() {
    const createForm = document.getElementById("create-event-form");
    if (createForm) {
      createForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("input-event-title");
        const title = (input?.value || "").trim() || "Kraft Night 2026";
        const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
        this.state.currentEvent = {
          id: "evt-" + Date.now(),
          title,
          sixDigitCode: randomCode,
          venue: "Main Auditorium & Campus",
          status: "active",
          created_at: new Date().toISOString(),
        };
        auth.setRole("manager");
        this.syncRoleButtons();
        this.persistState();
        this.updateEventDisplay();
        this.switchView("dashboard");
      });
    }

    const pinInputs = document.querySelectorAll(".pin-digit");
    pinInputs.forEach((input, index) => {
      input.addEventListener("input", () => {
        const digits = input.value.replace(/[^0-9]/g, "");
        if (digits.length > 1) {
          // Paste / autofill split across boxes (mobile SMS code).
          digits.slice(0, pinInputs.length - index).split("").forEach((d, k) => {
            if (pinInputs[index + k]) pinInputs[index + k].value = d;
          });
          const next = pinInputs[Math.min(index + digits.length, pinInputs.length - 1)];
          if (next) next.focus();
          return;
        }
        input.value = digits.slice(0, 1);
        if (input.value.length === 1 && index < pinInputs.length - 1) pinInputs[index + 1].focus();
      });
      input.addEventListener("keydown", (e) => {
        if ((e.key === "Backspace" || e.key === "Delete") && !input.value && index > 0) {
          e.preventDefault();
          pinInputs[index - 1].focus();
          pinInputs[index - 1].value = "";
        }
        if (e.key === "ArrowLeft" && index > 0) pinInputs[index - 1].focus();
        if (e.key === "ArrowRight" && index < pinInputs.length - 1) pinInputs[index + 1].focus();
      });
      input.addEventListener("focus", () => { try { input.select(); } catch {} });
      input.addEventListener("paste", (e) => {
        const text = (e.clipboardData ? e.clipboardData.getData("text") : "") || "";
        const digits = text.replace(/[^0-9]/g, "");
        if (!digits) return;
        e.preventDefault();
        digits.slice(0, pinInputs.length - index).split("").forEach((d, k) => {
          if (pinInputs[index + k]) pinInputs[index + k].value = d;
        });
        const next = pinInputs[Math.min(index + digits.length, pinInputs.length - 1)];
        if (next) next.focus();
      });
    });

    const findForm = document.getElementById("find-event-form");
    if (findForm) {
      findForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const code = Array.from(pinInputs).map((i) => i.value).join("");
        if (code.length < 6) {
          alert("Please enter a valid 6-digit Event Code.");
          return;
        }
        const newAttendee = {
          id: "usr-" + Date.now(),
          name: "Guest Attendee (" + code.slice(-3) + ")",
          email: `guest${code.slice(-3)}@kraft.org`,
          role: "volunteer",
          roleBadge: "Awaiting Assignment",
          groupId: null,
          groupName: "Unassigned",
          status: "active",
          joinedAt: "Just now",
        };
        this.state.joinedPeople.unshift(newAttendee);
        this.persistState();
        this.renderAssignRoles();
        this.renderAbout();
        this.updateStats();
        this.switchView("dashboard");
      });
    }
  }

  // ---------------------------------------------------------- workspace forms
  bindWorkspaceForms() {
    const assignForm = document.getElementById("form-assign-inline");
    if (assignForm) {
      assignForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!auth.canAssignRoles()) {
          alert("Permission Denied: Only the Event Manager can assign roles.");
          return;
        }
        const nameInput = document.getElementById("assign-new-name");
        const memberSelect = document.getElementById("assign-member-select");
        const roleSelect = document.getElementById("assign-role-select-inline");
        const groupSelect = document.getElementById("assign-group-select-inline");
        const newName = (nameInput?.value || "").trim();
        const role = roleSelect?.value || "volunteer";
        const groupId = groupSelect?.value || "";
        const group = this.state.groups.find((g) => g.id === groupId) || null;

        if (newName) {
          const person = {
            id: "usr-" + Date.now(),
            name: newName,
            email: `${newName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@kraft.org`,
            role,
            roleBadge: this.roleBadgeFor(role),
            groupId: groupId || null,
            groupName: group ? group.name : "Unassigned",
            status: "active",
            joinedAt: "Just now",
          };
          this.state.joinedPeople.unshift(person);
          if (nameInput) nameInput.value = "";
        } else if (memberSelect?.value) {
          const person = this.state.joinedPeople.find((p) => p.id === memberSelect.value);
          if (!person) return;
          person.role = role;
          person.roleBadge = this.roleBadgeFor(role);
          person.groupId = groupId || null;
          person.groupName = group ? group.name : "Unassigned";
          // Keep live chat permissions in sync when the reassigned member
          // is the currently active persona (e.g. Athul moved to Stage).
          if (person.id === auth.getCurrentUser()?.id) auth.setAssignedGroupId(groupId || null);
        } else {
          alert("Enter a full name or select an existing member.");
          return;
        }
        this.persistState();
        this.renderAssignRoles();
        this.renderDashboard();
        this.renderAbout();
      });
    }

    const programForm = document.getElementById("form-create-program-inline");
    if (programForm) {
      programForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = document.getElementById("prog-title-inline")?.value.trim() || "";
        const venue = document.getElementById("prog-venue-inline")?.value.trim() || "";
        const start = document.getElementById("prog-start-inline")?.value.trim() || "";
        const end = document.getElementById("prog-end-inline")?.value.trim() || "";
        const desc = document.getElementById("prog-desc-inline")?.value.trim() || "";
        if (!title) {
          alert("Program name is required.");
          return;
        }
        const created = taskManager.addProgramme({
          title,
          startTime: start || "18:00",
          endTime: end || "19:00",
          venue: venue || "Main Stage",
          description: desc,
          status: "scheduled",
        });
        if (created) {
          programForm.reset();
          this.selectedProgramId = created.id;
        }
      });
    }

    const groupForm = document.getElementById("form-create-group-inline");
    if (groupForm) {
      groupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!auth.canCreateGroup()) {
          alert("Permission Denied: Only the Event Manager can create operational groups.");
          return;
        }
        const name = document.getElementById("group-name-inline")?.value.trim() || "";
        const icon = document.getElementById("group-icon-inline")?.value.trim() || "👥";
        const leader = document.getElementById("group-leader-inline")?.value.trim() || "TBD";
        const desc = document.getElementById("group-desc-inline")?.value.trim() || "";
        if (!name) {
          alert("Team name is required.");
          return;
        }
        const newGroup = {
          id: "grp-" + Date.now(),
          name,
          icon,
          leaderName: leader,
          description: desc,
          memberCount: 5,
        };
        this.state.groups.push(newGroup);
        this.persistState();
        chatManager.setActiveGroup(newGroup.id);
        groupForm.reset();
        const iconField = document.getElementById("group-icon-inline");
        if (iconField) iconField.value = "📸";
        this.renderChatChannels();
        this.renderAbout();
        this.updateStats();
      });
    }
  }

  roleBadgeFor(role) {
    if (role === "manager") return "Event Manager";
    if (role === "overseer") return "VIP Overseer (Principal)";
    if (role === "lead") return "Team Leader";
    return "Volunteer";
  }

  // --------------------------------------------------------------- dashboard
  renderDashboard() {
    const list = document.getElementById("timeline-list");
    const programmes = taskManager.getProgrammes();
    const live = programmes.find((p) => p.status === "in_progress");
    if (!this.selectedProgramId || (live && !programmes.find((p) => p.id === this.selectedProgramId))) {
      this.selectedProgramId = (live || programmes[0] || {}).id || null;
    }
    if (list) {
      list.innerHTML = "";
      if (programmes.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No programmes scheduled yet. Use Create Program to add the first item.";
        list.appendChild(empty);
      }
      programmes.forEach((prog, index) => {
        const pill = statusPill(prog.status);
        const isLive = prog.status === "in_progress";
        const isActive = prog.id === this.selectedProgramId;
        const row = document.createElement("div");
        row.className = `timeline-row${isActive ? " active" : ""}${isLive ? " is-live" : ""}${prog.status === "completed" ? " dim" : ""}`;
        row.setAttribute("role", "listitem");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-label", `${prog.title} — ${pill.label}. Activate to view assignments.`);
        if (isActive) row.setAttribute("aria-current", "true");
        if (isLive) row.setAttribute("data-live", "true");
        const dotColor = isLive ? "#ef4444" : prog.status === "completed" ? "#d1d5db" : prog.status === "delayed" ? "#f59e0b" : "#8b5cf6";
        const people = (prog.leadGroup ? this.state.joinedPeople.filter((m) => m.groupName === prog.leadGroup).slice(0, 4) : []).map((m) => `
          <span class="mini-person"><span class="avatar" style="color:${esc(colorFor(m.name))}">${esc(initialsFor(m.name))}</span><span>${esc(m.name)}</span><span class="role">${esc(m.roleBadge || m.role)}</span></span>
        `).join("");
        row.innerHTML = `
          <div class="timeline-rail" aria-hidden="true">
            <span class="timeline-dot" style="background:${dotColor};${isLive ? "box-shadow:0 0 0 4px #fee2e2;" : ""}"></span>
            ${index < programmes.length - 1 ? '<span class="timeline-line"></span>' : ""}
          </div>
          <div class="timeline-body${isLive ? " live-event" : ""}">
            <div class="timeline-top">
              <span class="timeline-name">${esc(prog.title)}</span>
              ${auth.canEditProgramme()
                ? `<button type="button" class="pill ${pill.cls}" data-cycle="${esc(prog.id)}" title="Manager: click to cycle status">${esc(pill.label)}</button>`
                : `<span class="pill ${pill.cls}">${esc(pill.label)}</span>`}
            </div>
            <div class="timeline-meta"><span>${esc(prog.startTime || "")}</span><span>·</span><span>${esc(prog.endTime || "")}</span><span>·</span><span>${esc(prog.venue || "")}</span></div>
            ${isActive && people ? `<div class="timeline-people">${people}</div>` : ""}
            ${isActive && auth.canEditProgramme() ? `<div class="status-row"><button type="button" class="btn-light btn-small" data-cycle="${esc(prog.id)}">Advance status</button></div>` : ""}
          </div>
        `;
        const selectRow = () => {
          this.selectedProgramId = prog.id;
          this.renderDashboard();
        };
        row.addEventListener("click", (e) => {
          const cycleBtn = e.target.closest("[data-cycle]");
          if (cycleBtn) {
            e.stopPropagation();
            taskManager.cycleProgrammeStatus(cycleBtn.dataset.cycle);
            return;
          }
          selectRow();
        });
        row.addEventListener("keydown", (e) => {
          if (e.target.closest("[data-cycle]")) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectRow();
          }
        });
        list.appendChild(row);
      });
    }
    this.renderAssignedPanel();
    this.updateLiveBadges();

    // Auto-scroll timeline to live event
    const currentLiveId = (programmes.find((p) => p.status === "in_progress") || {}).id || null;
    const shouldScroll = this.lastLiveProgramId !== currentLiveId || !this.hasScrolledInitialTimeline;
    if (shouldScroll && currentLiveId) {
      this.lastLiveProgramId = currentLiveId;
      this.hasScrolledInitialTimeline = true;
      requestAnimationFrame(() => {
        this.scrollToLiveEvent(true);
      });
    }
  }

  bindTimelineAutoScroll() {
    const list = document.getElementById("timeline-list");
    if (!list) return;

    this.userIsScrollingTimeline = false;
    this.timelineScrollTimeout = null;

    const onUserScroll = () => {
      this.userIsScrollingTimeline = true;
      if (this.timelineScrollTimeout) clearTimeout(this.timelineScrollTimeout);
      this.timelineScrollTimeout = setTimeout(() => {
        this.userIsScrollingTimeline = false;
      }, 5000);
    };

    list.addEventListener("wheel", onUserScroll, { passive: true });
    list.addEventListener("touchmove", onUserScroll, { passive: true });
    list.addEventListener("pointerdown", onUserScroll, { passive: true });
  }

  scrollToLiveEvent(smooth = true, force = false) {
    const list = document.getElementById("timeline-list");
    if (!list) return;
    if (this.userIsScrollingTimeline && !force) return;

    const targetRow = list.querySelector(".timeline-row.is-live") || list.querySelector(".timeline-row.active");
    if (!targetRow) return;

    const listRect = list.getBoundingClientRect();
    const targetRect = targetRow.getBoundingClientRect();
    const currentScrollTop = list.scrollTop;
    const targetScrollTop = currentScrollTop + (targetRect.top - listRect.top) - (list.clientHeight / 2) + (targetRow.clientHeight / 2);

    list.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: smooth ? "smooth" : "auto"
    });
  }

  renderAssignedPanel() {
    const programmes = taskManager.getProgrammes();
    const active = programmes.find((p) => p.id === this.selectedProgramId) || programmes[0];
    const nameEl = document.getElementById("assigned-program-name");
    const box = document.getElementById("assigned-roles-list");
    if (nameEl) nameEl.textContent = active ? active.title : "No programme selected";
    if (!box) return;
    box.innerHTML = "";
    if (!active) {
      box.innerHTML = '<p class="empty">No programmes available.</p>';
      return;
    }
    const assigned = active.leadGroup
      ? this.state.joinedPeople.filter((m) => m.groupName === active.leadGroup)
      : [];
    if (assigned.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = active.leadGroup
        ? `No roster members are currently grouped under ${active.leadGroup}.`
        : "No lead group is set for this programme.";
      box.appendChild(p);
      return;
    }
    assigned.slice(0, 8).forEach((person) => {
      const row = document.createElement("div");
      row.className = "assigned-row";
      row.innerHTML = `
        <span class="avatar" style="color:${esc(colorFor(person.name))}">${esc(initialsFor(person.name))}</span>
        <div style="flex:1;min-width:0"><strong>${esc(person.name)}</strong><span>${esc(person.roleBadge || person.role)} · ${esc(person.groupName || "Unassigned")}</span></div>
      `;
      box.appendChild(row);
    });
  }

  updateLiveBadges() {
    const hasLive = taskManager.getProgrammes().some((p) => p.status === "in_progress");
    ["header-live-badge", "dashboard-live-badge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = hasLive ? "inline-flex" : "none";
    });
  }

  // ------------------------------------------------------------ assign roles
  renderAssignRoles() {
    const memberSelect = document.getElementById("assign-member-select");
    const groupSelect = document.getElementById("assign-group-select-inline");
    const roleSelect = document.getElementById("assign-role-select-inline");
    const submit = document.getElementById("assign-submit-btn");
    const hint = document.getElementById("assign-form-hint");
    const canAssign = auth.canAssignRoles();

    if (memberSelect) {
      const current = memberSelect.value;
      memberSelect.innerHTML = '<option value="">Select a member to update</option>' +
        this.state.joinedPeople.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.roleBadge || p.role)}</option>`).join("");
      if ([...memberSelect.options].some((o) => o.value === current)) memberSelect.value = current;
    }
    if (groupSelect) {
      groupSelect.innerHTML = '<option value="">No group (General)</option>' +
        this.state.groups.map((g) => `<option value="${esc(g.id)}">${esc(g.icon || "👥")} ${esc(g.name)}</option>`).join("");
    }
    ["assign-new-name", "assign-member-select", "assign-role-select-inline", "assign-group-select-inline"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !canAssign;
    });
    if (submit) {
      submit.disabled = !canAssign;
      submit.textContent = canAssign ? "Add Member" : "Manager only";
    }
    if (hint) hint.textContent = canAssign ? "New names create roster entries; selecting a member updates that entry." : "Only the Event Manager can assign roles and groups.";
    if (roleSelect && !roleSelect.value) roleSelect.value = "volunteer";

    const list = document.getElementById("joined-people-list");
    if (!list) return;
    list.innerHTML = "";
    if (this.state.joinedPeople.length === 0) {
      list.innerHTML = '<p class="empty">No members have joined yet.</p>';
      return;
    }
    this.state.joinedPeople.forEach((person) => {
      const card = document.createElement("div");
      card.className = "roster-card";
      card.setAttribute("role", "listitem");
      card.innerHTML = `
        <span class="avatar" style="color:${esc(colorFor(person.name))}">${esc(initialsFor(person.name))}</span>
        <div class="roster-main">
          <div class="roster-name">${esc(person.name)}</div>
          <div class="roster-tags"><span class="pill neutral">${esc(person.roleBadge || person.role)}</span><span class="pill neutral">${esc(person.groupName || "Unassigned")}</span></div>
        </div>
        ${canAssign ? `<button type="button" class="remove-btn" data-remove="${esc(person.id)}">Remove</button>` : ""}
      `;
      const removeBtn = card.querySelector("[data-remove]");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          this.state.joinedPeople = this.state.joinedPeople.filter((p) => p.id !== person.id);
          this.persistState();
          this.renderAssignRoles();
          this.renderDashboard();
          this.renderAbout();
          this.updateStats();
        });
      }
      list.appendChild(card);
    });
  }

  // ------------------------------------------------------------ create program
  renderProgramsPage() {
    const list = document.getElementById("programs-list");
    const canCreate = auth.canCreateProgramme();
    ["prog-title-inline", "prog-venue-inline", "prog-start-inline", "prog-end-inline", "prog-desc-inline"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !canCreate;
    });
    const formBtn = document.querySelector("#form-create-program-inline button[type=submit]");
    if (formBtn) {
      formBtn.disabled = !canCreate;
      formBtn.textContent = canCreate ? "Add to Schedule" : "Manager only";
    }
    const hint = document.getElementById("program-form-hint");
    if (hint) hint.textContent = canCreate ? "New entries appear here and on the Dashboard timeline." : "Only the Event Manager can schedule programs.";
    if (!list) return;
    list.innerHTML = "";
    const programmes = taskManager.getProgrammes();
    if (programmes.length === 0) {
      list.innerHTML = '<p class="empty">No programmes scheduled yet.</p>';
      return;
    }
    programmes.forEach((prog) => {
      const pill = statusPill(prog.status);
      const row = document.createElement("div");
      row.className = "program-card";
      row.setAttribute("role", "listitem");
      row.innerHTML = `
        <div class="program-main">
          <div class="program-name">${esc(prog.title)}</div>
          <div class="program-sub"><span>${esc(prog.startTime || "")}</span><span>·</span><span>${esc(prog.endTime || "")}</span><span>·</span><span>${esc(prog.venue || "")}</span></div>
        </div>
        <div class="program-actions">
          ${canCreate ? `<button type="button" class="pill ${pill.cls}" data-cycle="${esc(prog.id)}" title="Cycle status">${esc(pill.label)}</button><button type="button" class="remove-btn" data-delete="${esc(prog.id)}">Delete</button>`
            : `<span class="pill ${pill.cls}">${esc(pill.label)}</span>`}
        </div>
      `;
      const cycle = row.querySelector("[data-cycle]");
      if (cycle) cycle.addEventListener("click", () => taskManager.cycleProgrammeStatus(prog.id));
      const del = row.querySelector("[data-delete]");
      if (del) del.addEventListener("click", () => {
        // Native confirm is system-sized on mobile and keeps ui-smoke hook
        // (test stubs confirm()->true). Two-tap arm as fallback if blocked.
        try {
          if (window.confirm(`Remove "${prog.title}" from the schedule?`)) taskManager.deleteProgramme(prog.id);
          return;
        } catch {}
        if (del.dataset.armed === "1") {
          taskManager.deleteProgramme(prog.id);
          return;
        }
        del.dataset.armed = "1";
        del.textContent = "Tap to confirm";
        setTimeout(() => { if (del.isConnected) { del.dataset.armed = ""; del.textContent = "Delete"; } }, 3000);
      });
      list.appendChild(row);
    });
  }

  // ------------------------------------------------------------------- groups
  bindChatSystem() {
    chatManager.onChatUpdate((messages) => this.renderChatMessages(messages));
    const form = document.getElementById("chat-send-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("chat-text-input");
        const text = (input?.value || "").trim();
        if (!text) return;
        const sent = chatManager.sendMessage(text);
        if (sent && input) input.value = "";
      });
    }
  }

  renderChatChannels() {
    const list = document.getElementById("channels-list");
    const count = document.getElementById("groups-count");
    const canCreate = auth.canCreateGroup();
    ["group-name-inline", "group-icon-inline", "group-leader-inline", "group-desc-inline"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !canCreate;
    });
    const groupBtn = document.querySelector("#form-create-group-inline button[type=submit]");
    if (groupBtn) {
      groupBtn.disabled = !canCreate;
      groupBtn.textContent = canCreate ? "Register Team" : "Manager only";
    }
    const hint = document.getElementById("group-form-hint");
    if (hint) hint.textContent = canCreate ? "New teams immediately get a chat channel." : "Only the Event Manager can create operational groups.";

    if (count) count.textContent = `${this.state.groups.length} teams registered`;
    const messagesByGroup = chatManager.messages || {};
    if (list) {
      list.innerHTML = "";
      const visible = this.state.groups.filter((g) => auth.canViewGroup(g.id));
      if (visible.length === 0) {
        list.innerHTML = '<p class="empty">No channels are visible for this role.</p>';
      }
      visible.forEach((group) => {
        const msgs = messagesByGroup[group.id] || [];
        const last = msgs[msgs.length - 1];
        const active = group.id === chatManager.getActiveGroupId();
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `group-btn${active ? " active" : ""}`;
        const previewText = last ? `${last.senderName}: ${last.text}` : (group.description || "No messages yet");
        btn.innerHTML = `
          <span class="group-top">
            <span class="group-name" title="${esc(group.name)}">${esc(group.icon || "👥")} ${esc(group.name)}</span>
            <span class="pill neutral">${esc(String(group.memberCount || 10))} members</span>
          </span>
          <span class="group-preview" title="${esc(previewText)}">${esc(previewText)}</span>
        `;
        btn.addEventListener("click", () => {
          chatManager.setActiveGroup(group.id);
          this.renderChatChannels();
          this.renderChatMessages(chatManager.getMessages());
        });
        list.appendChild(btn);
      });
    }
    const activeGroup = this.state.groups.find((g) => g.id === chatManager.getActiveGroupId()) || this.state.groups[0];
    if (activeGroup && chatManager.getActiveGroupId() !== activeGroup.id) chatManager.setActiveGroup(activeGroup.id);
    this.updateActiveChatHeader(activeGroup);
    this.updateChatPermissionsUI();
  }

  updateActiveChatHeader(group) {
    const titleEl = document.getElementById("chat-active-group-name");
    const metaEl = document.getElementById("chat-active-group-meta");
    const inputEl = document.getElementById("chat-text-input");
    const avatars = document.getElementById("chat-header-avatars");
    if (!group) {
      if (titleEl) titleEl.textContent = "Select a group";
      if (metaEl) metaEl.textContent = "No operational groups available";
      return;
    }
    if (titleEl) titleEl.textContent = group.name;
    if (metaEl) metaEl.textContent = `${group.icon || "👥"} ${group.memberCount || 10} members · Lead: ${group.leaderName || "TBD"}`;
    if (inputEl) inputEl.placeholder = `Message ${group.name}…`;
    if (avatars) {
      const members = this.state.joinedPeople.filter((m) => m.groupId === group.id).slice(0, 4);
      avatars.innerHTML = members.map((m) => `<span class="avatar" title="${esc(m.name)}" style="color:${esc(colorFor(m.name))}">${esc(initialsFor(m.name))}</span>`).join("");
    }
  }

  updateChatPermissionsUI() {
    const activeGroupId = chatManager.getActiveGroupId();
    const group = this.state.groups.find((g) => g.id === activeGroupId);
    if (group) this.updateActiveChatHeader(group);
    const canPost = auth.canPostInGroup(activeGroupId);
    const banner = document.getElementById("chat-read-only-banner");
    const input = document.getElementById("chat-text-input");
    const submit = document.getElementById("chat-submit-btn");
    if (banner && input && submit) {
      if (canPost) {
        banner.hidden = true;
        input.disabled = false;
        submit.disabled = false;
      } else {
        banner.hidden = false;
        banner.textContent = auth.isOverseer()
          ? "Read-only observer mode: VIP Overseers cannot post messages."
          : "Department isolation: you can read this channel but can only post in your assigned group.";
        input.disabled = true;
        submit.disabled = true;
      }
    }
  }

  renderChatMessages(messages) {
    const container = document.getElementById("chat-bubbles-scroll");
    if (!container) return;
    // Preserve scroll: only jump to bottom if user was already near bottom
    // (avoids yanking the Groups directory header off-screen on mobile).
    const nearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 120;
    const firstRender = !container.dataset.rendered;
    // Only render the active chat page content; container exists even when hidden.
    container.innerHTML = "";
    container.dataset.rendered = "1";
    const currentUser = auth.getCurrentUser();
    if (!messages || messages.length === 0) {
      container.innerHTML = '<p class="empty">No messages yet. Start the coordination here.</p>';
      return;
    }
    messages.forEach((msg) => {
      const mine = msg.senderId === currentUser.id;
      const row = document.createElement("div");
      row.className = `msg-row${mine ? " mine" : ""}`;
      row.innerHTML = `
        ${mine ? "" : `<span class="avatar" style="color:${esc(colorFor(msg.senderName))}">${esc(initialsFor(msg.senderName))}</span>`}
        <div><div class="msg-bubble">${esc(msg.text)}</div><div class="msg-meta">${esc(mine ? "You" : msg.senderName)} · ${esc(msg.time || "")}</div></div>
      `;
      container.appendChild(row);
    });
    if (firstRender || nearBottom || document.activeElement?.id === "chat-text-input") {
      container.scrollTop = container.scrollHeight;
    }
  }

  // --------------------------------------------------------------------- about
  renderAbout() {
    const evt = this.state.currentEvent || {};
    const programmes = taskManager.getProgrammes();
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("about-event-title", evt.title || "Kraft Night 2026");
    set("about-event-sub", `${evt.title || "Kraft Night 2026"} · Unified event command center`);
    set("about-field-title", evt.title || "Kraft Night 2026");
    set("about-field-venue", evt.venue || "Main Campus & Auditorium");
    set("about-field-pin", evt.sixDigitCode || "—");
    set("about-field-status", evt.status || "active");
    set("about-field-programs", `${programmes.length} scheduled`);
    set("about-field-members", `${this.state.joinedPeople.length} joined`);

    const groupsBox = document.getElementById("about-groups-list");
    if (groupsBox) {
      groupsBox.innerHTML = "";
      if (this.state.groups.length === 0) groupsBox.innerHTML = '<p class="empty">No operational groups yet.</p>';
      this.state.groups.forEach((g) => {
        const pill = document.createElement("span");
        pill.className = "pill neutral";
        pill.textContent = `${g.icon || "👥"} ${g.name}`;
        groupsBox.appendChild(pill);
      });
    }

    const orgBox = document.getElementById("about-organizers-list");
    if (orgBox) {
      orgBox.innerHTML = "";
      const manager = this.state.joinedPeople.find((p) => p.role === "manager");
      const rows = [
        { name: manager ? manager.name : auth.getCurrentUser()?.name || "Event Manager", role: "Lead Organizer" },
        ...this.state.groups.slice(0, 8).map((g) => ({ name: `${g.name} — ${g.leaderName || "TBD"}`, role: "Group Lead" })),
      ];
      rows.forEach((r) => {
        const row = document.createElement("div");
        row.className = "org-row";
        row.innerHTML = `<span style="font-size:14px;font-weight:500"></span><span class="pill neutral"></span>`;
        row.firstChild.textContent = r.name;
        row.lastChild.textContent = r.role;
        orgBox.appendChild(row);
      });
    }

    const sub = document.getElementById("dashboard-schedule-sub");
    if (sub && evt.title) sub.textContent = `${evt.title} · Live programme timeline`;
  }

  // ------------------------------------------------------------------------ AI
  bindGeminiAssistant() {
    this.seedAiThread();
    document.querySelectorAll(".ai-chip, .chip").forEach((chip) => {
      if (chip.dataset.bound) return;
      chip.dataset.bound = "true";
      chip.addEventListener("click", () => {
        const prompt = chip.dataset.prompt;
        if (prompt) this.submitGeminiPrompt(prompt);
      });
    });
    const form = document.getElementById("gemini-input-form");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("gemini-prompt-input");
        const prompt = (input?.value || "").trim();
        if (!prompt) return;
        if (input) input.value = "";
        this.submitGeminiPrompt(prompt);
      });
    }
    const briefingBtn = document.getElementById("btn-ai-briefing");
    if (briefingBtn && !briefingBtn.dataset.bound) {
      briefingBtn.dataset.bound = "true";
      briefingBtn.addEventListener("click", async () => {
        const briefing = await aiCoordinator.generateStatusBriefing(taskManager.getProgrammes());
        this.appendAiMessage("bot", `Status: ${briefing.status} · Completion ${briefing.completionRate}. ${briefing.summary} Next: ${briefing.nextActions[0] || "Monitor the live programme."}`);
      });
    }
  }

  seedAiThread() {
    if (this.aiSeeded) return;
    const thread = document.getElementById("gemini-thread");
    if (!thread || thread.childElementCount > 0) {
      this.aiSeeded = true;
      return;
    }
    this.aiSeeded = true;
    this.appendAiMessage("bot", "Hi! I'm your event AI assistant. Ask me about schedules, teams, roles, or event logistics.");
    this.appendAiMessage("bot", "Competition is live. Ask for schedule, teams, roles, or an executive status briefing.");
  }

  appendAiMessage(from, text) {
    const thread = document.getElementById("gemini-thread");
    if (!thread) return;
    const row = document.createElement("div");
    row.className = `ai-msg ${from}`;
    row.innerHTML = `
      ${from === "bot" ? '<span class="ai-avatar">✦</span>' : ""}
      <div class="ai-bubble"></div>
    `;
    row.querySelector(".ai-bubble").textContent = text;
    thread.appendChild(row);
    thread.scrollTop = thread.scrollHeight;
  }

  async submitGeminiPrompt(promptText) {
    const thread = document.getElementById("gemini-thread");
    if (!thread || !promptText.trim()) return;
    this.appendAiMessage("user", promptText.trim());
    this.appendAiMessage("bot", "Thinking and checking the live event state…");
    const loading = thread.lastChild;
    const eventContext = {
      eventTitle: this.state.currentEvent?.title,
      eventCode: this.state.currentEvent?.sixDigitCode,
      programmes: taskManager.getProgrammes(),
      groups: this.state.groups,
    };
    try {
      const response = await aiCoordinator.askGemini(promptText, eventContext);
      if (loading) loading.remove();
      this.appendAiMessage("bot", String(response || "I could not generate a briefing right now."));
    } catch (err) {
      if (loading) loading.remove();
      this.appendAiMessage("bot", "AI is temporarily unavailable. The local briefing fallback remains ready.");
    }
  }

  // ------------------------------------------------------------------ session
  handleUserRoleChanged(user) {
    const nameEl = document.getElementById("user-name-display");
    const deptEl = document.getElementById("user-dept-display");
    const badgeEl = document.getElementById("user-role-badge");
    const initialsEl = document.getElementById("user-avatar-initials");
    if (nameEl) nameEl.textContent = user.name;
    if (deptEl) deptEl.textContent = user.department || user.roleLabel || user.role;
    if (badgeEl) {
      badgeEl.textContent = user.role.toUpperCase();
      badgeEl.className = `role-tag role-${user.role}`;
    }
    if (initialsEl) {
      initialsEl.textContent = initialsFor(user.name);
      initialsEl.style.color = colorFor(user.name);
    }
    this.syncRoleButtons();
    this.renderAssignRoles();
    this.renderProgramsPage();
    this.renderChatChannels();
    this.renderChatMessages(chatManager.getMessages());
    this.updateChatPermissionsUI();
  }

  updateEventDisplay() {
    const evt = this.state.currentEvent || {};
    const titleEl = document.getElementById("side-event-title");
    const codeEl = document.getElementById("side-event-code");
    const navCodeEl = document.getElementById("nav-code-display");
    if (titleEl) titleEl.textContent = evt.title || "Kraft Night 2026";
    if (codeEl) codeEl.textContent = `PIN: ${evt.sixDigitCode || "—"}`;
    if (navCodeEl) navCodeEl.textContent = evt.sixDigitCode || "—";
    this.renderAbout();
  }

  updateStats() {
    const stats = taskManager.getStats();
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("stat-total-prog", String(taskManager.getProgrammes().length));
    set("stat-completed-prog", String(stats.completed));
    set("stat-teams-count", String(this.state.groups.length));
    set("stat-hackers-count", String(this.state.joinedPeople.length));
    set("stat-in-progress-prog", String(stats.inProgress));
    set("stat-delayed-prog", String(stats.delayed));
    set("stat-completion-rate", `${stats.completionRate}%`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new AppController();
  app.init();
  window.sangamApp = app;
});

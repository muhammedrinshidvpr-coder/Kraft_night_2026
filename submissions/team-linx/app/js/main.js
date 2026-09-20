// =============================================================================
// SANGAM - Main Application Controller & Workspace Router (vanilla JS, no frameworks)
// Team LINX - Kraft Night 2026
// =============================================================================

import { getLocalState, saveLocalState, createDefaultGeneralGroup } from "./config.js";
import { auth } from "./auth.js";
import { taskManager } from "./tasks.js";
import { chatManager } from "./chat.js";
import { aiCoordinator } from "./ai.js";
import { emailService } from "./email.js";

const WORKSPACE_PAGES = ["dashboard", "assign-roles", "create-program", "groups", "about-event"];
const ALL_VIEWS = ["landing", "login", "signup", "gateway", ...WORKSPACE_PAGES];
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
    this.auth = auth;
    this.chatManager = chatManager;
    this.taskManager = taskManager;
    this.state = getLocalState();
    this.currentView = normalizeView(this.state.activeView || "landing");
    this.selectedProgramId = null;
    this.aiSeeded = false;
    this.aiDraft = null;
    this.lastLiveProgramId = null;
    this.hasScrolledInitialTimeline = false;
    this.userIsScrollingTimeline = false;
    this.timelineScrollTimeout = null;
    this.activeAssignMemberId = null;
  }

  init() {
    auth.onUserChange((user) => this.handleUserRoleChanged(user));
    this.bindViewNavigation();
    this.bindAuthForms();
    this.bindInviteModal();
    this.checkUrlPinParam();
    this.bindEntryEffects();
    this.bindGatewayForms();
    this.bindWorkspaceForms();
    this.bindChatSystem();
    this.bindGeminiAssistant();
    this.updateAiAccess();
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
    const login = document.getElementById("view-login");
    const signup = document.getElementById("view-signup");
    const gateway = document.getElementById("view-gateway");
    const workspace = document.getElementById("view-workspace");
    const inWorkspace = WORKSPACE_PAGES.includes(next);
    if (landing) {
      landing.classList.toggle("active", next === "landing");
      landing.hidden = next !== "landing";
    }
    if (login) {
      login.classList.toggle("active", next === "login");
      login.hidden = next !== "login";
      if (next === "login") {
        const alertEl = document.getElementById("login-alert");
        if (alertEl) alertEl.hidden = true;
        const input = document.getElementById("input-login-name");
        if (input) setTimeout(() => input.focus(), 60);
      }
    }
    if (signup) {
      signup.classList.toggle("active", next === "signup");
      signup.hidden = next !== "signup";
      if (next === "signup") {
        const alertEl = document.getElementById("signup-alert");
        if (alertEl) alertEl.hidden = true;
        const input = document.getElementById("input-signup-name");
        if (input) setTimeout(() => input.focus(), 60);
      }
    }
    if (gateway) {
      gateway.classList.toggle("active", next === "gateway");
      gateway.hidden = next !== "gateway";
      this.updateGatewayUserDisplay();
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
    go("hero-get-started-btn", () => this.switchView("signup"));
    go("nav-signup-btn", () => this.switchView("signup"));
    go("nav-login-btn", () => this.switchView("login"));
    go("btn-login-to-landing", () => this.switchView("landing"));
    go("btn-login-to-signup", () => this.switchView("signup"));
    go("btn-signup-to-landing", () => this.switchView("landing"));
    go("btn-signup-to-login", () => this.switchView("login"));
    go("btn-gateway-to-landing", () => this.switchView("landing"));
    go("btn-gateway-back", () => this.switchView("login"));
    document.querySelectorAll('[data-goto="landing"]').forEach((btn) => {
      btn.addEventListener("click", () => this.switchView("landing"));
    });
    go("btn-side-back-gateway", () => {
      this.closePopover();
      this.switchView("gateway");
    });
    go("btn-logout", () => this.logout());
    go("btn-sidebar-logout", () => this.logout());
    document.querySelectorAll("[data-workspace-page]").forEach((btn) => {
      btn.addEventListener("click", () => this.switchWorkspacePage(btn.dataset.workspacePage));
    });
    go("btn-open-nav", () => this.openDrawers("nav"));
    go("btn-close-nav", () => this.closeDrawers("btn-close-nav"));
    go("btn-open-ai", () => this.openDrawers("ai"));
    go("btn-ai-fab", () => this.openDrawers("ai"));
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
        const labelEl = document.getElementById("btn-copy-label") || copyBtn;
        labelEl.textContent = "Copied!";
        setTimeout(() => { labelEl.textContent = "Copy"; }, 2000);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeDrawers();
        this.closePopover();
        this.closeEditProgramModal();
        const inviteModal = document.getElementById("invite-member-modal");
        if (inviteModal) inviteModal.hidden = true;
      }
    });
  }

  bindAuthForms() {
    const loginForm = document.getElementById("login-form");
    const loginAlert = document.getElementById("login-alert");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("input-login-name");
        const passInput = document.getElementById("input-login-password");
        const name = nameInput ? nameInput.value.trim() : "";
        const password = passInput ? passInput.value : "";

        if (loginAlert) {
          loginAlert.hidden = true;
          loginAlert.className = "entry-auth-alert";
        }

        try {
          const user = await auth.signIn({ name, password });
          if (loginAlert) {
            loginAlert.textContent = `Welcome back, ${user.name}!`;
            loginAlert.className = "entry-auth-alert success";
            loginAlert.hidden = false;
          }
          setTimeout(() => {
            this.updateGatewayUserDisplay();
            this.switchView("gateway");
          }, 350);
        } catch (err) {
          if (loginAlert) {
            loginAlert.textContent = err.message || "Failed to log in.";
            loginAlert.className = "entry-auth-alert error";
            loginAlert.hidden = false;
          }
        }
      });
    }

    const signupForm = document.getElementById("signup-form");
    const signupAlert = document.getElementById("signup-alert");
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("input-signup-name");
        const emailInput = document.getElementById("input-signup-email");
        const passInput = document.getElementById("input-signup-password");

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const password = passInput ? passInput.value : "";

        if (signupAlert) {
          signupAlert.hidden = true;
          signupAlert.className = "entry-auth-alert";
        }

        try {
          const user = await auth.signUp({ name, email, password });
          if (signupAlert) {
            signupAlert.textContent = `Account created! Welcome, ${user.name}.`;
            signupAlert.className = "entry-auth-alert success";
            signupAlert.hidden = false;
          }
          setTimeout(() => {
            this.updateGatewayUserDisplay();
            this.switchView("gateway");
          }, 350);
        } catch (err) {
          if (signupAlert) {
            signupAlert.textContent = err.message || "Failed to create account.";
            signupAlert.className = "entry-auth-alert error";
            signupAlert.hidden = false;
          }
        }
      });
    }
  }

  updateGatewayUserDisplay() {
    const user = auth.getCurrentUser();
    const nameEl = document.getElementById("gateway-active-user-name");
    if (nameEl) {
      nameEl.textContent = user ? `${user.name} (${(user.role || "manager").toUpperCase()})` : "—";
    }
  }

  bindInviteModal() {
    const modal = document.getElementById("invite-member-modal");
    const openBtn = document.getElementById("btn-open-invite");
    const assignBtn = document.getElementById("btn-assign-invite");
    const closeBtn = document.getElementById("btn-invite-close");
    const cancelBtn = document.getElementById("btn-invite-cancel");
    const copyLinkBtn = document.getElementById("btn-copy-invite-link");
    const sendForm = document.getElementById("form-send-invite");
    const alertEl = document.getElementById("invite-alert");
    const groupSelect = document.getElementById("invite-group-select");

    const open = () => {
      if (!modal) return;
      modal.hidden = false;
      const code = this.state.currentEvent?.sixDigitCode || "482910";
      const pinEl = document.getElementById("invite-modal-pin");
      if (pinEl) pinEl.textContent = code;

      const urlText = document.getElementById("invite-url-text");
      const joinUrl = `${window.location.origin}${window.location.pathname}?pin=${code}`;
      if (urlText) urlText.textContent = joinUrl;

      if (groupSelect) {
        groupSelect.innerHTML = '<option value="">Unassigned (Select later)</option>';
        (this.state.groups || []).forEach((g) => {
          const opt = document.createElement("option");
          opt.value = g.id;
          opt.textContent = `${g.icon || "👥"} ${g.name}`;
          groupSelect.appendChild(opt);
        });
      }
      if (alertEl) alertEl.hidden = true;
    };

    const close = () => {
      if (modal) modal.hidden = true;
    };

    if (openBtn) openBtn.addEventListener("click", open);
    if (assignBtn) assignBtn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (cancelBtn) cancelBtn.addEventListener("click", close);

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener("click", () => {
        const code = this.state.currentEvent?.sixDigitCode || "482910";
        const joinUrl = `${window.location.origin}${window.location.pathname}?pin=${code}`;
        const copyText = `Join "${this.state.currentEvent?.title || "Sangam Event"}": ${joinUrl} (PIN: ${code})`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(copyText).catch(() => {});
        }
        const label = document.getElementById("copy-invite-link-label");
        if (label) {
          label.textContent = "Copied Link & PIN!";
          setTimeout(() => { label.textContent = "Copy Invite Link & PIN"; }, 2000);
        }
      });
    }

    if (sendForm) {
      sendForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("invite-recipient-name");
        const emailInput = document.getElementById("invite-recipient-email");
        const roleSelect = document.getElementById("invite-role-select");
        const name = (nameInput?.value || "").trim();
        const email = (emailInput?.value || "").trim();
        const role = roleSelect?.value || "volunteer";
        const groupId = groupSelect?.value || "";
        const group = this.state.groups.find((g) => g.id === groupId);
        const department = group ? group.name : "General Team";

        if (alertEl) {
          alertEl.hidden = true;
          alertEl.className = "entry-auth-alert";
        }

        try {
          const res = await emailService.sendInvitation({ email, name, role, department });
          if (alertEl) {
            alertEl.textContent = res.message || `Invitation email dispatched to ${email}!`;
            alertEl.className = "entry-auth-alert success";
            alertEl.hidden = false;
          }

          // Pre-seed into joinedPeople roster as 'invited' so manager sees them immediately
          const invitedPerson = {
            id: "usr-" + Date.now(),
            name: name,
            email: email,
            role: role,
            roleBadge: role === "lead" ? "Team Leader" : (role === "overseer" ? "VIP Overseer" : "Volunteer"),
            groupId: groupId || null,
            groupName: department,
            status: "invited",
            joinedAt: "Invitation sent"
          };
          this.state.joinedPeople.unshift(invitedPerson);
          this.persistState();
          this.renderAssignRoles();
          this.renderAbout();
          this.updateStats();

          if (nameInput) nameInput.value = "";
          if (emailInput) emailInput.value = "";
        } catch (err) {
          if (alertEl) {
            alertEl.textContent = err.message || "Failed to send invitation.";
            alertEl.className = "entry-auth-alert error";
            alertEl.hidden = false;
          }
        }
      });
    }
  }

  checkUrlPinParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const pin = params.get("pin");
      if (pin && pin.length === 6) {
        const pinInputs = document.querySelectorAll(".pin-digit");
        if (pinInputs.length === 6) {
          pin.split("").forEach((d, i) => {
            if (pinInputs[i]) pinInputs[i].value = d;
          });
        }
      }
    } catch (e) {
      console.warn("Could not check URL pin param:", e);
    }
  }

  bindEntryEffects() {
    if (this.entryEffectsBound) return;
    this.entryEffectsBound = true;
    const WORDS = ["Seamless.", "Vibrant.", "Memorable.", "Together."];
    let wordIdx = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onScroll = () => {
      const scrolled = window.scrollY > 10;
      document.querySelectorAll(".entry-new .entry-nav").forEach((nav) => {
        nav.classList.toggle("scrolled", scrolled);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (reduceMotion) return;
    setInterval(() => {
      if (document.hidden) return;
      if (!["landing", "gateway"].includes(this.currentView)) return;
      const el = document.getElementById("rotating-word");
      if (!el) return;
      el.classList.add("is-fading");
      setTimeout(() => {
        wordIdx = (wordIdx + 1) % WORDS.length;
        el.textContent = WORDS[wordIdx];
        el.classList.remove("is-fading");
      }, 400);
    }, 2400);
  }

  openDrawers(which) {
    const sidebar = document.getElementById("sidebar");
    const rail = document.getElementById("ai-rail");
    const backdrop = document.getElementById("workspace-backdrop");
    const navBtn = document.getElementById("btn-open-nav");
    const aiBtn = document.getElementById("btn-open-ai");
    const aiFab = document.getElementById("btn-ai-fab");
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
      document.body.classList.add("ai-drawer-open");
    }
    if (backdrop) {
      backdrop.hidden = false;
      requestAnimationFrame(() => {
        backdrop.classList.add("show");
      });
    }
    document.body.classList.add("lock-scroll");
    if (navBtn) navBtn.setAttribute("aria-expanded", which === "nav" ? "true" : "false");
    if (aiBtn) aiBtn.setAttribute("aria-expanded", which === "ai" ? "true" : "false");
    if (aiFab) aiFab.setAttribute("aria-expanded", which === "ai" ? "true" : "false");

    // Move focus into the opened drawer for AT / keyboard users.
    if (which === "ai") {
      const input = document.getElementById("gemini-prompt-input");
      setTimeout(() => {
        try { if (input) input.focus({ preventScroll: true }); } catch {}
      }, 100);
    } else {
      const target = sidebar;
      const focusable = target ? target.querySelector("button:not([disabled]), input, select, a[href]") : null;
      if (focusable) {
        setTimeout(() => { try { focusable.focus({ preventScroll: true }); } catch {} }, 60);
      }
    }
  }

  closeDrawers(returnFocusTo) {
    const sidebar = document.getElementById("sidebar");
    const rail = document.getElementById("ai-rail");
    const backdrop = document.getElementById("workspace-backdrop");
    const aiFab = document.getElementById("btn-ai-fab");
    const wasAiOpen = rail && rail.classList.contains("open");
    const wasOpen = (sidebar && sidebar.classList.contains("open")) || wasAiOpen;
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
    document.body.classList.remove("ai-drawer-open");
    if (backdrop) {
      backdrop.classList.remove("show");
      setTimeout(() => {
        if (!backdrop.classList.contains("show")) {
          backdrop.hidden = true;
        }
      }, 240);
    }
    document.body.classList.remove("lock-scroll");
    const navBtn = document.getElementById("btn-open-nav");
    const aiBtn = document.getElementById("btn-open-ai");
    if (navBtn) navBtn.setAttribute("aria-expanded", "false");
    if (aiBtn) aiBtn.setAttribute("aria-expanded", "false");
    if (aiFab) aiFab.setAttribute("aria-expanded", "false");
    if (wasOpen) {
      const fallback = document.getElementById(returnFocusTo) || (wasAiOpen ? aiFab : null) || this.lastDrawerFocus;
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
      if (willOpen) {
        this.syncRoleButtons();
        const curUser = auth.getCurrentUser();
        if (curUser) this.handleUserRoleChanged(curUser);
        this.updateEventDisplay();
      }
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

  logout() {
    this.closePopover();
    this.closeDrawers();
    auth.logout();
    this.switchView("login");
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
        const title = (input?.value || "").trim();
        if (!title) {
          alert("Please enter an event title.");
          return;
        }
        const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
        let currentUser = auth.getCurrentUser();
        if (!currentUser) {
          this.switchView("login");
          return;
        }

        if (currentUser.role !== "manager") {
          currentUser = { ...currentUser, role: "manager", department: "Event Organizer" };
          auth.setCustomUser(currentUser);
        }

        const newEvent = {
          id: "evt-" + Date.now(),
          title,
          sixDigitCode: randomCode,
          venue: "TBD",
          status: "active",
          created_at: new Date().toISOString(),
          manager_id: currentUser.id,
          manager_name: currentUser.name,
        };

        const generalGroup = createDefaultGeneralGroup(currentUser.id, currentUser.name);

        const managerMember = {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email || `${currentUser.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@sangam.app`,
          role: "manager",
          roleBadge: "Event Manager",
          groupId: generalGroup.id,
          groupName: generalGroup.name,
          status: "active",
          joinedAt: "Organizer",
          avatar: currentUser.avatar
        };

        this.state.currentEvent = newEvent;
        this.state.programmes = [];
        this.state.groups = [generalGroup];
        this.state.joinedPeople = [managerMember];
        this.state.messages = { [generalGroup.id]: [] };

        taskManager.setProgrammes([]);
        chatManager.setActiveGroup(generalGroup.id);
        chatManager.setMessages({ [generalGroup.id]: [] });

        try {
          const allEvents = JSON.parse(localStorage.getItem("sangam_all_events") || "[]");
          allEvents.push(newEvent);
          localStorage.setItem("sangam_all_events", JSON.stringify(allEvents));
        } catch (err) {
          console.warn("Could not save to sangam_all_events:", err);
        }

        this.syncRoleButtons();
        this.persistState();
        this.updateEventDisplay();
        this.renderDashboard();
        this.renderAssignRoles();
        this.renderProgramsPage();
        this.renderChatChannels();
        this.renderAbout();
        this.updateStats();
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
        const alertEl = document.getElementById("join-event-alert");
        if (alertEl) alertEl.hidden = true;

        const code = Array.from(pinInputs).map((i) => i.value).join("");
        if (code.length < 6) {
          if (alertEl) {
            alertEl.textContent = "Please enter a valid 6-digit Event Code.";
            alertEl.className = "entry-auth-alert error";
            alertEl.hidden = false;
          } else {
            alert("Please enter a valid 6-digit Event Code.");
          }
          return;
        }

        const currentUser = auth.getCurrentUser();
        if (!currentUser || !currentUser.name) {
          if (alertEl) {
            alertEl.textContent = "Please log in or sign up first to join this event with your account.";
            alertEl.className = "entry-auth-alert error";
            alertEl.hidden = false;
          }
          sessionStorage.setItem("sangam_pending_pin", code);
          setTimeout(() => this.switchView("login"), 1200);
          return;
        }

        let foundEvent = null;
        if (this.state.currentEvent && this.state.currentEvent.sixDigitCode === code) {
          foundEvent = this.state.currentEvent;
        } else {
          try {
            const allEvents = JSON.parse(localStorage.getItem("sangam_all_events") || "[]");
            foundEvent = allEvents.find((ev) => ev.sixDigitCode === code);
          } catch {}
        }

        if (!foundEvent && !this.state.currentEvent) {
          if (alertEl) {
            alertEl.textContent = `No active event found with code ${code}. Please check the PIN or create a new event.`;
            alertEl.className = "entry-auth-alert error";
            alertEl.hidden = false;
          }
          return;
        }

        if (foundEvent) {
          this.state.currentEvent = foundEvent;
        }

        const newAttendee = {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email || `${currentUser.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@sangam.app`,
          role: currentUser.role === "manager" ? "manager" : "volunteer",
          roleBadge: currentUser.role === "manager" ? "Event Manager" : "Volunteer",
          groupId: currentUser.assignedGroupId || (this.state.groups[0]?.id || null),
          groupName: this.state.groups[0]?.name || "General Announcements",
          status: "active",
          joinedAt: "Just now",
          avatar: currentUser.avatar
        };

        const existingIdx = this.state.joinedPeople.findIndex(
          (p) => p.id === newAttendee.id || p.name.toLowerCase() === newAttendee.name.toLowerCase()
        );
        if (existingIdx >= 0) {
          this.state.joinedPeople[existingIdx] = { ...this.state.joinedPeople[existingIdx], status: "active" };
        } else {
          this.state.joinedPeople.unshift(newAttendee);
        }

        if (this.state.currentEvent) {
          this.state.currentEvent.sixDigitCode = code;
        }
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

    const editProgramForm = document.getElementById("form-edit-program");
    if (editProgramForm) {
      editProgramForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const progId = document.getElementById("edit-prog-id")?.value;
        const title = document.getElementById("edit-prog-title")?.value.trim() || "";
        const venue = document.getElementById("edit-prog-venue")?.value.trim() || "";
        const start = document.getElementById("edit-prog-start")?.value.trim() || "";
        const end = document.getElementById("edit-prog-end")?.value.trim() || "";
        const desc = document.getElementById("edit-prog-desc")?.value.trim() || "";
        const status = document.getElementById("edit-prog-status")?.value || "scheduled";

        if (!title) {
          alert("Program name is required.");
          return;
        }

        const updated = taskManager.updateProgramme(progId, {
          title,
          venue,
          startTime: start,
          endTime: end,
          description: desc,
          status,
        });

        if (updated) {
          this.closeEditProgramModal();
        }
      });
    }

    const closeEditBtn = document.getElementById("btn-edit-program-close");
    if (closeEditBtn) {
      closeEditBtn.addEventListener("click", () => this.closeEditProgramModal());
    }

    const cancelEditBtn = document.getElementById("btn-edit-program-cancel");
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", () => this.closeEditProgramModal());
    }

    const editModalBackdrop = document.getElementById("edit-program-modal");
    if (editModalBackdrop) {
      editModalBackdrop.addEventListener("click", (e) => {
        if (e.target === editModalBackdrop) this.closeEditProgramModal();
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
  assignMemberRoleAndGroup(personId, role, groupId) {
    const person = this.state.joinedPeople.find((p) => p.id === personId);
    if (!person) return false;
    const group = this.state.groups.find((g) => g.id === groupId) || null;
    person.role = role;
    person.roleBadge = this.roleBadgeFor(role);
    person.groupId = groupId || null;
    person.groupName = group ? group.name : "Unassigned";

    // Keep live chat permissions in sync when the reassigned member
    // is the currently active persona (e.g. Athul moved to Stage).
    if (person.id === auth.getCurrentUser()?.id) {
      auth.setAssignedGroupId(groupId || null);
    }

    this.persistState();
    this.renderAssignRoles();
    this.renderDashboard();
    this.renderAbout();
    this.updateStats();
    return true;
  }

  renderAssignRoles() {
    const canAssign = auth.canAssignRoles();
    const list = document.getElementById("joined-people-list");
    if (!list) return;
    list.innerHTML = "";

    if (!this.state.joinedPeople || this.state.joinedPeople.length === 0) {
      list.innerHTML = '<p class="empty">No members have joined yet.</p>';
      return;
    }

    this.state.joinedPeople.forEach((person) => {
      const isExpanded = canAssign && this.activeAssignMemberId === person.id;
      const card = document.createElement("div");
      card.className = `roster-card ${canAssign ? "is-clickable" : ""} ${isExpanded ? "is-expanded" : ""}`;
      card.setAttribute("role", "listitem");
      card.dataset.personId = person.id;

      const groupOptions = [
        '<option value="">No group (General)</option>',
        ...this.state.groups.map(
          (g) => `<option value="${esc(g.id)}" ${person.groupId === g.id ? "selected" : ""}>${esc(g.icon || "👥")} ${esc(g.name)}</option>`
        ),
      ].join("");

      card.innerHTML = `
        <div class="roster-header">
          <span class="avatar" style="color:${esc(colorFor(person.name))}">${esc(initialsFor(person.name))}</span>
          <div class="roster-main">
            <div class="roster-name">${esc(person.name)}</div>
            <div class="roster-tags">
              <span class="pill neutral">${esc(person.roleBadge || this.roleBadgeFor(person.role))}</span>
              <span class="pill neutral">${esc(person.groupName || "Unassigned")}</span>
            </div>
          </div>
          ${canAssign ? `
            <div class="roster-action-hint">
              <span class="roster-edit-badge">${isExpanded ? "Close" : "Assign"}</span>
              <span class="roster-chevron" aria-hidden="true">›</span>
            </div>
          ` : ""}
        </div>
        ${isExpanded ? `
          <div class="roster-inline-editor">
            <div class="roster-editor-grid">
              <div class="field">
                <label for="assign-role-${esc(person.id)}">Role</label>
                <select id="assign-role-${esc(person.id)}" class="roster-role-input">
                  <option value="volunteer" ${person.role === "volunteer" ? "selected" : ""}>Worker / Volunteer</option>
                  <option value="lead" ${person.role === "lead" ? "selected" : ""}>Team Leader (Group Organiser)</option>
                  <option value="overseer" ${person.role === "overseer" ? "selected" : ""}>VIP / Overseer (Read-Only Principal)</option>
                  <option value="manager" ${person.role === "manager" ? "selected" : ""}>Event Manager (Full Admin)</option>
                </select>
              </div>
              <div class="field">
                <label for="assign-group-${esc(person.id)}">Operational group</label>
                <select id="assign-group-${esc(person.id)}" class="roster-group-input">
                  ${groupOptions}
                </select>
              </div>
            </div>
            <div class="roster-editor-actions">
              <button type="button" class="btn-dark btn-small roster-save-btn">Save</button>
              <button type="button" class="btn-light btn-small roster-cancel-btn">Cancel</button>
              <button type="button" class="remove-btn roster-remove-btn" data-remove="${esc(person.id)}">Remove Member</button>
            </div>
          </div>
        ` : ""}
      `;

      if (canAssign) {
        const header = card.querySelector(".roster-header");
        if (header) {
          header.addEventListener("click", () => {
            this.activeAssignMemberId = this.activeAssignMemberId === person.id ? null : person.id;
            this.renderAssignRoles();
          });
        }

        if (isExpanded) {
          const editor = card.querySelector(".roster-inline-editor");
          if (editor) {
            editor.addEventListener("click", (e) => e.stopPropagation());
          }

          const saveBtn = card.querySelector(".roster-save-btn");
          if (saveBtn) {
            saveBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              const roleInput = card.querySelector(".roster-role-input");
              const groupInput = card.querySelector(".roster-group-input");
              const role = roleInput ? roleInput.value : "volunteer";
              const groupId = groupInput ? groupInput.value : "";
              this.activeAssignMemberId = null;
              this.assignMemberRoleAndGroup(person.id, role, groupId);
            });
          }

          const cancelBtn = card.querySelector(".roster-cancel-btn");
          if (cancelBtn) {
            cancelBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              this.activeAssignMemberId = null;
              this.renderAssignRoles();
            });
          }

          const removeBtn = card.querySelector(".roster-remove-btn");
          if (removeBtn) {
            removeBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              try {
                if (window.confirm && !window.confirm(`Remove ${person.name} from the event?`)) return;
              } catch {}
              this.state.joinedPeople = this.state.joinedPeople.filter((p) => p.id !== person.id);
              if (this.activeAssignMemberId === person.id) this.activeAssignMemberId = null;
              this.persistState();
              this.renderAssignRoles();
              this.renderDashboard();
              this.renderAbout();
              this.updateStats();
            });
          }
        }
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
          ${canCreate ? `<button type="button" class="pill ${pill.cls}" data-cycle="${esc(prog.id)}" title="Cycle status">${esc(pill.label)}</button><button type="button" class="edit-btn" data-edit="${esc(prog.id)}">Edit</button><button type="button" class="remove-btn" data-delete="${esc(prog.id)}">Delete</button>`
            : `<span class="pill ${pill.cls}">${esc(pill.label)}</span>`}
        </div>
      `;
      const cycle = row.querySelector("[data-cycle]");
      if (cycle) cycle.addEventListener("click", () => taskManager.cycleProgrammeStatus(prog.id));
      const edit = row.querySelector("[data-edit]");
      if (edit) edit.addEventListener("click", () => this.openEditProgramModal(prog.id));
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

  openEditProgramModal(progId) {
    if (!auth.canEditProgramme()) {
      alert("Permission Denied: Only the Event Manager can edit scheduled programmes.");
      return;
    }
    const programmes = taskManager.getProgrammes();
    const prog = programmes.find((p) => p.id === progId);
    if (!prog) return;

    const modal = document.getElementById("edit-program-modal");
    const idInput = document.getElementById("edit-prog-id");
    const titleInput = document.getElementById("edit-prog-title");
    const venueInput = document.getElementById("edit-prog-venue");
    const startInput = document.getElementById("edit-prog-start");
    const endInput = document.getElementById("edit-prog-end");
    const descInput = document.getElementById("edit-prog-desc");
    const statusSelect = document.getElementById("edit-prog-status");

    if (idInput) idInput.value = prog.id;
    if (titleInput) titleInput.value = prog.title || "";
    if (venueInput) venueInput.value = prog.venue || "";
    if (startInput) startInput.value = prog.startTime || "";
    if (endInput) endInput.value = prog.endTime || "";
    if (descInput) descInput.value = prog.description || "";
    if (statusSelect) statusSelect.value = prog.status || "scheduled";

    if (modal) {
      modal.hidden = false;
      document.body.classList.add("lock-scroll");
      setTimeout(() => {
        if (titleInput) titleInput.focus();
      }, 50);
    }
  }

  closeEditProgramModal() {
    const modal = document.getElementById("edit-program-modal");
    if (modal) {
      modal.hidden = true;
      document.body.classList.remove("lock-scroll");
    }
    const form = document.getElementById("form-edit-program");
    if (form) form.reset();
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
    const evt = this.state.currentEvent;
    const programmes = taskManager.getProgrammes();
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("about-event-title", evt ? evt.title : "Event Overview");
    set("about-event-sub", evt ? `${evt.title} · Unified event command center` : "Unified event command center");
    set("about-field-title", evt ? evt.title : "—");
    set("about-field-venue", evt ? (evt.venue || "TBD") : "—");
    set("about-field-pin", evt ? evt.sixDigitCode : "—");
    set("about-field-status", evt ? evt.status : "active");
    set("about-field-programs", `${programmes.length} scheduled`);
    set("about-field-members", `${this.state.joinedPeople ? this.state.joinedPeople.length : 0} joined`);

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
      const manager = (this.state.joinedPeople || []).find((p) => p.role === "manager");
      const rows = [
        { name: manager ? manager.name : auth.getCurrentUser()?.name || "Event Manager", role: "Lead Organizer" },
        ...(this.state.groups || []).slice(0, 8).map((g) => ({ name: `${g.name} — ${g.leaderName || "TBD"}`, role: "Group Lead" })),
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
    if (sub) sub.textContent = evt?.title ? `${evt.title} · Live programme timeline` : "Live programme timeline";
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
        this.setAiStatus("Live event data", "local");
        this.appendAiMessage("bot", `Status: ${briefing.status}. Completion ${briefing.completionRate}. ${briefing.summary}`, "Live event data");
      });
    }

    const forceBtn = document.getElementById("btn-ai-force");
    if (forceBtn && !forceBtn.dataset.bound) {
      forceBtn.dataset.bound = "true";
      forceBtn.addEventListener("click", () => {
        const input = document.getElementById("gemini-prompt-input");
        const prompt = (input?.value || "").trim();
        if (!prompt) {
          if (input) {
            input.placeholder = "Describe the plan or draft Gemini should create…";
            input.focus();
          }
          return;
        }
        if (input) input.value = "";
        this.submitGeminiPrompt(prompt, { forceGemini: true });
      });
    }

    const gatewayPlanBtn = document.getElementById("btn-plan-event");
    if (gatewayPlanBtn && !gatewayPlanBtn.dataset.bound) {
      gatewayPlanBtn.dataset.bound = "true";
      gatewayPlanBtn.addEventListener("click", () => {
        if (!auth.canRunAIBriefing()) return;
        const title = (document.getElementById("input-event-title")?.value || "new event").trim();
        this.switchView("dashboard");
        this.openDrawers("ai");
        this.submitGeminiPrompt(`Create an event plan for ${title} with appropriate groups, role slots, and programmes.`);
      });
    }

    const planPreview = document.getElementById("ai-plan-preview");
    if (planPreview && !planPreview.dataset.bound) {
      planPreview.dataset.bound = "true";
      planPreview.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target.id !== "btn-ai-plan-confirm") return;
        this.confirmAiBlueprint();
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
    this.appendAiMessage("bot", "Manager assistant ready. Factual questions use live event data; planning requests use Gemini after secure sign-in.", "Live event data");
  }

  setAiStatus(label, source = "local") {
    const status = document.getElementById("ai-source-status");
    if (!status) return;
    status.textContent = `● ${label}`;
    status.dataset.source = source;
  }

  updateAiAccess() {
    const allowed = auth.canRunAIBriefing();
    const rail = document.getElementById("ai-rail");
    const fab = document.getElementById("btn-ai-fab");
    const gatewayPlan = document.getElementById("btn-plan-event");
    ["gemini-prompt-input", "btn-ai-briefing", "btn-ai-force"].forEach((id) => {
      const control = document.getElementById(id);
      if (control) control.disabled = !allowed;
    });
    if (rail) rail.hidden = !allowed;
    if (fab) fab.hidden = !allowed;
    if (gatewayPlan) gatewayPlan.hidden = !allowed;
    if (!allowed) this.closeDrawers();
    this.setAiStatus(allowed ? "Live event data ready" : "Manager access required", allowed ? "local" : "locked");
  }

  appendAiMessage(from, text, source = "") {
    const thread = document.getElementById("gemini-thread");
    if (!thread) return;
    const row = document.createElement("div");
    row.className = `ai-msg ${from}`;
    row.innerHTML = `
      ${from === "bot" ? '<span class="ai-avatar">✦</span>' : ""}
      <div class="ai-bubble"></div>
    `;
    row.querySelector(".ai-bubble").textContent = text;
    if (source) {
      const badge = document.createElement("span");
      badge.className = `ai-source-badge ${source.toLowerCase().includes("gemini") ? "gemini" : "local"}`;
      badge.textContent = source;
      row.querySelector(".ai-bubble").appendChild(badge);
    }
    thread.appendChild(row);
    thread.scrollTop = thread.scrollHeight;
  }

  renderAiBlueprint(blueprintId, blueprint) {
    const preview = document.getElementById("ai-plan-preview");
    if (!preview || !blueprint) return;
    this.aiDraft = { blueprintId, blueprint };
    const groupFields = (blueprint.groups || []).map((group, index) => `
      <div class="ai-plan-row" data-plan-group>
        <input data-plan-group-name value="${esc(group.name)}" aria-label="Group ${index + 1} name">
        <input data-plan-group-description value="${esc(group.description || "")}" aria-label="Group ${index + 1} description" placeholder="Responsibility">
      </div>`).join("");
    const groupOptions = (blueprint.groups || []).map((group, index) => `<option value="${index}">${esc(group.name)}</option>`).join("");
    const roleFields = (blueprint.roleSlots || []).map((role, index) => `
      <div class="ai-plan-row" data-plan-role>
        <input data-plan-role-title value="${esc(role.title)}" aria-label="Role ${index + 1} title">
        <input data-plan-role-responsibility value="${esc(role.responsibility)}" aria-label="Role ${index + 1} responsibility">
        <select data-plan-role-group aria-label="Role ${index + 1} group"><option value="">No group</option>${groupOptions}</select>
      </div>`).join("");
    preview.innerHTML = `
      <div class="ai-plan-head"><strong>Gemini plan</strong><span class="ai-source-badge gemini">Review required</span></div>
      <p class="ai-plan-copy">Edit the draft, then confirm to create a separate draft event. No people are assigned automatically.</p>
      <label>Event title<input id="ai-plan-title" value="${esc(blueprint.title)}"></label>
      <label>Venue<input id="ai-plan-venue" value="${esc(blueprint.venue)}"></label>
      <p class="ai-plan-label">Groups</p>${groupFields || '<p class="empty">No groups suggested.</p>'}
      <p class="ai-plan-label">Unfilled role slots</p>${roleFields || '<p class="empty">No roles suggested.</p>'}
      <button class="btn-dark btn-small" id="btn-ai-plan-confirm" type="button">Confirm new draft event</button>`;
    preview.querySelectorAll("[data-plan-role]").forEach((row, index) => {
      const select = row.querySelector("[data-plan-role-group]");
      const value = blueprint.roleSlots?.[index]?.groupIndex;
      if (select && Number.isInteger(value)) select.value = String(value);
    });
    preview.hidden = false;
  }

  readAiBlueprint() {
    const draft = this.aiDraft?.blueprint;
    if (!draft) return null;
    const groups = [...document.querySelectorAll("[data-plan-group]")].map((row) => ({
      name: row.querySelector("[data-plan-group-name]")?.value.trim() || "",
      description: row.querySelector("[data-plan-group-description]")?.value.trim() || undefined,
    }));
    const roleSlots = [...document.querySelectorAll("[data-plan-role]")].map((row) => {
      const groupIndex = row.querySelector("[data-plan-role-group]")?.value;
      return {
        title: row.querySelector("[data-plan-role-title]")?.value.trim() || "",
        responsibility: row.querySelector("[data-plan-role-responsibility]")?.value.trim() || "",
        ...(groupIndex ? { groupIndex: Number(groupIndex) } : {}),
      };
    });
    return {
      title: document.getElementById("ai-plan-title")?.value.trim() || "",
      venue: document.getElementById("ai-plan-venue")?.value.trim() || "",
      groups,
      roleSlots,
      programmes: draft.programmes || [],
    };
  }

  async confirmAiBlueprint() {
    const blueprint = this.readAiBlueprint();
    const button = document.getElementById("btn-ai-plan-confirm");
    if (!blueprint || !this.aiDraft) return;
    if (button) button.disabled = true;
    try {
      const result = await aiCoordinator.applyBlueprint(this.aiDraft.blueprintId, blueprint);
      const event = result.event;
      const currentUser = auth.getCurrentUser();
      if (currentUser?.canCreateFirstEvent) {
        auth.setCustomUser({ ...currentUser, role: "manager", department: "Event Organizer", canCreateFirstEvent: false });
      }
      this.appendAiMessage("bot", `Created ${event.event_title} as a separate draft event. Assign people to its unfilled role slots when the event opens.`, "Gemini plan");
      document.getElementById("ai-plan-preview").hidden = true;
      this.aiDraft = null;
    } catch (error) {
      this.appendAiMessage("bot", error.message || "The event could not be created. No changes were saved.", "Gemini plan");
      if (button) button.disabled = false;
    }
  }

  async submitGeminiPrompt(promptText, options = {}) {
    const thread = document.getElementById("gemini-thread");
    if (!thread || !promptText.trim()) return;
    this.appendAiMessage("user", promptText.trim());
    this.appendAiMessage("bot", "Checking the appropriate response path…");
    const loading = thread.lastChild;
    const eventContext = {
      eventTitle: this.state.currentEvent?.title,
      eventCode: this.state.currentEvent?.sixDigitCode,
      programmes: taskManager.getProgrammes(),
      groups: this.state.groups,
      people: this.state.joinedPeople,
    };
    try {
      const response = await aiCoordinator.respond(promptText, eventContext, options);
      if (loading) loading.remove();
      this.setAiStatus(response.label, response.source);
      if (response.blueprint) {
        this.appendAiMessage("bot", "I drafted a new event plan. Review and edit it below before confirming.", response.label);
        this.renderAiBlueprint(response.blueprintId, response.blueprint);
      } else {
        this.appendAiMessage("bot", response.text || "I could not generate a briefing right now.", response.label);
      }
    } catch (err) {
      if (loading) loading.remove();
      this.setAiStatus("Gemini unavailable", "error");
      this.appendAiMessage("bot", err.message || "Gemini is temporarily unavailable. No event was created.", "Gemini unavailable");
    }
  }

  // ------------------------------------------------------------------ session
  handleUserRoleChanged(user) {
    const nameEl = document.getElementById("user-name-display");
    const deptEl = document.getElementById("user-dept-display");
    const badgeEl = document.getElementById("user-role-badge");
    const initialsEl = document.getElementById("user-avatar-initials");
    const popName = document.getElementById("popover-user-name");
    const popDept = document.getElementById("popover-user-dept");
    const popBadge = document.getElementById("popover-user-role-badge");
    const popAvatar = document.getElementById("popover-user-avatar");

    if (!user) {
      if (nameEl) nameEl.textContent = "—";
      if (deptEl) deptEl.textContent = "—";
      if (badgeEl) {
        badgeEl.textContent = "MEMBER";
        badgeEl.className = "role-tag role-volunteer";
      }
      if (initialsEl) {
        initialsEl.textContent = "—";
        initialsEl.style.color = "#9ca3af";
      }
      if (popName) popName.textContent = "—";
      if (popDept) popDept.textContent = "—";
      if (popBadge) {
        popBadge.textContent = "MEMBER";
        popBadge.className = "role-tag role-volunteer";
      }
      if (popAvatar) {
        popAvatar.textContent = "—";
        popAvatar.style.color = "#9ca3af";
      }
      return;
    }

    if (nameEl) nameEl.textContent = user.name;
    if (deptEl) deptEl.textContent = user.department || user.roleLabel || user.role;
    if (badgeEl) {
      badgeEl.textContent = (user.role || "manager").toUpperCase();
      badgeEl.className = `role-tag role-${user.role || "manager"}`;
    }
    if (initialsEl) {
      initialsEl.textContent = initialsFor(user.name);
      initialsEl.style.color = colorFor(user.name);
    }
    // Update Session & access popover active profile card
    if (popName) popName.textContent = user.name;
    if (popDept) popDept.textContent = user.department || user.roleLabel || user.role;
    if (popBadge) {
      popBadge.textContent = (user.role || "manager").toUpperCase();
      popBadge.className = `role-tag role-${user.role || "manager"}`;
    }
    if (popAvatar) {
      popAvatar.textContent = initialsFor(user.name);
      popAvatar.style.color = colorFor(user.name);
    }
    this.syncRoleButtons();
    this.renderAssignRoles();
    this.renderProgramsPage();
    this.renderChatChannels();
    this.renderChatMessages(chatManager.getMessages());
    this.updateChatPermissionsUI();
    this.updateAiAccess();
  }

  updateEventDisplay() {
    const evt = this.state.currentEvent;
    const titleEl = document.getElementById("side-event-title");
    const codeEl = document.getElementById("side-event-code");
    const navCodeEl = document.getElementById("nav-code-display");
    const popTitleEl = document.getElementById("popover-event-title");
    if (titleEl) titleEl.textContent = evt ? evt.title : "No Active Event";
    if (codeEl) codeEl.textContent = `PIN: ${evt ? evt.sixDigitCode : "—"}`;
    if (navCodeEl) navCodeEl.textContent = evt ? evt.sixDigitCode : "—";
    if (popTitleEl) popTitleEl.textContent = evt ? evt.title : "No Active Event";
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

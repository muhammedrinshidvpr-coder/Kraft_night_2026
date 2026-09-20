// ==============================================================================
// SANGAM - Dedicated Event Planner Modal
// Features: Instant Templates (Wedding, Hackathon, Fest, Conf), Gemini 2.5 Flash,
// Live Interactive Blueprint Canvas, and Direct Event Launch.
// ==============================================================================

import { getAllTemplates, getTemplate } from "./templates.js";
import { aiCoordinator } from "./ai.js";
import { auth } from "./auth.js";

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class EventPlannerModal {
  constructor() {
    this.app = null;
    this.modalEl = null;
    this.activeTemplateKey = "hackathon";
    this.currentBlueprint = null;
    this.isGenerating = false;
  }

  init(app) {
    this.app = app;
    this.modalEl = document.getElementById("modal-event-planner");
    if (!this.modalEl) return;

    this.bindEvents();
    this.renderTemplateCards();
  }

  bindEvents() {
    // Close button & backdrop
    const closeBtn = document.getElementById("btn-planner-close");
    const cancelBtn = document.getElementById("btn-planner-cancel");
    const backdrop = document.getElementById("planner-modal-backdrop");

    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    if (cancelBtn) cancelBtn.addEventListener("click", () => this.close());
    if (backdrop) backdrop.addEventListener("click", () => this.close());

    // Escape key listener
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) {
        this.close();
      }
    });

    // Gemini Prompt Form
    const form = document.getElementById("planner-ai-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("planner-ai-input");
        const prompt = input?.value.trim() || "";
        if (prompt) this.generateWithAI(prompt, false);
      });
    }

    // Enhance Current Plan button
    const enhanceBtn = document.getElementById("btn-planner-enhance");
    if (enhanceBtn) {
      enhanceBtn.addEventListener("click", () => {
        const input = document.getElementById("planner-ai-input");
        const prompt = input?.value.trim() || "";
        if (prompt) this.generateWithAI(prompt, true);
        else {
          input?.focus();
          input?.setAttribute("placeholder", "Please enter what you'd like to add or customize first!");
        }
      });
    }

    // Quick prompt chip triggers
    this.modalEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".planner-chip");
      if (chip) {
        const text = chip.dataset.prompt || chip.textContent.trim();
        const input = document.getElementById("planner-ai-input");
        if (input) {
          input.value = text;
          input.focus();
        }
      }
    });

    // Add buttons on canvas
    const btnAddGroup = document.getElementById("btn-planner-add-group");
    if (btnAddGroup) {
      btnAddGroup.addEventListener("click", () => this.addGroupRow());
    }

    const btnAddRole = document.getElementById("btn-planner-add-role");
    if (btnAddRole) {
      btnAddRole.addEventListener("click", () => this.addRoleRow());
    }

    const btnAddProg = document.getElementById("btn-planner-add-programme");
    if (btnAddProg) {
      btnAddProg.addEventListener("click", () => this.addProgrammeRow());
    }

    // Confirm & Create Event
    const btnConfirm = document.getElementById("btn-planner-create-event");
    if (btnConfirm) {
      btnConfirm.addEventListener("click", () => this.confirmAndCreateEvent());
    }
  }

  isOpen() {
    return this.modalEl && !this.modalEl.hidden;
  }

  resetPlannerForNewSession(initialTitle = "") {
    this.isGenerating = false;
    this.lastAiError = null;
    const cleanTitle = (initialTitle || "").trim();
    const hasTitle = cleanTitle && cleanTitle !== "new event";

    const promptInput = document.getElementById("planner-ai-input");
    if (promptInput) {
      promptInput.value = "";
      promptInput.removeAttribute("placeholder");
      promptInput.setAttribute("placeholder", "Describe your event or ask Gemini to customize (e.g. 'Add an e-sports tournament and live streaming crew')...");
    }

    const canvasWrap = document.getElementById("planner-canvas-wrap");
    if (canvasWrap) canvasWrap.classList.remove("planner-canvas-loading");
    const btnSubmit = document.getElementById("btn-planner-ai-submit");
    const btnEnhance = document.getElementById("btn-planner-enhance");
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnEnhance) btnEnhance.disabled = false;

    // Always start from the default Hackathon preset so prior plans never leak.
    this.selectTemplate("hackathon");
    if (hasTitle) {
      const titleInput = document.getElementById("planner-event-title");
      if (titleInput) titleInput.value = cleanTitle;
      if (this.currentBlueprint) this.currentBlueprint.title = cleanTitle;
    }
  }

  open(initialTitle = "") {
    if (!this.modalEl) return;
    this.resetPlannerForNewSession(initialTitle);
    this.modalEl.hidden = false;
    document.body.classList.add("modal-open");

    const input = document.getElementById("planner-ai-input");
    // Focus input
    setTimeout(() => {
      input?.focus();
    }, 100);
  }

  close() {
    if (!this.modalEl) return;
    // Discard the transient draft so reopening never shows stale customizations.
    this.currentBlueprint = null;
    this.isGenerating = false;
    this.lastAiError = null;
    const promptInput = document.getElementById("planner-ai-input");
    if (promptInput) promptInput.value = "";
    const titleInput = document.getElementById("planner-event-title");
    if (titleInput) titleInput.value = "";
    const venueInput = document.getElementById("planner-event-venue");
    if (venueInput) venueInput.value = "";
    const groupsList = document.getElementById("planner-groups-list");
    if (groupsList) groupsList.innerHTML = "";
    const rolesList = document.getElementById("planner-roles-list");
    if (rolesList) rolesList.innerHTML = "";
    const progsList = document.getElementById("planner-programmes-list");
    if (progsList) progsList.innerHTML = "";
    const canvasWrap = document.getElementById("planner-canvas-wrap");
    if (canvasWrap) canvasWrap.classList.remove("planner-canvas-loading");
    this.modalEl.hidden = true;
    document.body.classList.remove("modal-open");
  }

  renderTemplateCards() {
    const container = document.getElementById("planner-templates-grid");
    if (!container) return;

    const templates = getAllTemplates();
    container.innerHTML = templates.map((tmpl) => `
      <button type="button" class="planner-tpl-card ${tmpl.id === this.activeTemplateKey ? "active" : ""}" data-tpl-id="${tmpl.id}">
        <span class="tpl-icon">${tmpl.icon}</span>
        <div class="tpl-info">
          <strong class="tpl-name">${esc(tmpl.name)}</strong>
          <span class="tpl-tagline">${esc(tmpl.tagline)}</span>
        </div>
      </button>
    `).join("");

    container.querySelectorAll(".planner-tpl-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tplId = btn.dataset.tplId;
        this.selectTemplate(tplId);
      });
    });
  }

  selectTemplate(templateKey) {
    const tmpl = getTemplate(templateKey);
    if (!tmpl) return;

    this.activeTemplateKey = templateKey;

    // Update active highlight
    const cards = document.querySelectorAll(".planner-tpl-card");
    cards.forEach((card) => {
      card.classList.toggle("active", card.dataset.tplId === templateKey);
    });

    this.currentBlueprint = {
      title: tmpl.defaultTitle,
      venue: tmpl.defaultVenue,
      groups: tmpl.groups,
      roleSlots: tmpl.roleSlots,
      programmes: tmpl.programmes,
    };

    this.renderBlueprint(this.currentBlueprint);
    this.updateSourceStatus(`Preset Template: ${tmpl.name}`, "template");
  }

  updateSourceStatus(label, type = "template") {
    const statusEl = document.getElementById("planner-source-badge");
    if (!statusEl) return;
    statusEl.textContent = label;
    statusEl.className = `planner-source-badge badge-${type}`;
  }

  async generateWithAI(promptText, isEnhance = false) {
    if (this.isGenerating) return;
    this.isGenerating = true;

    const btnSubmit = document.getElementById("btn-planner-ai-submit");
    const btnEnhance = document.getElementById("btn-planner-enhance");
    const canvasWrap = document.getElementById("planner-canvas-wrap");

    if (btnSubmit) btnSubmit.disabled = true;
    if (btnEnhance) btnEnhance.disabled = true;
    if (canvasWrap) canvasWrap.classList.add("planner-canvas-loading");

    this.updateSourceStatus("Generating with Gemini 2.5 Flash…", "loading");

    try {
      const activeBlueprint = this.readBlueprintFromInputs() || this.currentBlueprint;
      let finalPrompt = promptText;
      if (isEnhance && activeBlueprint) {
        finalPrompt = `Based on this existing event plan: Title "${activeBlueprint.title}", Groups: [${activeBlueprint.groups.map(g => g.name).join(", ")}], please enhance and add to it according to this instruction: ${promptText}`;
      }

      const response = await aiCoordinator.respond(finalPrompt, {}, {
        forceGemini: true,
        baseTemplateKey: this.activeTemplateKey,
      });

      if (response && response.blueprint) {
        this.currentBlueprint = response.blueprint;
        this.renderBlueprint(this.currentBlueprint);
        this.lastAiError = null;
        this.updateSourceStatus(`✦ Generated by ${response.label || "Gemini 2.5 Flash"}`, "gemini");
      } else {
        throw new Error("Gemini returned no usable blueprint. No event was created.");
      }
    } catch (err) {
      console.error("AI Event Planner Error:", err);
      // Preserve the selected preset: do not touch currentBlueprint here.
      // The Generate button is re-enabled below so this same prompt can be retried.
      this.lastAiError = err?.message || "Gemini is temporarily unavailable.";
      this.updateSourceStatus(`Gemini unavailable: ${this.lastAiError} — edit the prompt and press Generate again`, "error");
    } finally {
      this.isGenerating = false;
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnEnhance) btnEnhance.disabled = false;
      if (canvasWrap) canvasWrap.classList.remove("planner-canvas-loading");
    }
  }

  renderBlueprint(blueprint) {
    if (!blueprint) return;

    // Title & Venue
    const titleInput = document.getElementById("planner-event-title");
    const venueInput = document.getElementById("planner-event-venue");
    if (titleInput) titleInput.value = blueprint.title || "";
    if (venueInput) venueInput.value = blueprint.venue || "";

    // Departments / Groups
    this.renderGroups(blueprint.groups || []);

    // Roles (depends on groups for dropdown)
    this.renderRoles(blueprint.roleSlots || [], blueprint.groups || []);

    // Programmes
    this.renderProgrammes(blueprint.programmes || []);
  }

  renderGroups(groups) {
    const list = document.getElementById("planner-groups-list");
    if (!list) return;

    list.innerHTML = groups.map((g, i) => `
      <div class="planner-item-row" data-group-row>
        <span class="planner-row-icon">${g.icon || "📁"}</span>
        <input type="text" class="planner-input-name" data-group-name value="${esc(g.name)}" placeholder="Department Name" required>
        <input type="text" class="planner-input-desc" data-group-desc value="${esc(g.description || "")}" placeholder="Department Responsibilities">
        <button type="button" class="planner-btn-del" title="Delete department" aria-label="Delete department">✕</button>
      </div>
    `).join("");

    list.querySelectorAll(".planner-btn-del").forEach((delBtn) => {
      delBtn.addEventListener("click", () => {
        const row = delBtn.closest("[data-group-row]");
        if (row) {
          row.remove();
          this.refreshGroupDropdowns();
        }
      });
    });

    // Refresh role dropdowns whenever groups change
    list.querySelectorAll("[data-group-name]").forEach((input) => {
      input.addEventListener("input", () => this.refreshGroupDropdowns());
    });
  }

  addGroupRow(name = "New Operational Group", description = "Operational responsibilities", icon = "📁") {
    const list = document.getElementById("planner-groups-list");
    if (!list) return;

    const div = document.createElement("div");
    div.className = "planner-item-row";
    div.setAttribute("data-group-row", "");
    div.innerHTML = `
      <span class="planner-row-icon">${icon}</span>
      <input type="text" class="planner-input-name" data-group-name value="${esc(name)}" placeholder="Department Name" required>
      <input type="text" class="planner-input-desc" data-group-desc value="${esc(description)}" placeholder="Department Responsibilities">
      <button type="button" class="planner-btn-del" title="Delete department" aria-label="Delete department">✕</button>
    `;

    div.querySelector(".planner-btn-del").addEventListener("click", () => {
      div.remove();
      this.refreshGroupDropdowns();
    });

    div.querySelector("[data-group-name]").addEventListener("input", () => this.refreshGroupDropdowns());

    list.appendChild(div);
    this.refreshGroupDropdowns();
    div.querySelector("[data-group-name]").focus();
  }

  getCurrentGroups() {
    const rows = document.querySelectorAll("[data-group-row]");
    return Array.from(rows).map((row, index) => ({
      index,
      name: row.querySelector("[data-group-name]")?.value.trim() || `Department ${index + 1}`,
      description: row.querySelector("[data-group-desc]")?.value.trim() || "",
      icon: row.querySelector(".planner-row-icon")?.textContent.trim() || "📁",
    }));
  }

  refreshGroupDropdowns() {
    const groups = this.getCurrentGroups();
    const selects = document.querySelectorAll("[data-role-group]");
    selects.forEach((select) => {
      const currentVal = select.value;
      select.innerHTML = `<option value="">(No department)</option>` +
        groups.map((g) => `<option value="${g.index}">${esc(g.name)}</option>`).join("");
      if (currentVal !== "") {
        select.value = currentVal;
      }
    });
  }

  renderRoles(roleSlots, groups) {
    const list = document.getElementById("planner-roles-list");
    if (!list) return;

    const groupOptions = (groups || []).map((g, i) => `<option value="${i}">${esc(g.name)}</option>`).join("");

    list.innerHTML = roleSlots.map((r) => `
      <div class="planner-item-row" data-role-row>
        <input type="text" class="planner-input-name" data-role-title value="${esc(r.title)}" placeholder="Role Slot Title" required>
        <input type="text" class="planner-input-desc" data-role-resp value="${esc(r.responsibility || "")}" placeholder="Key Responsibility">
        <select class="planner-select-group" data-role-group aria-label="Assigned Group">
          <option value="">(No department)</option>
          ${groupOptions}
        </select>
        <button type="button" class="planner-btn-del" title="Delete role" aria-label="Delete role">✕</button>
      </div>
    `).join("");

    list.querySelectorAll("[data-role-row]").forEach((row, idx) => {
      const select = row.querySelector("[data-role-group]");
      const assigned = roleSlots[idx]?.groupIndex;
      if (select && assigned !== undefined && assigned !== null) {
        select.value = String(assigned);
      }
      row.querySelector(".planner-btn-del")?.addEventListener("click", () => row.remove());
    });
  }

  addRoleRow(title = "New Coordinator", responsibility = "Coordinate department activities") {
    const list = document.getElementById("planner-roles-list");
    if (!list) return;

    const groups = this.getCurrentGroups();
    const groupOptions = groups.map((g) => `<option value="${g.index}">${esc(g.name)}</option>`).join("");

    const div = document.createElement("div");
    div.className = "planner-item-row";
    div.setAttribute("data-role-row", "");
    div.innerHTML = `
      <input type="text" class="planner-input-name" data-role-title value="${esc(title)}" placeholder="Role Slot Title" required>
      <input type="text" class="planner-input-desc" data-role-resp value="${esc(responsibility)}" placeholder="Key Responsibility">
      <select class="planner-select-group" data-role-group aria-label="Assigned Group">
        <option value="">(No department)</option>
        ${groupOptions}
      </select>
      <button type="button" class="planner-btn-del" title="Delete role" aria-label="Delete role">✕</button>
    `;

    div.querySelector(".planner-btn-del").addEventListener("click", () => div.remove());
    list.appendChild(div);
    div.querySelector("[data-role-title]").focus();
  }

  renderProgrammes(programmes) {
    const list = document.getElementById("planner-programmes-list");
    if (!list) return;

    list.innerHTML = programmes.map((p) => `
      <div class="planner-item-row" data-prog-row>
        <input type="text" class="planner-input-name" data-prog-title value="${esc(p.title)}" placeholder="Programme Title" required>
        <input type="text" class="planner-input-time" data-prog-start value="${esc(p.startTime || "10:00")}" placeholder="Start" title="Start Time">
        <input type="text" class="planner-input-time" data-prog-end value="${esc(p.endTime || "")}" placeholder="End" title="End Time">
        <input type="text" class="planner-input-stage" data-prog-stage value="${esc(p.venueOrStage || "")}" placeholder="Stage / Hall">
        <button type="button" class="planner-btn-del" title="Delete programme" aria-label="Delete programme">✕</button>
      </div>
    `).join("");

    list.querySelectorAll(".planner-btn-del").forEach((delBtn) => {
      delBtn.addEventListener("click", () => {
        delBtn.closest("[data-prog-row]")?.remove();
      });
    });
  }

  addProgrammeRow(title = "New Scheduled Session", startTime = "12:00", endTime = "13:00", stage = "Main Stage") {
    const list = document.getElementById("planner-programmes-list");
    if (!list) return;

    const div = document.createElement("div");
    div.className = "planner-item-row";
    div.setAttribute("data-prog-row", "");
    div.innerHTML = `
      <input type="text" class="planner-input-name" data-prog-title value="${esc(title)}" placeholder="Programme Title" required>
      <input type="text" class="planner-input-time" data-prog-start value="${esc(startTime)}" placeholder="Start" title="Start Time">
      <input type="text" class="planner-input-time" data-prog-end value="${esc(endTime)}" placeholder="End" title="End Time">
      <input type="text" class="planner-input-stage" data-prog-stage value="${esc(stage)}" placeholder="Stage / Hall">
      <button type="button" class="planner-btn-del" title="Delete programme" aria-label="Delete programme">✕</button>
    `;

    div.querySelector(".planner-btn-del").addEventListener("click", () => div.remove());
    list.appendChild(div);
    div.querySelector("[data-prog-title]").focus();
  }

  readBlueprintFromInputs() {
    const title = document.getElementById("planner-event-title")?.value.trim() || "New Event";
    const venue = document.getElementById("planner-event-venue")?.value.trim() || "Main Auditorium";

    const groups = Array.from(document.querySelectorAll("[data-group-row]")).map((row) => ({
      name: row.querySelector("[data-group-name]")?.value.trim() || "Department",
      description: row.querySelector("[data-group-desc]")?.value.trim() || "",
      icon: row.querySelector(".planner-row-icon")?.textContent.trim() || "📁",
    }));

    const roleSlots = Array.from(document.querySelectorAll("[data-role-row]")).map((row) => {
      const gVal = row.querySelector("[data-role-group]")?.value;
      return {
        title: row.querySelector("[data-role-title]")?.value.trim() || "Role",
        responsibility: row.querySelector("[data-role-resp]")?.value.trim() || "",
        ...(gVal !== "" && !Number.isNaN(Number(gVal)) ? { groupIndex: Number(gVal) } : {}),
      };
    });

    const programmes = Array.from(document.querySelectorAll("[data-prog-row]")).map((row) => ({
      title: row.querySelector("[data-prog-title]")?.value.trim() || "Session",
      startTime: row.querySelector("[data-prog-start]")?.value.trim() || "10:00",
      endTime: row.querySelector("[data-prog-end]")?.value.trim() || "",
      venueOrStage: row.querySelector("[data-prog-stage]")?.value.trim() || "",
    }));

    return {
      title,
      venue,
      groups,
      roleSlots,
      programmes,
    };
  }

  async confirmAndCreateEvent() {
    const blueprint = this.readBlueprintFromInputs();
    if (!blueprint.title) {
      alert("Please specify an event title.");
      return;
    }

    const btnConfirm = document.getElementById("btn-planner-create-event");
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `<span class="planner-spinner"></span> Creating Event…`;
    }

    try {
      // Real authenticated managers only. Never fabricate a manager here.
      const currentUser = auth.getCurrentUser();
      if (!currentUser || !currentUser.id) {
        this.app?.switchView("login");
        throw new Error("Sign in as an event manager to create an event.");
      }
      if (currentUser.role !== "manager") {
        throw new Error("Only event managers can create events from a plan.");
      }
      if (!this.app || typeof this.app.createEventFromBlueprint !== "function") {
        throw new Error("Event creation is unavailable.");
      }
      // Single transactional path: live writes are all-or-nothing inside
      // createEventFromBlueprint (failed Supabase writes roll back the remote
      // event and change no local state). Never continue locally after a
      // failed persistence — that is what produced divergent schedules.
      await this.app.createEventFromBlueprint(blueprint);
      this.close();
    } catch (err) {
      // createEventFromBlueprint already rolled back partial remote rows;
      // surface the failure instead of opening a divergent local workspace.
      console.error("Failed to create event from plan:", err);
      alert("An error occurred while creating the event: " + (err?.message || err));
    } finally {
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = `🚀 Create Event from Plan`;
      }
    }
  }
}

export const eventPlanner = new EventPlannerModal();

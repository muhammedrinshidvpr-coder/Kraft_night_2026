// ==============================================================================
// SANGAM - AI Event Coordinator
// Local factual answers avoid model tokens; Gemini planning stays behind Supabase.
// ==============================================================================

import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { getSupabase, isLive } from "./supabase-client.js";

const PLANNING_PATTERN = /\b(create|plan|design|organize|organise|generate|draft|allocate|rebalance|build|prepare)\b/i;
const TEAM_PATTERN = /\b(team|teams|group|groups|leader|leaders|department|departments)\b/i;
const ROLE_PATTERN = /\b(role|roles|roster|who is|who are|organizer|organiser)\b/i;
const PROGRAMME_PATTERN = /\b(program|programme|programs|programmes|schedule|timeline|next|current|status|what is on)\b/i;

function listOrEmpty(items, emptyText) {
  return items.length ? items.join("\n") : emptyText;
}

export function routePrompt(prompt, { forceGemini = false } = {}) {
  if (forceGemini) {
    return {
      route: "gemini",
      action: PLANNING_PATTERN.test(prompt) ? "plan_event" : "chat",
      reason: "Manager requested Gemini",
    };
  }
  if (PLANNING_PATTERN.test(prompt)) {
    return {
      route: "gemini",
      action: /\b(create|plan|design|organize|organise|build)\b/i.test(prompt) ? "plan_event" : "chat",
      reason: "Planning request",
    };
  }
  if (TEAM_PATTERN.test(prompt) || ROLE_PATTERN.test(prompt) || PROGRAMME_PATTERN.test(prompt)) {
    return { route: "local", action: "local", reason: "Live event data" };
  }
  return { route: "local", action: "local", reason: "No model needed" };
}

// CONTRACT
// GUARANTEES: returns an answer built only from supplied current event state.
// DOES NOT: fetch, mutate state, or call a model provider.
export function getLocalResponse(prompt, context = {}) {
  const q = prompt.toLowerCase();
  const groups = Array.isArray(context.groups) ? context.groups : [];
  const programmes = Array.isArray(context.programmes) ? context.programmes : [];
  const people = Array.isArray(context.people) ? context.people : [];

  if (TEAM_PATTERN.test(q) && !ROLE_PATTERN.test(q)) {
    const rows = groups.map((group) => `• ${group.name}${group.leaderName ? `, lead: ${group.leaderName}` : ""}`);
    return `Operational teams\n${listOrEmpty(rows, "No operational teams are registered for this event.")}`;
  }

  if (ROLE_PATTERN.test(q)) {
    const rows = people.map((person) => `• ${person.name}: ${person.roleBadge || person.role || "Unassigned"}${person.groupName ? `, ${person.groupName}` : ""}`);
    return `Current roles\n${listOrEmpty(rows, "No event members are assigned yet.")}`;
  }

  if (PROGRAMME_PATTERN.test(q)) {
    const active = programmes.filter((programme) => programme.status === "in_progress");
    const upcoming = programmes.filter((programme) => programme.status === "scheduled").slice(0, 3);
    const delayed = programmes.filter((programme) => programme.status === "delayed");
    const rows = [
      ...active.map((programme) => `• Live: ${programme.title} at ${programme.venue || programme.venueOrStage || "TBD"}`),
      ...upcoming.map((programme) => `• Next: ${programme.title} at ${programme.startTime || "TBD"}`),
      ...delayed.map((programme) => `• Delayed: ${programme.title}`),
    ];
    return `Live programme status\n${listOrEmpty(rows, "No programme status is available yet.")}`;
  }

  return "I can answer from live event data: teams, roles, programmes, schedule, and status. Use Gemini for a plan, draft, or new event design.";
}

class SangamAICoordinator {
  constructor() {
    this.edgeFunctionUrl = `${CONFIG.SUPABASE_URL}/functions/v1/ai-coordinator`;
  }

  async getAccessToken() {
    if (!isLive()) return null;
    const client = await getSupabase();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token || null;
  }

  async callEdge(payload) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Sign in with a secure manager session to use Gemini planning.");

    const response = await fetch(this.edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { text: await response.text() };
    if (!response.ok) throw new Error(body?.error?.message || "Gemini is temporarily unavailable.");
    return body;
  }

  async respond(prompt, context = {}, options = {}) {
    if (!prompt?.trim()) return null;
    const route = routePrompt(prompt, options);
    if (route.route === "local") {
      return { source: "local", label: "Live event data", text: getLocalResponse(prompt, context), route };
    }
    if (!auth.canRunAIBriefing()) {
      throw new Error("Only event managers can use Gemini planning.");
    }

    const result = await this.callEdge({ action: route.action, prompt: prompt.trim() });
    if (route.action === "plan_event") {
      return { source: "gemini", label: "Gemini plan", blueprintId: result.blueprintId, blueprint: result.blueprint, usage: result.usage || {}, route };
    }
    return { source: "gemini", label: "Gemini", text: String(result.text || "Gemini returned no response."), route };
  }

  async applyBlueprint(blueprintId, blueprint) {
    return this.callEdge({
      action: "apply_event_blueprint",
      blueprintId,
      eventTitle: blueprint.title,
      venue: blueprint.venue,
      groups: blueprint.groups,
      roleSlots: blueprint.roleSlots,
      programmes: blueprint.programmes,
    });
  }

  async generateStatusBriefing(programmes = []) {
    const completed = programmes.filter((programme) => programme.status === "completed").length;
    const delayed = programmes.filter((programme) => programme.status === "delayed");
    const rate = programmes.length ? Math.round((completed / programmes.length) * 100) : 0;
    return {
      status: delayed.length ? "Attention Required" : "Running on Schedule",
      completionRate: `${rate}%`,
      summary: `${completed} of ${programmes.length} programmes have concluded.`,
    };
  }
}

export const aiCoordinator = new SangamAICoordinator();

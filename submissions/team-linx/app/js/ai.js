// ==============================================================================
// SANGAM - AI Event Coordinator
// Local factual answers avoid model tokens; Gemini planning stays behind Supabase.
// ==============================================================================

import { CONFIG, isBrowserGeminiTestMode, getBrowserGeminiKey } from "./config.js";
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

  // TEST-ONLY direct browser call. Used solely when the owner-enabled
  // testing flag is on and the secure Edge path failed. Never used in
  // production: the key is readable by any page visitor.
  async callGeminiDirectForTesting(prompt, action = "plan_event") {
    const key = getBrowserGeminiKey();
    if (!key) return null;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const systemInstruction = action === "plan_event"
      ? "You create operational event blueprints for Sangam command center. Return valid JSON only matching: { \"title\": string, \"venue\": string, \"groups\": [{\"name\": string, \"icon\": string, \"description\": string}], \"roleSlots\": [{\"title\": string, \"responsibility\": string, \"groupIndex\": number}], \"programmes\": [{\"title\": string, \"startTime\": string, \"endTime\": string, \"venueOrStage\": string}] }. Ensure all fields exist and times are HH:MM or ISO strings."
      : "You are Sangam AI, an expert real-time event coordinator.";

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nUser Request: ${prompt}` }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: action === "plan_event" ? "application/json" : "text/plain",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini test call failed (${response.status}). Check the testing key, then retry.`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned an empty response.");

    if (action === "plan_event") {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Gemini returned invalid JSON.");
      }
      return {
        blueprintId: `bp-gemini-test-${Date.now()}`,
        blueprint: {
          title: parsed.title || "Custom Planned Event",
          venue: parsed.venue || "Main Convention Center",
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
          roleSlots: Array.isArray(parsed.roleSlots) ? parsed.roleSlots : [],
          programmes: Array.isArray(parsed.programmes) ? parsed.programmes : [],
        },
        usage: data.usageMetadata || {},
      };
    }

    return { text };
  }

  async respond(prompt, context = {}, options = {}) {
    if (!prompt?.trim()) return null;
    const route = routePrompt(prompt, options);
    if (route.route === "local") {
      return { source: "local", label: "Live event data", text: getLocalResponse(prompt, context), route };
    }

    // Production path: real authenticated Supabase manager session via Edge.
    if (!isLive()) {
      throw new Error("Sign in with a secure manager session to use Gemini planning.");
    }
    const currentUser = auth.getCurrentUser();
    if (!currentUser || currentUser.role !== "manager") {
      throw new Error("Only event managers can use Gemini planning.");
    }

    try {
      const result = await this.callEdge({ action: route.action, prompt: prompt.trim() });
      if (route.action === "plan_event") {
        if (!result.blueprint) throw new Error("Gemini returned no usable blueprint. No event was created.");
        return { source: "gemini", label: "Gemini plan", blueprintId: result.blueprintId, blueprint: result.blueprint, usage: result.usage || {}, route };
      }
      return { source: "gemini", label: "Gemini", text: String(result.text || "Gemini returned no response."), route };
    } catch (edgeErr) {
      // Testing fallback only: owner-enabled flag + browser key. The planner
      // labels this result so test output is never mistaken for production.
      if (!isBrowserGeminiTestMode()) throw edgeErr;
      console.warn("[Sangam] Edge Gemini unavailable, using TEST-ONLY browser key:", edgeErr.message);
      const direct = await this.callGeminiDirectForTesting(prompt.trim(), route.action);
      if (route.action === "plan_event") {
        if (!direct?.blueprint) throw new Error("Gemini returned no usable blueprint. No event was created.");
        return { source: "gemini", label: "Gemini 2.5 Flash (browser test key)", blueprintId: direct.blueprintId, blueprint: direct.blueprint, usage: direct.usage, route };
      }
      return { source: "gemini", label: "Gemini (browser test key)", text: direct.text, route };
    }
  }

  async applyBlueprint(blueprintId, blueprint) {
    if (isLive()) {
      try {
        return await this.callEdge({
          action: "apply_event_blueprint",
          blueprintId,
          eventTitle: blueprint.title,
          venue: blueprint.venue,
          groups: blueprint.groups,
          roleSlots: blueprint.roleSlots,
          programmes: blueprint.programmes,
        });
      } catch (err) {
        console.warn("Edge apply failed, applying via client transaction:", err.message);
      }
    }

    // Client-side local application
    const randomPin = String(Math.floor(100000 + Math.random() * 900000));
    return {
      event: {
        id: `evt-${Date.now()}`,
        event_title: blueprint.title,
        title: blueprint.title,
        venue: blueprint.venue,
        six_digit_code: randomPin,
        sixDigitCode: randomPin,
        status: "active",
      },
    };
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

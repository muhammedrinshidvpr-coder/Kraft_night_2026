// ==============================================================================
// SANGAM (സംഗമം) - Configuration & State Defaults
// Team LINX - Kraft Night 2026
// ==============================================================================

const envUrl = typeof window !== "undefined" && window.ENV_SUPABASE_URL;
const envKey = typeof window !== "undefined" && window.ENV_SUPABASE_ANON_KEY;
const localUrl = typeof localStorage !== "undefined" && localStorage.getItem("sangam_supabase_url");
const localKey = typeof localStorage !== "undefined" && localStorage.getItem("sangam_supabase_anon_key");

// Security boundary: Gemini API keys belong in Supabase Edge Function
// secrets. A browser key is readable by any page visitor, so it is kept ONLY
// while the owner-accepted testing flag is explicitly enabled, and it is
// dropped otherwise so no code path can pick it up.
export function isBrowserGeminiTestMode() {
  if (typeof window === "undefined") return false;
  return window.ENV_ALLOW_BROWSER_GEMINI_TESTING === true && Boolean(window.ENV_GEMINI_API_KEY);
}

export function getBrowserGeminiKey() {
  return isBrowserGeminiTestMode() && typeof window !== "undefined" ? window.ENV_GEMINI_API_KEY : "";
}

if (typeof window !== "undefined" && window.ENV_GEMINI_API_KEY && !isBrowserGeminiTestMode()) {
  console.warn(
    "[Sangam] Ignoring window.ENV_GEMINI_API_KEY: set window.ENV_ALLOW_BROWSER_GEMINI_TESTING = true only for temporary local testing; production must use the Edge Function secret. See SETUP.md."
  );
  try {
    delete window.ENV_GEMINI_API_KEY;
  } catch {
    window.ENV_GEMINI_API_KEY = undefined;
  }
}

if (isBrowserGeminiTestMode()) {
  console.warn(
    "[Sangam] Browser Gemini TEST MODE is on: API calls go directly from this browser with a readable key. Temporary testing only — revoke the key and disable the flag before any shared or production use."
  );
}

export const CONFIG = {
  SUPABASE_URL:
    (envUrl && !envUrl.includes("xyzcompany")) ? envUrl :
    (localUrl && !localUrl.includes("xyzcompany")) ? localUrl :
    envUrl || localUrl || "https://xyzcompany.supabase.co",
  SUPABASE_ANON_KEY:
    (envKey && envKey !== "public-anon-key-placeholder" && envKey !== "paste-your-supabase-anon-key-here") ? envKey :
    (localKey && localKey !== "public-anon-key-placeholder") ? localKey :
    envKey || localKey || "public-anon-key-placeholder",
  USE_LIVE_BACKEND:
    (typeof window !== "undefined" && window.ENV_USE_LIVE_BACKEND === true) ||
    (typeof localStorage !== "undefined" && localStorage.getItem("sangam_use_live") === "true") ||
    false,
};

export function enableLiveBackend(url, anonKey) {
  if (url) localStorage.setItem("sangam_supabase_url", url);
  if (anonKey) localStorage.setItem("sangam_supabase_anon_key", anonKey);
  localStorage.setItem("sangam_use_live", "true");
}

export function disableLiveBackend() {
  localStorage.setItem("sangam_use_live", "false");
}

// Role definitions
export const ROLES = {
  manager: { role: "manager", label: "Event Manager (Full Admin)" },
  overseer: { role: "overseer", label: "VIP / Overseer (Read-Only)" },
  lead: { role: "lead", label: "Team Leader (Group Organiser)" },
  volunteer: { role: "volunteer", label: "Worker / Volunteer" }
};

// Preset Evaluator Users (empty in production - no demo accounts)
export const PRESET_USERS = {};

// Clean defaults for fresh event creation
export const DEFAULT_EVENT = null;
export const DEFAULT_GROUPS = [];
export const DEFAULT_JOINED_PEOPLE = [];
export const DEFAULT_PROGRAMMES = [];
export const DEFAULT_MESSAGES = {};
export const DEFAULT_ROLE_SLOTS = [];

export function createDefaultGeneralGroup(leaderId = "usr-manager", leaderName = "Event Manager") {
  return {
    id: "grp-general",
    name: "General Announcements",
    icon: "📢",
    description: "Global broadcasts and inter-departmental notices",
    leaderId: leaderId,
    leaderName: leaderName,
    memberCount: 1
  };
}

// Storage Key Constants
export const STORAGE_KEYS = {
  CURRENT_USER: "sangam_current_user",
  CURRENT_EVENT: "sangam_current_event",
  PROGRAMMES: "sangam_programmes",
  GROUPS: "sangam_groups",
  JOINED_PEOPLE: "sangam_joined_people",
  MESSAGES: "sangam_messages",
  ACTIVE_VIEW: "sangam_active_view",
  ROLE_SLOTS: "sangam_role_slots",
  ALL_EVENTS: "sangam_all_events",
  EVENT_SNAPSHOTS: "sangam_event_snapshots"
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage write failed", e);
  }
}

export function normalizeHistoryEntry(event, managerId = null) {
  if (!event || !event.id) return null;
  const code = event.sixDigitCode || event.six_digit_code || "";
  return {
    id: event.id,
    title: event.title || "Untitled Event",
    venue: event.venue || "TBD",
    sixDigitCode: code,
    six_digit_code: code,
    status: event.status || "active",
    manager_id: event.manager_id || event.managerId || managerId || null,
    managerId: event.managerId || event.manager_id || managerId || null,
    created_at: event.created_at || event.createdAt || new Date().toISOString(),
  };
}

export function getAllStoredEvents() {
  const list = readJson(STORAGE_KEYS.ALL_EVENTS, []);
  return Array.isArray(list) ? list : [];
}

export function getManagerEventHistory(managerId) {
  const all = getAllStoredEvents();
  if (!managerId) return all;
  return all.filter((e) => (e.manager_id || e.managerId) === managerId || !(e.manager_id || e.managerId));
}

export function saveEventToHistory(entry, snapshot = null) {
  const normalized = normalizeHistoryEntry(entry, entry?.manager_id || entry?.managerId);
  if (!normalized) return null;
  const all = getAllStoredEvents();
  const idx = all.findIndex((e) => e.id === normalized.id);
  const merged = { ...(idx >= 0 ? all[idx] : {}), ...normalized };
  if (idx >= 0) all[idx] = merged;
  else all.push(merged);
  writeJson(STORAGE_KEYS.ALL_EVENTS, all);
  if (snapshot) {
    const snaps = readJson(STORAGE_KEYS.EVENT_SNAPSHOTS, {});
    snaps[normalized.id] = snapshot;
    writeJson(STORAGE_KEYS.EVENT_SNAPSHOTS, snaps);
  }
  return merged;
}

export function getEventSnapshot(eventId) {
  if (!eventId) return null;
  const snaps = readJson(STORAGE_KEYS.EVENT_SNAPSHOTS, {});
  return snaps[eventId] || null;
}

export function saveEventSnapshot(eventId, snapshot) {
  if (!eventId) return;
  const snaps = readJson(STORAGE_KEYS.EVENT_SNAPSHOTS, {});
  snaps[eventId] = snapshot;
  writeJson(STORAGE_KEYS.EVENT_SNAPSHOTS, snaps);
}

export function clearActiveWorkspaceStorage() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_EVENT);
    localStorage.removeItem(STORAGE_KEYS.PROGRAMMES);
    localStorage.removeItem(STORAGE_KEYS.GROUPS);
    localStorage.removeItem(STORAGE_KEYS.JOINED_PEOPLE);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.ROLE_SLOTS);
  } catch (e) {
    console.warn("Could not clear active workspace storage:", e);
  }
}

// Initialize or Load Local Storage State
export function getLocalState() {
  const get = (k, fallback) => {
    try {
      const val = localStorage.getItem(k);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  };

  // Auto-clear legacy demo cache if old 'Kraft Night 2026' demo data is detected
  try {
    const rawEv = localStorage.getItem(STORAGE_KEYS.CURRENT_EVENT);
    if (rawEv) {
      const ev = JSON.parse(rawEv);
      if (ev && (ev.id === "evt-kraft-2026" || (typeof ev.title === "string" && ev.title.includes("Kraft Night")))) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_EVENT);
        localStorage.removeItem(STORAGE_KEYS.PROGRAMMES);
        localStorage.removeItem(STORAGE_KEYS.GROUPS);
        localStorage.removeItem(STORAGE_KEYS.JOINED_PEOPLE);
        localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      }
    }
    const rawUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (rawUser) {
      const cu = JSON.parse(rawUser);
      if (cu && (cu.id === "usr-manager" || cu.name === "Sarah Jenkins")) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    }
  } catch (e) {
    console.warn("Legacy cache check error:", e);
  }

  return {
    currentUser: get(STORAGE_KEYS.CURRENT_USER, null),
    currentEvent: get(STORAGE_KEYS.CURRENT_EVENT, null),
    programmes: get(STORAGE_KEYS.PROGRAMMES, []),
    groups: get(STORAGE_KEYS.GROUPS, []),
    joinedPeople: get(STORAGE_KEYS.JOINED_PEOPLE, []),
    messages: get(STORAGE_KEYS.MESSAGES, {}),
    roleSlots: get(STORAGE_KEYS.ROLE_SLOTS, []),
    activeView: localStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW) || "landing"
  };
}

export function saveLocalState(state) {
  try {
    if (state.currentUser) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
    else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

    if (state.currentEvent) localStorage.setItem(STORAGE_KEYS.CURRENT_EVENT, JSON.stringify(state.currentEvent));
    else localStorage.removeItem(STORAGE_KEYS.CURRENT_EVENT);

    if (state.programmes) localStorage.setItem(STORAGE_KEYS.PROGRAMMES, JSON.stringify(state.programmes));
    if (state.groups) localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(state.groups));
    if (state.joinedPeople) localStorage.setItem(STORAGE_KEYS.JOINED_PEOPLE, JSON.stringify(state.joinedPeople));
    if (state.messages) localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(state.messages));
    if (state.roleSlots) localStorage.setItem(STORAGE_KEYS.ROLE_SLOTS, JSON.stringify(state.roleSlots));
    if (state.activeView) localStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, state.activeView);
  } catch (err) {
    console.warn("Storage write failed", err);
  }
}

export function resetDemoState() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_EVENT);
  localStorage.removeItem(STORAGE_KEYS.PROGRAMMES);
  localStorage.removeItem(STORAGE_KEYS.GROUPS);
  localStorage.removeItem(STORAGE_KEYS.JOINED_PEOPLE);
  localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  localStorage.removeItem(STORAGE_KEYS.ROLE_SLOTS);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_VIEW);
  location.reload();
}
export const resetAppState = resetDemoState;

// ==============================================================================
// SANGAM (സംഗമം) - Configuration & State Defaults
// Team LINX - Kraft Night 2026
// ==============================================================================

const envUrl = typeof window !== "undefined" && window.ENV_SUPABASE_URL;
const envKey = typeof window !== "undefined" && window.ENV_SUPABASE_ANON_KEY;
const localUrl = typeof localStorage !== "undefined" && localStorage.getItem("sangam_supabase_url");
const localKey = typeof localStorage !== "undefined" && localStorage.getItem("sangam_supabase_anon_key");

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
  ACTIVE_VIEW: "sangam_active_view"
};

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
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_VIEW);
  location.reload();
}
export const resetAppState = resetDemoState;

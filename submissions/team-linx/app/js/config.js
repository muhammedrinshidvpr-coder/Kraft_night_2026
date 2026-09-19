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

// Preset Evaluator Users matching the 4 Hierarchical Roles
export const PRESET_USERS = {
  manager: {
    id: "usr-manager",
    name: "Sarah Jenkins",
    role: "manager",
    roleLabel: "Event Manager (Full Admin)",
    department: "Executive Committee",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sarah"
  },
  overseer: {
    id: "usr-imdad",
    name: "Imdad M.",
    role: "overseer",
    roleLabel: "VIP / Principal Overseer (Read-Only)",
    department: "Advisory Board",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Imdad"
  },
  lead: {
    id: "usr-athul",
    name: "Athul K.",
    role: "lead",
    roleLabel: "Team Leader (Food Coordination)",
    department: "Food Coordination Group",
    assignedGroupId: "grp-food",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Athul"
  },
  volunteer: {
    id: "usr-athira",
    name: "Athira S.",
    role: "volunteer",
    roleLabel: "Worker / Volunteer (Food Team)",
    department: "Food Coordination Group",
    assignedGroupId: "grp-food",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Athira"
  }
};

// Default Initial Event
export const DEFAULT_EVENT = {
  id: "evt-kraft-2026",
  title: "Kraft Night 2026",
  sixDigitCode: "482910",
  venue: "Main Campus & Auditorium",
  status: "active",
  created_at: new Date().toISOString()
};

// Operational Groups (e.g., Food group, Stage & Sound)
export const DEFAULT_GROUPS = [
  {
    id: "grp-food",
    name: "Food Coordination Group",
    icon: "🥗",
    description: "Catering, dining hall management, buffet counters, refreshments",
    leaderId: "usr-athul",
    leaderName: "Athul K.",
    memberCount: 18
  },
  {
    id: "grp-stage",
    name: "Stage & Sound Team",
    icon: "🔊",
    description: "Audio setup, cordless mics, lighting matrix, backstage coordination",
    leaderId: "usr-safti",
    leaderName: "Safti M.",
    memberCount: 12
  },
  {
    id: "grp-vip",
    name: "VIP Protocol & Hospitality",
    icon: "👑",
    description: "Principal, chief guest reception, escort, executive seating",
    leaderId: "usr-aravind",
    leaderName: "Aravind Menon",
    memberCount: 6
  },
  {
    id: "grp-general",
    name: "General Announcements",
    icon: "📢",
    description: "Global broadcasts and inter-departmental notices",
    leaderId: "usr-manager",
    leaderName: "Sarah Jenkins",
    memberCount: 36
  }
];

// Joined People Roster (From 6-digit Code entry)
export const DEFAULT_JOINED_PEOPLE = [
  {
    id: "usr-athul",
    name: "Athul K.",
    email: "athul.food@kraft.org",
    role: "lead",
    roleBadge: "Team Leader",
    groupId: "grp-food",
    groupName: "Food Coordination Group",
    status: "active",
    joinedAt: "17:15"
  },
  {
    id: "usr-athira",
    name: "Athira S.",
    email: "athira.vol@kraft.org",
    role: "volunteer",
    roleBadge: "Volunteer",
    groupId: "grp-food",
    groupName: "Food Coordination Group",
    status: "active",
    joinedAt: "17:18"
  },
  {
    id: "usr-imdad",
    name: "Imdad M.",
    email: "imdad.principal@college.edu",
    role: "overseer",
    roleBadge: "VIP Overseer (Principal)",
    groupId: "grp-vip",
    groupName: "VIP Protocol & Hospitality",
    status: "active",
    joinedAt: "17:05"
  },
  {
    id: "usr-alex",
    name: "Alex Ramirez",
    email: "alex.logistics@kraft.org",
    role: "volunteer",
    roleBadge: "Volunteer",
    groupId: "grp-stage",
    groupName: "Stage & Sound Team",
    status: "active",
    joinedAt: "17:22"
  },
  {
    id: "usr-newbie",
    name: "Devanand P.",
    email: "devanand@student.edu",
    role: "volunteer",
    roleBadge: "Awaiting Assignment",
    groupId: null,
    groupName: "Unassigned",
    status: "pending",
    joinedAt: "Just now"
  }
];

// Scheduled Programmes Timeline
export const DEFAULT_PROGRAMMES = [
  {
    id: "prog-1",
    title: "Inauguration & Lighting Ceremony",
    description: "Welcome address by Student Convener, lamp lighting by Principal & Dignitaries.",
    startTime: "18:00",
    endTime: "19:15",
    venue: "Main Auditorium Stage 1",
    status: "completed",
    leadGroup: "VIP Protocol & Hospitality"
  },
  {
    id: "prog-2",
    title: "Cultural Night & Live Bands",
    description: "Battle of the bands, classical fusion dance, student comedy sketch.",
    startTime: "19:30",
    endTime: "21:00",
    venue: "Open Air Amphitheater",
    status: "in_progress",
    leadGroup: "Stage & Sound Team"
  },
  {
    id: "prog-3",
    title: "Grand Banquet & Dinner Coordination",
    description: "Buffet service open for 1,200 delegates and student attendees.",
    startTime: "21:00",
    endTime: "22:30",
    venue: "Dining Hall & Food Court",
    status: "scheduled",
    leadGroup: "Food Coordination Group"
  },
  {
    id: "prog-4",
    title: "Awards & Valedictory Ceremony",
    description: "Hackathon prize distribution, mentor felicitations & closing remarks.",
    startTime: "22:30",
    endTime: "23:45",
    venue: "Main Auditorium Stage 1",
    status: "scheduled",
    leadGroup: "General Coordination"
  }
];

// In-App Chat Messages per Group
export const DEFAULT_MESSAGES = {
  "grp-food": [
    {
      id: "msg-1",
      senderId: "usr-manager",
      senderName: "Sarah (Manager)",
      senderRole: "manager",
      text: "Morning team! Status on catering delivery? @Athul",
      time: "10:31",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sarah"
    },
    {
      id: "msg-2",
      senderId: "usr-athul",
      senderName: "Athul (Team Leader)",
      senderRole: "lead",
      text: "On it, Sarah. Just confirmed departure from the venue. ETA 20 mins.",
      time: "10:32",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Athul"
    },
    {
      id: "msg-3",
      senderId: "usr-athira",
      senderName: "Athira (Volunteer)",
      senderRole: "volunteer",
      text: "Buffet tables are sanitized and serving trays are ready at Hall B.",
      time: "10:33",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Athira"
    },
    {
      id: "msg-4",
      senderId: "usr-manager",
      senderName: "Sarah (Manager)",
      senderRole: "manager",
      text: "Great work! Ensure extra vegetarian plates are allocated for the VIP guest lounge.",
      time: "10:35",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sarah"
    }
  ],
  "grp-stage": [
    {
      id: "msg-10",
      senderId: "usr-alex",
      senderName: "Alex (Logistics)",
      senderRole: "volunteer",
      text: "Loading dock is clear and sound consoles are connected. Audio check starting.",
      time: "10:33",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Alex"
    },
    {
      id: "msg-11",
      senderId: "usr-manager",
      senderName: "Sarah (Manager)",
      senderRole: "manager",
      text: "Keep mics 3 & 4 reserved for the Principal during the Inauguration at 18:00.",
      time: "10:36",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sarah"
    }
  ],
  "grp-vip": [
    {
      id: "msg-20",
      senderId: "usr-manager",
      senderName: "Sarah (Manager)",
      senderRole: "manager",
      text: "Welcome Principal Imdad Sir. You have full read-only oversight across all schedules and groups.",
      time: "10:40",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sarah"
    }
  ],
  "grp-general": [
    {
      id: "msg-30",
      senderId: "usr-manager",
      senderName: "Sarah (Manager)",
      senderRole: "manager",
      text: "📢 All teams: Event starts promptly at 18:00. Please ensure all station leads are in position by 17:30.",
      time: "10:45",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sarah"
    }
  ]
};

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

  return {
    currentUser: get(STORAGE_KEYS.CURRENT_USER, PRESET_USERS.manager),
    currentEvent: get(STORAGE_KEYS.CURRENT_EVENT, DEFAULT_EVENT),
    programmes: get(STORAGE_KEYS.PROGRAMMES, DEFAULT_PROGRAMMES),
    groups: get(STORAGE_KEYS.GROUPS, DEFAULT_GROUPS),
    joinedPeople: get(STORAGE_KEYS.JOINED_PEOPLE, DEFAULT_JOINED_PEOPLE),
    messages: get(STORAGE_KEYS.MESSAGES, DEFAULT_MESSAGES),
    activeView: localStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW) || "landing"
  };
}

export function saveLocalState(state) {
  try {
    if (state.currentUser) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
    if (state.currentEvent) localStorage.setItem(STORAGE_KEYS.CURRENT_EVENT, JSON.stringify(state.currentEvent));
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
  localStorage.removeItem(STORAGE_KEYS.CURRENT_EVENT);
  localStorage.removeItem(STORAGE_KEYS.PROGRAMMES);
  localStorage.removeItem(STORAGE_KEYS.GROUPS);
  localStorage.removeItem(STORAGE_KEYS.JOINED_PEOPLE);
  localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_VIEW);
  location.reload();
}

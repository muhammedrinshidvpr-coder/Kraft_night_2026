// ==============================================================================
// SANGAM - Supabase Live Client & Realtime Sync Engine
// Team LINX • Kraft Night 2026
// ==============================================================================

import {
  CONFIG,
  DEFAULT_EVENT,
  DEFAULT_GROUPS,
  DEFAULT_PROGRAMMES,
  DEFAULT_JOINED_PEOPLE,
  DEFAULT_MESSAGES,
  PRESET_USERS
} from "./config.js";

let _client = null;
let _connectionStatus = "offline"; // "live" | "connecting" | "offline"
const _statusListeners = [];
let _isSeeding = false;

export function getConnectionStatus() {
  return _connectionStatus;
}

export function onStatusChange(callback) {
  _statusListeners.push(callback);
  callback(_connectionStatus);
}

function setStatus(status, detail = "") {
  _connectionStatus = status;
  console.log(`[Sangam Supabase] Status changed: ${status} ${detail ? "(" + detail + ")" : ""}`);
  _statusListeners.forEach((fn) => {
    try {
      fn(_connectionStatus, detail);
    } catch (e) {
      console.error("Status listener error:", e);
    }
  });
}

export function isLive() {
  return (
    CONFIG.USE_LIVE_BACKEND === true &&
    typeof CONFIG.SUPABASE_URL === "string" &&
    CONFIG.SUPABASE_URL.startsWith("https://") &&
    !CONFIG.SUPABASE_URL.includes("xyzcompany") &&
    CONFIG.SUPABASE_ANON_KEY !== "public-anon-key-placeholder"
  );
}

export async function getSupabase() {
  if (_client) return _client;
  if (!isLive()) {
    setStatus("offline", "Live backend disabled or unconfigured");
    return null;
  }

  setStatus("connecting", "Initializing client...");

  try {
    const { createClient } = await import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
    );

    _client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    // Check connectivity
    const isHealthy = await testConnection(_client);
    if (isHealthy) {
      setStatus("live", "Connected to Supabase Realtime");
      // Production setup applies the numbered migrations and seeds a manager
      // explicitly. The old auto-seeder uses legacy string IDs and must not
      // mutate a migration-backed database.
    } else {
      setStatus("offline", "Supabase unreachable");
    }

    return _client;
  } catch (err) {
    console.error("[Sangam Supabase] Failed to initialize Supabase:", err);
    setStatus("offline", err.message);
    return null;
  }
}

export async function testConnection(client = _client) {
  if (!client) return false;
  try {
    const { error } = await client.from("events").select("id").limit(1);
    if (error) {
      console.warn("[Sangam Supabase] Connection ping notice (table may need schema run):", error.message);
      // Even if table doesn't exist yet, client is configured
      return true;
    }
    return true;
  } catch (e) {
    console.warn("[Sangam Supabase] Ping exception:", e);
    return false;
  }
}

// Auto-seed database with Kraft Night 2026 default state if tables are empty
export async function autoSeedDatabase(client) {
  if (!client || _isSeeding) return;
  _isSeeding = true;

  try {
    const { data: existingEvents, error: evError } = await client
      .from("events")
      .select("id")
      .limit(1);

    if (evError) {
      console.warn("[Sangam Supabase] Could not query events table (please execute schema.sql in Supabase):", evError.message);
      _isSeeding = false;
      return;
    }

    // If events table already has data, no seeding needed
    if (existingEvents && existingEvents.length > 0) {
      console.log("[Sangam Supabase] Remote database already initialized with events.");
      _isSeeding = false;
      return;
    }

    console.log("[Sangam Supabase] 🚀 Empty database detected! Auto-seeding default Kraft Night 2026 data...");

    // 1. Seed Event
    await client.from("events").upsert([
      {
        id: DEFAULT_EVENT.id,
        title: DEFAULT_EVENT.title,
        six_digit_code: DEFAULT_EVENT.sixDigitCode,
        venue: DEFAULT_EVENT.venue,
        status: DEFAULT_EVENT.status,
        manager_id: "usr-manager"
      }
    ]);

    // 2. Seed Preset Profiles
    const profileRows = Object.values(PRESET_USERS).map((u) => ({
      id: u.id,
      full_name: u.name,
      email: `${u.role}@kraft.org`,
      avatar_url: u.avatar,
      role: u.role,
      department: u.department
    }));
    await client.from("profiles").upsert(profileRows);

    // 3. Seed Event Groups
    const groupRows = DEFAULT_GROUPS.map((g) => ({
      id: g.id,
      event_id: DEFAULT_EVENT.id,
      name: g.name,
      description: g.description,
      icon: g.icon,
      leader_id: g.leaderId,
      leader_name: g.leaderName,
      member_count: g.memberCount
    }));
    await client.from("event_groups").upsert(groupRows);

    // 4. Seed Programmes Timeline
    const progRows = DEFAULT_PROGRAMMES.map((p) => ({
      id: p.id,
      event_id: DEFAULT_EVENT.id,
      title: p.title,
      description: p.description,
      start_time: p.startTime,
      end_time: p.endTime,
      venue: p.venue,
      status: p.status,
      lead_group: p.leadGroup
    }));
    await client.from("programmes").upsert(progRows);

    // 5. Seed Event Members
    const memberRows = DEFAULT_JOINED_PEOPLE.map((m) => ({
      id: "mem-" + m.id,
      event_id: DEFAULT_EVENT.id,
      user_id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      role_badge: m.roleBadge,
      assigned_group_id: m.groupId,
      group_name: m.groupName,
      status: m.status
    }));
    await client.from("event_members").upsert(memberRows);

    // 6. Seed Initial Chat Messages
    const chatRows = [];
    for (const [groupId, msgs] of Object.entries(DEFAULT_MESSAGES)) {
      for (const m of msgs) {
        chatRows.push({
          id: m.id,
          group_id: groupId,
          sender_id: m.senderId,
          sender_name: m.senderName,
          sender_role: m.senderRole,
          message_text: m.text,
          avatar: m.avatar,
          time: m.time
        });
      }
    }
    if (chatRows.length > 0) {
      await client.from("chat_messages").upsert(chatRows);
    }

    console.log("🌱 [Sangam Supabase] Auto-seed complete: Events, Groups, Schedule, and Chat initialized in Supabase!");
  } catch (err) {
    console.warn("[Sangam Supabase] Auto-seed exception:", err);
  } finally {
    _isSeeding = false;
  }
}

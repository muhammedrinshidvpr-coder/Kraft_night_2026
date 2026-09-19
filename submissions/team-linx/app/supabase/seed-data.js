// ==============================================================================
// SANGAM - Seed Database Directly to Supabase
// Team LINX • Kraft Night 2026
// ==============================================================================

import {
  DEFAULT_EVENT,
  DEFAULT_GROUPS,
  DEFAULT_PROGRAMMES,
  DEFAULT_JOINED_PEOPLE,
  DEFAULT_MESSAGES,
  PRESET_USERS
} from "../js/config.js";

const SUPABASE_URL = "https://jjbjwpogfpqishghayje.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqYmp3cG9nZnBxaXNoZ2hheWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTM5MzQsImV4cCI6MjEwNTM4OTkzNH0.8YuHgf5GfJjfQuVPS11nd5rZq7ek7Zu7pgLKOHRiq18";

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates"
};

async function post(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Error inserting into ${table}:`, err);
  } else {
    console.log(`✅ Seeded ${table}`);
  }
}

async function main() {
  console.log("🌱 Seeding Kraft Night 2026 default data to Supabase...");

  // 1. Events
  await post("events", [
    {
      id: DEFAULT_EVENT.id,
      title: DEFAULT_EVENT.title,
      six_digit_code: DEFAULT_EVENT.sixDigitCode,
      venue: DEFAULT_EVENT.venue,
      status: DEFAULT_EVENT.status,
      manager_id: "usr-manager"
    }
  ]);

  // 2. Profiles
  const profiles = Object.values(PRESET_USERS).map((u) => ({
    id: u.id,
    full_name: u.name,
    email: `${u.role}@kraft.org`,
    avatar_url: u.avatar,
    role: u.role,
    department: u.department
  }));
  await post("profiles", profiles);

  // 3. Event Groups
  const groups = DEFAULT_GROUPS.map((g) => ({
    id: g.id,
    event_id: DEFAULT_EVENT.id,
    name: g.name,
    description: g.description,
    icon: g.icon,
    leader_id: g.leaderId,
    leader_name: g.leaderName,
    member_count: g.memberCount
  }));
  await post("event_groups", groups);

  // 4. Programmes
  const programmes = DEFAULT_PROGRAMMES.map((p) => ({
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
  await post("programmes", programmes);

  // 5. Members
  const members = DEFAULT_JOINED_PEOPLE.map((m) => ({
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
  await post("event_members", members);

  // 6. Chat Messages
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
  await post("chat_messages", chatRows);

  console.log("🎉 All tables seeded in Supabase successfully!");
}

main();

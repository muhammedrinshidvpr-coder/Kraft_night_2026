// ==============================================================================
// SANGAM - Supabase Live Client & Realtime Sync Engine
// Team LINX • Kraft Night 2026
// ==============================================================================

import { CONFIG } from "./config.js";

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

// Auto-seed database disabled in production (events created from scratch)
export async function autoSeedDatabase() {
  return;
}

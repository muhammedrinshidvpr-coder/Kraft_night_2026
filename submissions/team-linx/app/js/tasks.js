// ==============================================================================
// SANGAM (സംഗമം) - Programmes Timeline & Task Scheduler with Supabase Realtime
// Team LINX • Kraft Night 2026
// ==============================================================================

import { DEFAULT_PROGRAMMES, STORAGE_KEYS } from "./config.js";
import { auth } from "./auth.js";
import { getSupabase, isLive } from "./supabase-client.js";

/**
 * Parses a time string (24h "19:30" or 12h "07:30 PM") into minutes from midnight.
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const str = timeStr.trim();
  const match = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3] ? match[3].toUpperCase() : null;

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

class TaskManager {
  constructor() {
    this.programmes = this.loadProgrammes();
    this.listeners = [];
    this.realtimeChannel = null;

    // Run initial real-time sync against current clock
    this.syncStatusesWithRealTime();

    // Re-evaluate statuses every 30 seconds as real time moves forward
    if (typeof window !== "undefined") {
      setInterval(() => {
        this.syncStatusesWithRealTime();
      }, 30000);
    }

    // Initialize Supabase Realtime if live backend is enabled
    this.initLiveBackend();
  }

  loadProgrammes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROGRAMMES);
      return stored ? JSON.parse(stored) : [...DEFAULT_PROGRAMMES];
    } catch {
      return [...DEFAULT_PROGRAMMES];
    }
  }

  async initLiveBackend() {
    if (!isLive()) return;

    try {
      const sb = await getSupabase();
      if (!sb) return;

      // 1. Fetch remote programmes
      const { data, error } = await sb
        .from("programmes")
        .select("*")
        .order("start_time", { ascending: true });

      if (!error && data && data.length > 0) {
        this.programmes = data.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description || "",
          startTime: r.start_time,
          endTime: r.end_time,
          venue: r.venue,
          status: r.status,
          leadGroup: r.lead_group || "General Coordination"
        }));
        this.syncStatusesWithRealTime();
        this.saveAndNotify("Synced programmes timeline with Supabase");
        console.log(`[Sangam Tasks] Loaded ${data.length} programmes from Supabase.`);
      }

      // 2. Subscribe to Realtime WebSocket channel for timeline updates
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
      }

      this.realtimeChannel = sb
        .channel("sangam-realtime-programmes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "programmes" },
          (payload) => {
            console.log("⏱️ [Sangam Tasks] Realtime schedule event:", payload.eventType);

            if (payload.eventType === "INSERT") {
              const r = payload.new;
              if (!this.programmes.some((p) => p.id === r.id)) {
                this.programmes.push({
                  id: r.id,
                  title: r.title,
                  description: r.description || "",
                  startTime: r.start_time,
                  endTime: r.end_time,
                  venue: r.venue,
                  status: r.status,
                  leadGroup: r.lead_group || "General Coordination"
                });
                this.programmes.sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
                this.saveAndNotify(`Realtime: New programme "${r.title}" added`);
              }
            } else if (payload.eventType === "UPDATE") {
              const r = payload.new;
              const idx = this.programmes.findIndex((p) => p.id === r.id);
              if (idx !== -1) {
                this.programmes[idx] = {
                  ...this.programmes[idx],
                  title: r.title,
                  description: r.description || "",
                  startTime: r.start_time,
                  endTime: r.end_time,
                  venue: r.venue,
                  status: r.status,
                  leadGroup: r.lead_group
                };
                this.saveAndNotify(`Realtime: "${r.title}" status updated to ${r.status.toUpperCase()}`);
              }
            } else if (payload.eventType === "DELETE") {
              const oldId = payload.old?.id;
              if (oldId) {
                this.programmes = this.programmes.filter((p) => p.id !== oldId);
                this.saveAndNotify("Realtime: Programme removed");
              }
            }
          }
        )
        .subscribe((status) => {
          console.log(`[Sangam Tasks] Realtime programmes subscription status: ${status}`);
        });
    } catch (err) {
      console.warn("[Sangam Tasks] Realtime setup notice:", err);
    }
  }

  syncStatusesWithRealTime(targetDate = new Date()) {
    const currentMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();
    let hasChanges = false;

    this.programmes.forEach((prog) => {
      const start = parseTimeToMinutes(prog.startTime);
      const end = parseTimeToMinutes(prog.endTime);
      if (start === null || end === null) return;

      let expectedStatus = "scheduled";
      if (end >= start) {
        if (currentMinutes >= start && currentMinutes < end) {
          expectedStatus = "in_progress";
        } else if (currentMinutes >= end) {
          expectedStatus = "completed";
        } else {
          expectedStatus = "scheduled";
        }
      } else {
        // Event spans across midnight
        if (currentMinutes >= start || currentMinutes < end) {
          expectedStatus = "in_progress";
        } else {
          expectedStatus = "completed";
        }
      }

      if (prog.status !== expectedStatus) {
        prog.status = expectedStatus;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveAndNotify("Realtime schedule status auto-refreshed");
    }
    return hasChanges;
  }

  getProgrammes() {
    return this.programmes;
  }

  addProgramme(prog) {
    if (!auth.canCreateProgramme()) {
      alert("Permission Denied: Only the Event Manager can schedule programs.");
      return null;
    }

    const newProg = {
      id: "prog-" + Date.now(),
      title: prog.title || "Untitled Programme",
      description: prog.description || "",
      startTime: prog.startTime || "18:00",
      endTime: prog.endTime || "19:00",
      venue: prog.venue || "Main Stage",
      status: prog.status || "scheduled",
      leadGroup: prog.leadGroup || "General Coordination"
    };

    this.programmes.push(newProg);
    // Sort chronologically by startTime
    this.programmes.sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
    this.syncStatusesWithRealTime();
    this.saveAndNotify("Programme Scheduled: " + newProg.title);

    // Broadcast to Supabase
    if (isLive()) {
      getSupabase().then((sb) => {
        if (sb) {
          sb.from("programmes")
            .insert([
              {
                id: newProg.id,
                event_id: "evt-kraft-2026",
                title: newProg.title,
                description: newProg.description,
                start_time: newProg.startTime,
                end_time: newProg.endTime,
                venue: newProg.venue,
                status: newProg.status,
                lead_group: newProg.leadGroup
              }
            ])
            .then(({ error }) => {
              if (error) console.warn("[Sangam Tasks] Supabase insert error:", error);
            });
        }
      });
    }

    return newProg;
  }

  cycleProgrammeStatus(progId) {
    if (!auth.canEditProgramme()) {
      alert("Permission Denied: Overseer (VIP), Leaders and Volunteers cannot alter the schedule timeline.");
      return;
    }

    const prog = this.programmes.find((p) => p.id === progId);
    if (prog) {
      const cycle = {
        scheduled: "in_progress",
        in_progress: "delayed",
        delayed: "completed",
        completed: "scheduled"
      };
      prog.status = cycle[prog.status] || "scheduled";
      this.saveAndNotify(`Programme "${prog.title}" status changed to ${prog.status.toUpperCase()}`);

      // Broadcast update to Supabase
      if (isLive()) {
        getSupabase().then((sb) => {
          if (sb) {
            sb.from("programmes")
              .update({ status: prog.status })
              .eq("id", progId)
              .then(({ error }) => {
                if (error) console.warn("[Sangam Tasks] Supabase update error:", error);
              });
          }
        });
      }
    }
  }

  deleteProgramme(progId) {
    if (!auth.canCreateProgramme()) {
      alert("Permission Denied: Only the Event Manager can remove scheduled programmes.");
      return;
    }
    this.programmes = this.programmes.filter((p) => p.id !== progId);
    this.saveAndNotify("Programme removed");

    if (isLive()) {
      getSupabase().then((sb) => {
        if (sb) {
          sb.from("programmes")
            .delete()
            .eq("id", progId)
            .then(({ error }) => {
              if (error) console.warn("[Sangam Tasks] Supabase delete error:", error);
            });
        }
      });
    }
  }

  getStats() {
    const total = this.programmes.length;
    const completed = this.programmes.filter((p) => p.status === "completed").length;
    const inProgress = this.programmes.filter((p) => p.status === "in_progress").length;
    const delayed = this.programmes.filter((p) => p.status === "delayed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, delayed, completionRate };
  }

  saveAndNotify(actionDescription = "") {
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRAMMES, JSON.stringify(this.programmes));
    } catch (e) {
      console.warn("Could not save programmes to storage", e);
    }

    for (const listener of this.listeners) {
      try {
        listener(this.programmes, actionDescription);
      } catch (e) {
        console.error("Task listener error", e);
      }
    }
  }

  onProgrammesChange(callback) {
    this.listeners.push(callback);
    callback(this.programmes, "initial");
  }
}

export const taskManager = new TaskManager();

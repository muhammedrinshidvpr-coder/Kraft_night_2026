// ==============================================================================
// SANGAM (സംഗമം) - Programmes Timeline & Task Scheduler with Supabase Realtime
// Team LINX • Kraft Night 2026
//
// Authority rule: when the live backend is enabled, Supabase is the source of
// truth for the ACTIVE event only. Every event switch reloads the full server
// schedule (including an empty schedule) and rebinds a filtered realtime
// subscription. Local caches from other events are never mixed in.
// Manager writes are awaited: a failed insert/update/delete rolls the local
// list back and exposes a retryable sync error instead of masquerading as
// shared data.
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

function getActiveEventId() {
  try {
    const raw = localStorage.getItem("sangam_current_event");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed.id;
    }
  } catch {}
  return null;
}

function mapRowToProgramme(r, fallbackEventId = null) {
  return {
    id: r.id,
    eventId: r.event_id || fallbackEventId,
    event_id: r.event_id || fallbackEventId,
    title: r.title,
    description: r.description || "",
    startTime: r.start_time,
    endTime: r.end_time,
    start_time: r.start_time,
    end_time: r.end_time,
    venue: r.venue || "Main Stage",
    venueOrStage: r.venue || "Main Stage",
    status: r.status || "scheduled",
    leadGroup: r.lead_group || "General Coordination",
  };
}

class TaskManager {
  constructor() {
    this.programmes = this.loadProgrammes();
    this.listeners = [];
    this.syncListeners = [];
    this.realtimeChannel = null;
    this.activeEventId = getActiveEventId();
    this.syncState = "idle"; // idle | loading | live | offline | error
    this.realtimeStatus = "offline";
    this.lastSyncError = null; // { message, actionLabel, retry }
    this.pendingFailedOp = null;
    this.lastLocalBeforeServerSync = null;

    // Run initial real-time sync against current clock
    this.syncStatusesWithRealTime();

    // Re-evaluate statuses every 30 seconds as real time moves forward
    if (typeof window !== "undefined") {
      setInterval(() => {
        this.syncStatusesWithRealTime();
      }, 30000);
    }

    // AppController activates the current event after it has captured any
    // manager recovery backup. Starting a fetch during module evaluation can
    // otherwise overwrite that local schedule before the UI can offer it.
  }

  loadProgrammes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROGRAMMES);
      return stored ? JSON.parse(stored) : [...DEFAULT_PROGRAMMES];
    } catch {
      return [...DEFAULT_PROGRAMMES];
    }
  }

  setProgrammes(list = []) {
    this.programmes = Array.isArray(list) ? [...list] : [];
    this.saveAndNotify("Programmes reset");
  }

  // ---------------------------------------------------------- sync observability
  onSyncChange(callback) {
    if (typeof callback !== "function") return () => {};
    this.syncListeners.push(callback);
    try {
      callback(this.getSyncSnapshot());
    } catch {}
    return () => {
      this.syncListeners = this.syncListeners.filter((fn) => fn !== callback);
    };
  }

  getSyncSnapshot() {
    return {
      activeEventId: this.activeEventId,
      syncState: this.syncState,
      realtimeStatus: this.realtimeStatus,
      lastSyncError: this.lastSyncError
        ? { message: this.lastSyncError.message, actionLabel: this.lastSyncError.actionLabel }
        : null,
      hasPendingRetry: Boolean(this.pendingFailedOp),
    };
  }

  notifySync() {
    const snap = this.getSyncSnapshot();
    for (const fn of this.syncListeners) {
      try {
        fn(snap);
      } catch (e) {
        console.error("Programme sync listener error", e);
      }
    }
  }

  setSyncError(message, retryFn = null, actionLabel = "Retry") {
    this.syncState = "error";
    this.lastSyncError = message ? { message, retry: retryFn, actionLabel } : null;
    this.notifySync();
  }

  clearSyncError() {
    this.lastSyncError = null;
    if (this.syncState === "error") {
      this.syncState = this.activeEventId && isLive() ? "live" : this.syncState;
    }
    this.notifySync();
  }

  getLastSyncError() {
    return this.lastSyncError;
  }

  async retryPendingOperation() {
    const op = this.pendingFailedOp;
    this.pendingFailedOp = null;
    this.clearSyncError();
    if (!op) {
      return this.refreshActiveEvent();
    }
    try {
      if (op.type === "add") return this.addProgramme(op.payload, { skipOptimistic: false, isRetry: true });
      if (op.type === "update") return this.updateProgramme(op.id, op.payload, { isRetry: true });
      if (op.type === "delete") return this.deleteProgramme(op.id, { isRetry: true });
      if (op.type === "cycle") {
        const prog = this.programmes.find((p) => p.id === op.id);
        if (prog) return this.updateProgramme(op.id, { status: op.payload?.status || prog.status }, { isRetry: true });
      }
    } catch (e) {
      console.warn("[Sangam Tasks] Retry failed:", e);
    }
    return null;
  }

  // ---------------------------------------------------------- active-event sync
  async initLiveBackend() {
    if (!isLive()) {
      this.syncState = "offline";
      this.notifySync();
      return;
    }
    await this.setActiveEvent(getActiveEventId());
  }

  async setActiveEvent(eventId) {
    const nextId = eventId || null;
    const changed = nextId !== this.activeEventId;
    // Keep a recovery copy before an authoritative refresh clears stale rows.
    // AppController decides whether the manager should be offered recovery.
    if (isLive() && nextId && this.programmes.length) {
      this.lastLocalBeforeServerSync = [...this.programmes];
    }
    this.activeEventId = nextId;
    this.teardownRealtime();

    if (!isLive() || !nextId) {
      this.syncState = isLive() ? "idle" : "offline";
      this.realtimeStatus = "offline";
      this.notifySync();
      return;
    }

    // Do not show the outgoing event while the incoming event is loading.
    // The backup above retains manager recovery data without leaking it into
    // another event's visible schedule.
    this.programmes = [];
    this.saveAndNotify("Loading shared programmes for active event");

    // Rebinding on every activation keeps two events from ever sharing rows,
    // even if the caller forgot to clear local state first.
    await this.refreshActiveEvent({ preserveLocalBackup: changed });
  }

  clearActiveEvent() {
    this.activeEventId = null;
    this.teardownRealtime();
    this.pendingFailedOp = null;
    this.lastSyncError = null;
    this.syncState = "idle";
    this.notifySync();
  }

  teardownRealtime() {
    try {
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
      }
    } catch {}
    this.realtimeChannel = null;
    this.realtimeStatus = "offline";
  }

  async refreshActiveEvent(opts = {}) {
    const eventId = this.activeEventId || getActiveEventId();
    if (!eventId) return;
    this.activeEventId = eventId;
    if (!isLive()) {
      this.syncState = "offline";
      this.notifySync();
      return;
    }
    this.syncState = "loading";
    this.notifySync();
    // Keep the manager's pre-refresh list so the workspace can offer a
    // reviewed one-time publish instead of silently discarding local work.
    if (opts.preserveLocalBackup && this.programmes.length) {
      this.lastLocalBeforeServerSync = [...this.programmes];
    }
    try {
      const sb = await getSupabase();
      if (!sb) {
        if (this.activeEventId !== eventId) return;
        this.setSyncError("Could not connect to the shared schedule.", () => this.refreshActiveEvent());
        return;
      }
      const { data, error } = await sb
        .from("programmes")
        .select("*")
        .eq("event_id", eventId)
        .order("start_time", { ascending: true });
      if (error) throw error;
      // A newer event activation won while this request was in flight. Never
      // let a slow response replace the current event's schedule.
      if (this.activeEventId !== eventId) return;
      // Authoritative replace: an empty server schedule MUST clear stale
      // local rows so events never leak into each other.
      this.programmes = (data || []).map((r) => mapRowToProgramme(r, eventId));
      this.pendingFailedOp = null;
      this.lastSyncError = null;
      this.syncState = "live";
      this.syncStatusesWithRealTime();
      this.saveAndNotify("Synced programmes timeline with Supabase");
      this.notifySync();
      console.log(`[Sangam Tasks] Loaded ${this.programmes.length} programmes for event ${eventId}.`);
    } catch (err) {
      if (this.activeEventId !== eventId) return;
      console.warn("[Sangam Tasks] Schedule refresh failed:", err);
      this.setSyncError(
        err?.message || "Could not load the shared schedule.",
        () => this.refreshActiveEvent()
      );
      return;
    }
    if (opts.subscribe !== false) this.subscribeToActiveEvent();
  }

  subscribeToActiveEvent() {
    const eventId = this.activeEventId;
    if (!eventId || !isLive()) return;
    getSupabase().then((sb) => {
      if (!sb || this.activeEventId !== eventId) return;
      this.teardownRealtime();
      this.realtimeChannel = sb
        .channel(`sangam-realtime-programmes-${eventId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "programmes", filter: `event_id=eq.${eventId}` },
          (payload) => {
            // Defensive second check: never apply another event's row even if
            // the broker delivers outside the requested filter.
            const incomingEventId = payload?.new?.event_id || payload?.old?.event_id || null;
            if (incomingEventId && incomingEventId !== this.activeEventId) return;
            console.log("⏱️ [Sangam Tasks] Realtime schedule event:", payload.eventType);

            if (payload.eventType === "INSERT") {
              const r = payload.new;
              if (!r || (r.event_id && r.event_id !== this.activeEventId)) return;
              if (!this.programmes.some((p) => p.id === r.id)) {
                this.programmes.push(mapRowToProgramme(r, this.activeEventId));
                this.programmes.sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
                this.saveAndNotify(`Realtime: New programme "${r.title}" added`);
              }
            } else if (payload.eventType === "UPDATE") {
              const r = payload.new;
              if (!r || (r.event_id && r.event_id !== this.activeEventId)) return;
              const idx = this.programmes.findIndex((p) => p.id === r.id);
              if (idx !== -1) {
                this.programmes[idx] = {
                  ...this.programmes[idx],
                  ...mapRowToProgramme(r, this.activeEventId),
                };
                this.saveAndNotify(`Realtime: "${r.title}" updated`);
              } else {
                // Update for a row we do not hold (e.g. missed INSERT):
                // fetch authority rather than guessing.
                this.refreshActiveEvent();
              }
            } else if (payload.eventType === "DELETE") {
              const oldId = payload.old?.id;
              const oldEventId = payload.old?.event_id || null;
              if (oldEventId && oldEventId !== this.activeEventId) return;
              if (oldId) {
                this.programmes = this.programmes.filter((p) => p.id !== oldId);
                this.saveAndNotify("Realtime: Programme removed");
              }
            }
          }
        )
        .subscribe((status) => {
          if (this.activeEventId !== eventId) return;
          this.realtimeStatus = String(status || "offline").toLowerCase();
          console.log(`[Sangam Tasks] Realtime programmes subscription status: ${status}`);
          if (this.realtimeStatus === "subscribed") {
            if (this.syncState !== "error") {
              this.syncState = "live";
            }
            // Close the select → subscribe race: any write committed after
            // the first server load but before this channel joined is picked
            // up by one authoritative refresh without rebinding the channel.
            this.refreshActiveEvent({ subscribe: false });
          } else if (this.realtimeStatus === "closed" || this.realtimeStatus === "error") {
            this.setSyncError("Live schedule updates paused — reconnecting.", () => this.refreshActiveEvent(), "Reconnect");
          }
          this.notifySync();
        });
    }).catch((err) => {
      console.warn("[Sangam Tasks] Realtime setup notice:", err);
    });
  }

  getLastLocalBeforeServerSync() {
    return this.lastLocalBeforeServerSync ? [...this.lastLocalBeforeServerSync] : null;
  }

  clearLocalBeforeServerSyncBackup() {
    this.lastLocalBeforeServerSync = null;
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

  getActiveEventId() {
    return this.activeEventId;
  }

  resolveEventId() {
    return this.activeEventId || getActiveEventId();
  }

  // ---------------------------------------------------------- manager writes
  // All manager writes are awaited against Supabase. Local state is updated
  // optimistically for responsiveness, but a failed server write rolls back
  // and surfaces a persistent Retry action.
  addProgramme(prog, opts = {}) {
    if (!auth.canCreateProgramme()) {
      alert("Permission Denied: Only the Event Manager can schedule programs.");
      return null;
    }
    const eventId = this.resolveEventId();
    if (isLive() && !eventId) {
      this.setSyncError("Open an event before adding programmes.", () => this.refreshActiveEvent());
      return null;
    }

    const newProg = {
      id: (prog && prog.id) || "prog-" + Date.now(),
      eventId: eventId || prog?.eventId || prog?.event_id || null,
      event_id: eventId || prog?.eventId || prog?.event_id || null,
      title: prog.title || "Untitled Programme",
      description: prog.description || "",
      startTime: prog.startTime || "18:00",
      endTime: prog.endTime || "19:00",
      start_time: prog.startTime || "18:00",
      end_time: prog.endTime || "19:00",
      venue: prog.venue || "Main Stage",
      venueOrStage: prog.venue || "Main Stage",
      status: prog.status || "scheduled",
      leadGroup: prog.leadGroup || "General Coordination"
    };

    if (this.programmes.some((p) => p.id === newProg.id)) {
      newProg.id = "prog-" + Date.now();
    }
    this.programmes.push(newProg);
    // Sort chronologically by startTime
    this.programmes.sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
    this.syncStatusesWithRealTime();
    this.saveAndNotify("Programme Scheduled: " + newProg.title);

    // Broadcast to Supabase (awaited with rollback on failure)
    if (isLive()) {
      const activeEventId = this.resolveEventId() || newProg.eventId;
      const retryPayload = {
        title: newProg.title,
        description: newProg.description,
        startTime: newProg.startTime,
        endTime: newProg.endTime,
        venue: newProg.venue,
        status: newProg.status,
        leadGroup: newProg.leadGroup,
      };
      getSupabase().then(async (sb) => {
        if (!sb) {
          this.rollbackAdd(newProg.id, retryPayload, "Could not reach the shared schedule.");
          return;
        }
        const { error } = await sb.from("programmes").insert([
          {
            id: newProg.id,
            event_id: activeEventId,
            title: newProg.title,
            description: newProg.description,
            start_time: newProg.startTime,
            end_time: newProg.endTime,
            venue: newProg.venue,
            status: newProg.status,
            lead_group: newProg.leadGroup
          }
        ]);
        if (error) {
          this.rollbackAdd(newProg.id, retryPayload, error.message);
        } else {
          this.clearSyncError();
        }
      }).catch((err) => {
        this.rollbackAdd(newProg.id, retryPayload, err?.message);
      });
    }

    return newProg;
  }

  rollbackAdd(progId, payload, message) {
    this.programmes = this.programmes.filter((p) => p.id !== progId);
    this.saveAndNotify("Programme change reverted: save failed");
    // Keep the full programme fields for retry (new id assigned on retry).
    const retryPayload = { ...(payload || {}) };
    delete retryPayload.id;
    this.pendingFailedOp = { type: "add", payload: retryPayload };
    this.setSyncError(
      `Could not save "${payload?.title || "programme"}" to the shared schedule${message ? `: ${message}` : "."} The change was reverted.`,
      () => this.retryPendingOperation()
    );
  }

  async updateProgramme(progId, updates = {}, opts = {}) {
    if (!auth.canEditProgramme()) {
      alert("Permission Denied: Only the Event Manager can edit scheduled programmes.");
      return null;
    }

    const idx = this.programmes.findIndex((p) => p.id === progId);
    if (idx === -1) return null;
    const previous = { ...this.programmes[idx] };
    const prog = this.programmes[idx];

    if (updates.title !== undefined) prog.title = updates.title.trim() || prog.title;
    if (updates.venue !== undefined) prog.venue = updates.venue.trim();
    if (updates.startTime !== undefined) prog.startTime = updates.startTime.trim() || prog.startTime;
    if (updates.endTime !== undefined) prog.endTime = updates.endTime.trim() || prog.endTime;
    if (updates.description !== undefined) prog.description = updates.description.trim();
    if (updates.status !== undefined) prog.status = updates.status.trim() || prog.status;
    if (updates.leadGroup !== undefined) prog.leadGroup = updates.leadGroup.trim() || prog.leadGroup;
    prog.start_time = prog.startTime;
    prog.end_time = prog.endTime;
    prog.venueOrStage = prog.venue;

    // Sort chronologically by startTime
    this.programmes.sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
    this.syncStatusesWithRealTime();
    this.saveAndNotify("Programme Updated: " + prog.title);

    // Broadcast update to Supabase (awaited with rollback on failure)
    if (isLive()) {
      try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Could not reach the shared schedule.");
        const { error } = await sb.from("programmes").update({
          title: prog.title,
          description: prog.description,
          start_time: prog.startTime,
          end_time: prog.endTime,
          venue: prog.venue,
          status: prog.status,
          lead_group: prog.leadGroup
        }).eq("id", progId);
        if (error) throw error;
        this.clearSyncError();
      } catch (err) {
        const restoreIdx = this.programmes.findIndex((p) => p.id === progId);
        if (restoreIdx !== -1) this.programmes[restoreIdx] = previous;
        else this.programmes.push(previous);
        this.programmes.sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
        this.saveAndNotify("Programme change reverted: save failed");
        this.pendingFailedOp = { type: "update", id: progId, payload: { ...updates } };
        this.setSyncError(
          `Could not save "${previous.title}" to the shared schedule${err?.message ? `: ${err.message}` : "."} The change was reverted.`,
          () => this.retryPendingOperation()
        );
        return null;
      }
    }

    return this.programmes.find((p) => p.id === progId) || prog;
  }

  async cycleProgrammeStatus(progId, opts = {}) {
    if (!auth.canEditProgramme()) {
      alert("Permission Denied: Overseer (VIP), Leaders and Volunteers cannot alter the schedule timeline.");
      return;
    }

    const prog = this.programmes.find((p) => p.id === progId);
    if (!prog) return;
    const cycle = {
      scheduled: "in_progress",
      in_progress: "delayed",
      delayed: "completed",
      completed: "scheduled"
    };
    const nextStatus = cycle[prog.status] || "scheduled";
    await this.updateProgramme(progId, { status: nextStatus }, opts);
  }

  async deleteProgramme(progId, opts = {}) {
    if (!auth.canCreateProgramme()) {
      alert("Permission Denied: Only the Event Manager can remove scheduled programmes.");
      return;
    }
    const idx = this.programmes.findIndex((p) => p.id === progId);
    if (idx === -1) return;
    const [removed] = this.programmes.splice(idx, 1);
    this.saveAndNotify("Programme removed");

    if (isLive()) {
      try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Could not reach the shared schedule.");
        const { error } = await sb.from("programmes").delete().eq("id", progId);
        if (error) throw error;
        this.clearSyncError();
      } catch (err) {
        // Roll back the delete so an unsaved removal never masquerades as shared.
        const exists = this.programmes.some((p) => p.id === progId);
        if (!exists) {
          const at = Math.min(idx, this.programmes.length);
          this.programmes.splice(at, 0, removed);
        }
        this.saveAndNotify("Programme delete reverted: save failed");
        this.pendingFailedOp = { type: "delete", id: progId };
        this.setSyncError(
          `Could not delete "${removed.title}" from the shared schedule${err?.message ? `: ${err.message}` : "."} The programme was restored.`,
          () => this.retryPendingOperation()
        );
      }
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

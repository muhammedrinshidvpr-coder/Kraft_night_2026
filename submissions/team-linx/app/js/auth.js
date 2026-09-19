// ==============================================================================
// SANGAM (സംഗമം) - Authentication & Role State Manager
// Team LINX - Kraft Night 2026
// ==============================================================================

import { PRESET_USERS, STORAGE_KEYS } from "./config.js";
import { getSupabase, isLive } from "./supabase-client.js";

function computeInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

class AuthManager {
  constructor() {
    this.currentUser = this.loadSavedUser() || PRESET_USERS.manager;
    this.listeners = [];
  }

  loadSavedUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name && parsed.role) return parsed;
      }
    } catch (e) {
      console.warn("Could not load saved user session:", e);
    }
    return null;
  }

  persistCurrentUser() {
    try {
      if (this.currentUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (e) {
      console.warn("Could not persist user session:", e);
    }
  }

  getRegisteredUsers() {
    try {
      const raw = localStorage.getItem("sangam_registered_users");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {
      console.warn("Could not read registered users:", e);
    }
    return [];
  }

  saveRegisteredUser(record) {
    try {
      const users = this.getRegisteredUsers().filter(u => u.name.toLowerCase() !== record.name.toLowerCase());
      users.push(record);
      localStorage.setItem("sangam_registered_users", JSON.stringify(users));
    } catch (e) {
      console.warn("Could not save registered user:", e);
    }
  }

  async signUp({ name, email, password }) {
    if (!name || name.trim().length < 2) {
      throw new Error("Please enter a valid name (at least 2 characters).");
    }
    if (!password || password.length < 4) {
      throw new Error("Password must be at least 4 characters.");
    }

    const cleanName = name.trim();
    const cleanEmail = email ? email.trim() : `${cleanName.toLowerCase().replace(/\s+/g, "")}@sangam.app`;
    const initials = computeInitials(cleanName);
    const userId = "usr-" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) + "-" + Date.now().toString(36);

    const user = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      avatar: initials,
      role: "manager", // Creator of events starts as Event Manager
      department: "Event Organizer",
      assignedGroupId: null
    };

    // Save to local registry
    this.saveRegisteredUser({
      ...user,
      password: password
    });

    // Try live Supabase sync in background if connected
    if (isLive()) {
      getSupabase().then((sb) => {
        if (sb) {
          sb.from("profiles").upsert({
            id: user.id,
            full_name: user.name,
            email: user.email,
            avatar_url: user.avatar,
            role: user.role,
            department: user.department
          }).catch((err) => {
            console.warn("[Sangam Supabase] Profile upsert notice:", err);
          });
        }
      });
    }

    this.setCustomUser(user);
    return user;
  }

  async signIn({ name, password }) {
    if (!name || name.trim().length === 0) {
      throw new Error("Please enter your name or email.");
    }
    if (!password || password.length < 1) {
      throw new Error("Please enter your password.");
    }

    const q = name.trim().toLowerCase();

    // 1. Check local registered users
    const registered = this.getRegisteredUsers();
    const match = registered.find(u =>
      (u.name && u.name.toLowerCase() === q) ||
      (u.email && u.email.toLowerCase() === q)
    );

    if (match) {
      if (match.password && match.password !== password) {
        throw new Error("Incorrect password. Please try again.");
      }
      const user = {
        id: match.id,
        name: match.name,
        email: match.email,
        avatar: match.avatar || computeInitials(match.name),
        role: match.role || "manager",
        department: match.department || "Event Organizer",
        assignedGroupId: match.assignedGroupId || null
      };
      this.setCustomUser(user);
      return user;
    }

    // 2. Check preset users
    for (const preset of Object.values(PRESET_USERS)) {
      if (
        preset.name.toLowerCase() === q ||
        preset.role.toLowerCase() === q ||
        (preset.name.toLowerCase().includes(q) && q.length >= 3)
      ) {
        this.setCustomUser(preset);
        return preset;
      }
    }

    // 3. Dynamic new manager session
    const initials = computeInitials(name.trim());
    const user = {
      id: "usr-" + name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) + "-" + Date.now().toString(36),
      name: name.trim(),
      email: `${name.trim().toLowerCase().replace(/\s+/g, "")}@sangam.app`,
      avatar: initials,
      role: "manager",
      department: "Event Organizer",
      assignedGroupId: null
    };

    this.saveRegisteredUser({ ...user, password });
    this.setCustomUser(user);
    return user;
  }

  logout() {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch (e) {
      console.warn("Could not clear stored session:", e);
    }
    this.currentUser = PRESET_USERS.manager;
    this.notify();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setRole(roleKey) {
    if (PRESET_USERS[roleKey]) {
      this.currentUser = PRESET_USERS[roleKey];
      this.persistCurrentUser();
      this.notify();
    }
  }

  setCustomUser(userData) {
    this.currentUser = userData;
    this.persistCurrentUser();
    this.notify();
  }

  // Update the operational group assignment of the active persona
  // (used when the Manager reassigns the roster entry matching this user).
  setAssignedGroupId(groupId) {
    this.currentUser = { ...this.currentUser, assignedGroupId: groupId || null };
    this.notify();
  }

  onUserChange(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.error("Auth listener error:", e);
      }
    }
  }

  // --- Role-Based Access Control (RBAC) Permissions ---

  isManager() {
    return this.currentUser.role === "manager";
  }

  isOverseer() {
    return this.currentUser.role === "overseer";
  }

  isLead() {
    return this.currentUser.role === "lead";
  }

  isVolunteer() {
    return this.currentUser.role === "volunteer";
  }

  canCreateProgramme() {
    return this.currentUser.role === "manager";
  }

  canEditProgramme() {
    return this.currentUser.role === "manager";
  }

  canAssignRoles() {
    return this.currentUser.role === "manager";
  }

  canCreateGroup() {
    return this.currentUser.role === "manager";
  }

  canInviteMembers() {
    return this.currentUser.role === "manager";
  }

  canRunAIBriefing() {
    return true; // All roles can query Gemini assistant within their perspective
  }

  // Live group assignment for lead/volunteer personas. Reads the roster entry
  // matching the active persona so Manager reassignments take effect
  // immediately; falls back to the preset's assignedGroupId.
  resolveAssignment() {
    try {
      const roster = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOINED_PEOPLE) || "[]");
      const entry = Array.isArray(roster) && roster.find((p) => p.id === this.currentUser.id);
      if (entry && entry.groupId) return entry.groupId;
    } catch {
      // storage unavailable: use preset fallback below
    }
    return this.currentUser.assignedGroupId || null;
  }

  // Can the current user post a message in this specific group?
  canPostInGroup(groupId) {
    const role = this.currentUser.role;
    if (role === "manager") return true; // Manager can chat in every group
    if (role === "overseer") return false; // VIP Overseer is strictly read-only

    // Team leader or Volunteer can post only in their assigned department
    if (role === "lead" || role === "volunteer") {
      // If group is general, everyone can post or read
      if (groupId === "grp-general") return true;
      // Roster-driven assignment is authoritative when present (reflects
      // Manager reassignments live, overriding seed fallbacks below).
      const assigned = this.resolveAssignment();
      if (assigned) return assigned === groupId;
      // Legacy fallbacks when no roster/preset assignment exists.
      if (groupId === "grp-food" && (this.currentUser.id === "usr-athul" || this.currentUser.id === "usr-athira")) return true;
      if (groupId === "grp-stage" && this.currentUser.id === "usr-alex") return true;
      return false;
    }
    return false;
  }

  // Can the current user view this group channel in their channel list?
  canViewGroup(groupId) {
    const role = this.currentUser.role;
    if (role === "manager" || role === "overseer" || role === "lead") {
      return true; // Manager, VIP, and Team Leaders have cross-channel read access
    }
    // Volunteer only views their assigned channel and general announcements
    if (groupId === "grp-general") return true;
    const assigned = this.resolveAssignment();
    if (assigned) return assigned === groupId;
    if (groupId === "grp-food" && (this.currentUser.id === "usr-athul" || this.currentUser.id === "usr-athira")) return true;
    return false;
  }
}

export const auth = new AuthManager();

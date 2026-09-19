// ==============================================================================
// SANGAM (സംഗമം) - Authentication & Role State Manager
// Team LINX - Kraft Night 2026
// ==============================================================================

import { PRESET_USERS, STORAGE_KEYS } from "./config.js";

class AuthManager {
  constructor() {
    this.currentUser = PRESET_USERS.manager; // Default to Manager
    this.listeners = [];
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setRole(roleKey) {
    if (PRESET_USERS[roleKey]) {
      this.currentUser = PRESET_USERS[roleKey];
      this.notify();
    }
  }

  setCustomUser(userData) {
    this.currentUser = userData;
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

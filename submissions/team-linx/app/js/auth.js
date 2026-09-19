// ==============================================================================
// SANGAM - Authentication & Role State Manager
// Team LINX - Kraft Night 2026
// ==============================================================================

import { PRESET_USERS } from "./config.js";

class AuthManager {
  constructor() {
    this.currentUser = PRESET_USERS.admin; // Default to Admin for evaluators
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

  onUserChange(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  canCreateDepartment() {
    return this.currentUser.role === "admin";
  }

  canInviteMembers() {
    return this.currentUser.role === "admin";
  }

  canAssignTasks() {
    return this.currentUser.role === "admin" || this.currentUser.role === "lead";
  }

  canRunAIBriefing() {
    return this.currentUser.role === "admin" || this.currentUser.role === "lead";
  }
}

export const auth = new AuthManager();

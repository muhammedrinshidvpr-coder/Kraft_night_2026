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
    this.currentUser = this.loadSavedUser() || null;
    this.listeners = [];
  }

  loadSavedUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name) return parsed;
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
    let userId = "usr-" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) + "-" + Date.now().toString(36);
    let canCreateFirstEvent = false;

    if (isLive()) {
      const sb = await getSupabase();
      if (!sb) throw new Error("Unable to connect to Supabase authentication.");
      const { data, error } = await sb.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: cleanName } },
      });
      if (error || !data.user) throw new Error(error?.message || "Could not create your secure account.");
      if (!data.session) {
        const { error: sessionError } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
        if (sessionError) throw new Error(sessionError.message || "Account created, but secure sign-in failed. Please log in.");
      }
      userId = data.user.id;
      canCreateFirstEvent = true;
    }

    let isJoiningWithPin = false;
    try {
      const pendingPin = (typeof sessionStorage !== "undefined" && sessionStorage.getItem("sangam_pending_pin")) ||
        (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pin"));
      if (pendingPin && pendingPin.length === 6) {
        isJoiningWithPin = true;
      }
    } catch {}

    const user = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      avatar: initials,
      role: isJoiningWithPin ? "volunteer" : "manager",
      department: isJoiningWithPin ? "Event Member" : "Event Organizer",
      assignedGroupId: null,
      canCreateFirstEvent: !isJoiningWithPin && canCreateFirstEvent,
    };

    if (isLive()) {
      this.setCustomUser(user);
      return user;
    }

    this.saveRegisteredUser({ ...user, password });
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

    if (isLive()) {
      const sb = await getSupabase();
      if (!sb) throw new Error("Unable to connect to Supabase authentication.");
      let email = q.includes("@") ? q : "";
      let profileName = name.trim();
      if (!email) {
        const { data: profiles } = await sb.from("profiles").select("email, full_name").eq("full_name", name.trim()).limit(1);
        email = profiles?.[0]?.email || "";
        profileName = profiles?.[0]?.full_name || profileName;
      }
      if (!email) throw new Error("Use the email address for your secure Supabase account.");

      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(error?.message || "Could not sign in securely.");
      const { data: profiles } = await sb.from("profiles").select("role").eq("id", data.user.id).limit(1);
      const { data: memberships } = await sb.from("event_members").select("id").eq("user_id", data.user.id).limit(1);
      const isManager = profiles?.[0]?.role === "manager";
      const user = {
        id: data.user.id,
        name: data.user.user_metadata?.full_name || profileName || email,
        email,
        avatar: computeInitials(data.user.user_metadata?.full_name || profileName || email),
        role: isManager ? "manager" : "volunteer",
        department: isManager ? "Event Organizer" : "Event Member",
        assignedGroupId: null,
        canCreateFirstEvent: !isManager && !memberships?.length,
      };
      this.setCustomUser(user);
      return user;
    }

    // Check local registered users
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

    throw new Error("Account not found. Please sign up first.");
  }

  logout() {
    if (isLive()) {
      getSupabase().then((sb) => sb?.auth.signOut()).catch(() => {});
    }
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch (e) {
      console.warn("Could not clear stored session:", e);
    }
    this.currentUser = null;
    this.notify();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setRole(roleKey) {
    if (this.currentUser) {
      this.currentUser.role = roleKey;
      this.persistCurrentUser();
      this.notify();
    }
  }

  setCustomUser(userData) {
    this.currentUser = userData;
    this.persistCurrentUser();
    this.notify();
  }

  setAssignedGroupId(groupId) {
    if (this.currentUser) {
      this.currentUser = { ...this.currentUser, assignedGroupId: groupId || null };
      this.persistCurrentUser();
      this.notify();
    }
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
    return this.currentUser?.role === "manager";
  }

  isOverseer() {
    return this.currentUser?.role === "overseer";
  }

  isLead() {
    return this.currentUser?.role === "lead";
  }

  isVolunteer() {
    return this.currentUser?.role === "volunteer";
  }

  canCreateProgramme() {
    return this.currentUser?.role === "manager";
  }

  canEditProgramme() {
    return this.currentUser?.role === "manager";
  }

  canAssignRoles() {
    return this.currentUser?.role === "manager";
  }

  canCreateGroup() {
    return this.currentUser?.role === "manager";
  }

  canInviteMembers() {
    return this.currentUser?.role === "manager";
  }

  canRunAIBriefing() {
    return this.currentUser?.role === "manager" || this.currentUser?.canCreateFirstEvent === true;
  }

  resolveAssignment() {
    if (!this.currentUser) return null;
    try {
      const roster = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOINED_PEOPLE) || "[]");
      const entry = Array.isArray(roster) && roster.find((p) => p.id === this.currentUser.id);
      if (entry && entry.groupId) return entry.groupId;
    } catch {
    }
    return this.currentUser.assignedGroupId || null;
  }

  canPostInGroup(groupId) {
    if (!this.currentUser) return false;
    const role = this.currentUser.role;
    if (role === "manager") return true;
    if (role === "overseer") return false;

    if (role === "lead" || role === "volunteer") {
      if (groupId === "grp-general") return true;
      const assigned = this.resolveAssignment();
      if (assigned) return assigned === groupId;
      return false;
    }
    return false;
  }

  canViewGroup(groupId) {
    if (!this.currentUser) return false;
    const role = this.currentUser.role;
    if (role === "manager" || role === "overseer" || role === "lead") {
      return true;
    }
    if (groupId === "grp-general") return true;
    const assigned = this.resolveAssignment();
    if (assigned) return assigned === groupId;
    return false;
  }
}

export const auth = new AuthManager();

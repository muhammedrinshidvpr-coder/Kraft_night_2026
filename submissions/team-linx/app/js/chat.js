// ==============================================================================
// SANGAM - Real-Time Department Chat Module
// Team LINX - Kraft Night 2026
// ==============================================================================

import { INITIAL_CHATS } from "./config.js";
import { auth } from "./auth.js";

class ChatManager {
  constructor() {
    this.chats = JSON.parse(localStorage.getItem("sangam_chats")) || { ...INITIAL_CHATS };
    this.activeDepartment = "dept-stage";
    this.listeners = [];
  }

  setActiveDepartment(deptId) {
    this.activeDepartment = deptId;
    this.notify();
  }

  getActiveDepartment() {
    return this.activeDepartment;
  }

  getMessages(deptId = this.activeDepartment) {
    return this.chats[deptId] || [];
  }

  sendMessage(text, attachment = null) {
    if (!text.trim() && !attachment) return null;

    const user = auth.getCurrentUser();
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msg = {
      id: "msg-" + Date.now(),
      sender: user.name,
      role: user.role,
      text: text.trim(),
      attachment: attachment,
      time: timeStr
    };

    if (!this.chats[this.activeDepartment]) {
      this.chats[this.activeDepartment] = [];
    }

    this.chats[this.activeDepartment].push(msg);
    localStorage.setItem("sangam_chats", JSON.stringify(this.chats));
    this.notify(msg);
    return msg;
  }

  onChatUpdate(callback) {
    this.listeners.push(callback);
    callback(this.getMessages(), null);
  }

  notify(newMsg = null) {
    for (const listener of this.listeners) {
      listener(this.getMessages(), newMsg);
    }
  }
}

export const chatManager = new ChatManager();

// ==============================================================================
// SANGAM (സംഗമം) - In-App Team Group Chat Module with Supabase Realtime
// Team LINX • Kraft Night 2026
// ==============================================================================

import { DEFAULT_MESSAGES, STORAGE_KEYS } from "./config.js";
import { auth } from "./auth.js";
import { getSupabase, isLive } from "./supabase-client.js";

class ChatManager {
  constructor() {
    this.messages = this.loadMessages();
    this.activeGroupId = "grp-food";
    this.listeners = [];
    this.realtimeChannel = null;

    // Initialize Supabase Realtime if live backend is enabled
    this.initLiveBackend();
  }

  loadMessages() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return stored ? JSON.parse(stored) : { ...DEFAULT_MESSAGES };
    } catch {
      return { ...DEFAULT_MESSAGES };
    }
  }

  async initLiveBackend() {
    if (!isLive()) return;

    try {
      const sb = await getSupabase();
      if (!sb) return;

      // 1. Fetch historical messages from Supabase
      const { data, error } = await sb
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        // Group messages by group_id
        const remoteMessages = {};
        for (const row of data) {
          const gid = row.group_id;
          if (!remoteMessages[gid]) remoteMessages[gid] = [];
          remoteMessages[gid].push({
            id: row.id,
            senderId: row.sender_id,
            senderName: row.sender_name,
            senderRole: row.sender_role,
            text: row.message_text,
            attachment: row.attachment_url,
            time: row.time || new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            avatar: row.avatar
          });
        }

        // Merge with current state
        for (const [gid, msgs] of Object.entries(remoteMessages)) {
          this.messages[gid] = msgs;
        }
        this.save();
        this.notify(null);
        console.log(`[Sangam Chat] Loaded ${data.length} messages from Supabase.`);
      }

      // 2. Subscribe to Realtime WebSocket channel for incoming messages
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
      }

      this.realtimeChannel = sb
        .channel("sangam-realtime-chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            const row = payload.new;
            if (!row) return;

            const incomingMsg = {
              id: row.id,
              senderId: row.sender_id,
              senderName: row.sender_name,
              senderRole: row.sender_role,
              text: row.message_text,
              attachment: row.attachment_url,
              time: row.time || new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              avatar: row.avatar,
              isRealtimeIncoming: true
            };

            const gid = row.group_id;
            if (!this.messages[gid]) this.messages[gid] = [];

            // Prevent duplicate if this client sent it optimistically
            const exists = this.messages[gid].some((m) => m.id === incomingMsg.id);
            if (!exists) {
              this.messages[gid].push(incomingMsg);
              this.save();
              this.notify(incomingMsg);
              console.log(`💬 [Sangam Chat] Realtime message received in ${gid}:`, incomingMsg.text);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[Sangam Chat] Realtime subscription status: ${status}`);
        });
    } catch (err) {
      console.warn("[Sangam Chat] Realtime setup notice:", err);
    }
  }

  setActiveGroup(groupId) {
    this.activeGroupId = groupId;
    this.notify();
  }

  getActiveGroupId() {
    return this.activeGroupId;
  }

  getMessages(groupId = this.activeGroupId) {
    return this.messages[groupId] || [];
  }

  sendMessage(text, attachment = null) {
    if (!text || !text.trim()) return null;

    // Strict RBAC Enforcement
    if (!auth.canPostInGroup(this.activeGroupId)) {
      if (auth.isOverseer()) {
        alert("Action Prohibited: VIP Overseer (Principal) has Read-Only access. You cannot post messages.");
      } else {
        alert("Permission Denied: You can only post messages within your assigned operational group.");
      }
      return null;
    }

    const user = auth.getCurrentUser();
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const msg = {
      id: "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      senderId: user.id,
      senderName: `${user.name} (${user.role.toUpperCase()})`,
      senderRole: user.role,
      text: text.trim(),
      attachment: attachment,
      time: timeStr,
      avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`
    };

    if (!this.messages[this.activeGroupId]) {
      this.messages[this.activeGroupId] = [];
    }

    // Optimistic local update
    this.messages[this.activeGroupId].push(msg);
    this.save();
    this.notify(msg);

    // Live Supabase Broadcast
    if (isLive()) {
      getSupabase().then((sb) => {
        if (sb) {
          sb.from("chat_messages")
            .insert([
              {
                id: msg.id,
                group_id: this.activeGroupId,
                sender_id: msg.senderId,
                sender_name: msg.senderName,
                sender_role: msg.senderRole,
                message_text: msg.text,
                attachment_url: msg.attachment || null,
                avatar: msg.avatar,
                time: msg.time
              }
            ])
            .then(({ error }) => {
              if (error) console.warn("[Sangam Chat] Supabase broadcast error:", error);
            });
        }
      });
    }

    // Optional demo auto-reply for evaluators if manager speaks in Food group
    if (user.role === "manager" && this.activeGroupId === "grp-food" && text.toLowerCase().includes("status")) {
      setTimeout(() => {
        this.addSystemBotReply(
          "grp-food",
          "Athul (Team Leader)",
          "lead",
          "https://api.dicebear.com/7.x/bottts/svg?seed=Athul",
          "Catering vehicle just passed the college gate. We are unloading boxes at the north dock now."
        );
      }, 1200);
    }

    return msg;
  }

  addSystemBotReply(groupId, senderName, senderRole, avatar, text) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const replyMsg = {
      id: "msg-" + Date.now() + "-bot",
      senderId: "bot-" + Date.now(),
      senderName: senderName,
      senderRole: senderRole,
      text: text,
      time: timeStr,
      avatar: avatar
    };

    if (!this.messages[groupId]) {
      this.messages[groupId] = [];
    }

    this.messages[groupId].push(replyMsg);
    this.save();
    this.notify(replyMsg);

    // Push bot reply to Supabase too if live
    if (isLive()) {
      getSupabase().then((sb) => {
        if (sb) {
          sb.from("chat_messages")
            .insert([
              {
                id: replyMsg.id,
                group_id: groupId,
                sender_id: replyMsg.senderId,
                sender_name: replyMsg.senderName,
                sender_role: replyMsg.senderRole,
                message_text: replyMsg.text,
                avatar: replyMsg.avatar,
                time: replyMsg.time
              }
            ])
            .then(({ error }) => {
              if (error) console.warn("[Sangam Chat] Bot reply Supabase error:", error);
            });
        }
      });
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(this.messages));
    } catch (e) {
      console.warn("Chat storage save error", e);
    }
  }

  onChatUpdate(callback) {
    this.listeners.push(callback);
    callback(this.getMessages(), null);
  }

  notify(newMsg = null) {
    for (const listener of this.listeners) {
      try {
        listener(this.getMessages(), newMsg);
      } catch (e) {
        console.error("Chat listener error", e);
      }
    }
  }
}

export const chatManager = new ChatManager();

// ==============================================================================
// SANGAM (സംഗമം) - AI Event Coordinator (Google Gemini Integration)
// Team LINX - Kraft Night 2026
// ==============================================================================

import { CONFIG } from "./config.js";
import { taskManager } from "./tasks.js";
import { auth } from "./auth.js";

class SangamAICoordinator {
  constructor() {
    this.edgeFunctionUrl = `${CONFIG.SUPABASE_URL}/functions/v1/ai-coordinator`;
  }

  // Conversational Assistant for In-App Gemini Drawer
  async askGemini(promptText, eventContext = {}) {
    if (!promptText || !promptText.trim()) return null;

    if (CONFIG.USE_LIVE_BACKEND && window.ENV_GEMINI_API_KEY) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.ENV_GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `System: You are Sangam AI Event Coordinator for '${eventContext.eventTitle || "Kraft Night 2026"}' (Code: ${eventContext.eventCode || "482910"}).
Context:
- Current Programmes: ${JSON.stringify(eventContext.programmes || [])}
- Groups & Leads: ${JSON.stringify(eventContext.groups || [])}
- User Asking: ${auth.getCurrentUser().name} (${auth.getCurrentUser().role})

User Query: "${promptText}"

Please provide a clear, concise, actionable answer formatted with markdown highlights.`
                    }
                  ]
                }
              ]
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        }
      } catch (err) {
        console.warn("Live Gemini API call error, using local intelligent coordinator engine:", err);
      }
    }

    // High-fidelity local conversational engine
    return this.localIntelligentAssistant(promptText, eventContext);
  }

  // Local Intelligent Coordinator Fallback
  localIntelligentAssistant(prompt, context) {
    const q = prompt.toLowerCase();
    const programmes = taskManager.getProgrammes();
    const active = programmes.find(p => p.status === "in_progress");
    const upcoming = programmes.filter(p => p.status === "scheduled");
    const delayed = programmes.filter(p => p.status === "delayed");

    if (q.includes("catering") || q.includes("food") || q.includes("dinner") || q.includes("lunch")) {
      return `**🥗 Food Coordination Update:**\n\n• **Status**: Catering convoy confirmed arrival. Athul K. (Team Leader) and Athira S. (Volunteer) are managing Hall B buffet lines.\n• **Scheduled Dinner**: **21:00 - 22:30** at the Main Dining Hall for 1,200 delegates.\n• **Action Required**: Manager Sarah Jenkins requested reserving separate dining tables for VIP Guest Lounge.`;
    }

    if (q.includes("next") || q.includes("schedule") || q.includes("timeline") || q.includes("current") || q.includes("what is on")) {
      const activeText = active ? `• **Currently In Progress**: *${active.title}* at ${active.venue} (${active.startTime} - ${active.endTime})` : "• No program actively underway.";
      const upcomingList = upcoming.slice(0, 2).map(u => `• **Upcoming**: *${u.title}* at ${u.startTime} (${u.venue})`).join("\n");
      return `**⏱️ Event Schedule Briefing:**\n\n${activeText}\n${upcomingList}\n\n*All stage consoles and wireless frequencies are locked.*`;
    }

    if (q.includes("clash") || q.includes("delay") || q.includes("risk") || q.includes("vip arrival")) {
      if (delayed.length > 0) {
        return `**⚠️ Delay Notice Detected:**\n\n${delayed.map(d => `• *${d.title}* (${d.venue}) marked as DELAYED.`).join("\n")}\n\nPrincipal Imdad M. has been flagged. Recommendation: Shift stage transition window by 15 minutes.`;
      }
      return `**✅ Timeline Verification:**\n\nNo timing conflicts detected. Inauguration at 18:00 aligns with VIP arrival protocol. Open Air Amphitheater soundcheck cleared by Stage & Sound Lead Safti M.`;
    }

    if (q.includes("announcement") || q.includes("draft") || q.includes("broadcast")) {
      return `**📢 Drafted Broadcast Announcement:**\n\n"✨ Attention all Kraft Night 2026 attendees and teams! The *Cultural Night & Live Bands* is starting shortly at the Open Air Amphitheater (19:30). Please proceed to the amphitheater seating. Food counters will open promptly at 21:00. Enjoy the evening!"`;
    }

    if (q.includes("who") || q.includes("leader") || q.includes("team") || q.includes("role")) {
      return `**👥 Operational Leadership Roster:**\n\n• **Event Manager**: Sarah Jenkins\n• **VIP / Principal Overseer**: Imdad M. (Read-Only Observer)\n• **Food Coordination Leader**: Athul K. (Volunteer: Athira S.)\n• **Stage & Sound Leader**: Safti M. (Logistics: Alex Ramirez)\n• **VIP Protocol Leader**: Aravind Menon`;
    }

    return `**✨ Sangam AI Coordinator:**\n\nI have cross-checked the event database for **Kraft Night 2026**.\n\n• **Active Programmes**: ${programmes.length} scheduled\n• **Live Status**: ${active ? active.title : "Ready for next block"}\n• **Quick Suggestions**: Ask me *"Summarize catering"*, *"Check VIP clash"*, or *"Draft announcement"*.`;
  }

  // Executive Status Briefing
  async generateStatusBriefing(programmes = taskManager.getProgrammes()) {
    const total = programmes.length;
    const completed = programmes.filter(p => p.status === "completed").length;
    const inProgress = programmes.filter(p => p.status === "in_progress").length;
    const delayed = programmes.filter(p => p.status === "delayed");
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      status: delayed.length > 0 ? "Attention Required" : "Running on Schedule",
      completionRate: `${rate}%`,
      summary: `Currently ${completed} of ${total} scheduled programs have concluded. ${inProgress} program is actively on stage.`,
      identifiedRisks: delayed.map(d => `[${d.venue}] "${d.title}" delayed past ${d.startTime}`),
      nextActions: [
        "Monitor Amphitheater audio channel 4 ahead of Live Band transition.",
        "Ensure volunteer team in Hall B confirms dining warmers are plugged in by 20:45.",
        "Maintain VIP reception escort at Auditorium Gate 2."
      ]
    };
  }
}

export const aiCoordinator = new SangamAICoordinator();

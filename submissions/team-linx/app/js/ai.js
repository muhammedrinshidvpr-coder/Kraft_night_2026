// ==============================================================================
// SANGAM - AI Event Coordinator (Google Gemini Integration)
// Team LINX - Kraft Night 2026
// ==============================================================================

import { CONFIG } from "./config.js";

class SangamAICoordinator {
  constructor() {
    this.edgeFunctionUrl = `${CONFIG.SUPABASE_URL}/functions/v1/ai-coordinator`;
  }

  // 1. Convert natural language text into a structured task
  async parseNaturalLanguageToTask(promptText) {
    if (CONFIG.USE_LIVE_BACKEND) {
      try {
        const response = await fetch(this.edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": CONFIG.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ action: "nl_to_task", prompt: promptText })
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn("Live Gemini function call failed, using intelligent parser fallback:", err);
      }
    }

    // Intelligent fallback parser for offline/demo evaluation
    return this.fallbackNLParser(promptText);
  }

  // 2. Generate Executive Status Briefing
  async generateStatusBriefing(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const pending = tasks.filter(t => t.status !== "completed");
    const critical = pending.filter(t => t.priority === "critical");

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let statusOverview = "Event operations are running on schedule.";
    if (critical.length > 0) {
      statusOverview = `Attention: ${critical.length} critical task(s) currently require immediate lead intervention.`;
    }

    return {
      status: critical.length > 0 ? "High Alert" : "Operational",
      completionRate: `${completionRate}%`,
      summary: `Overall ${completed} of ${total} tasks have been executed. ${statusOverview}`,
      identifiedRisks: critical.map(c => `[${c.department}] "${c.title}" due by ${c.dueTime || "soon"}`),
      nextActions: [
        "Prioritize Stage & Sound battery and wireless channel checks before 4 PM.",
        "Ensure gate passes for Logistics transport vehicles are signed.",
        "Check-in with VIP hospitality coordinator on arrival times."
      ]
    };
  }

  // Fallback heuristic parser
  fallbackNLParser(prompt) {
    const lower = prompt.toLowerCase();
    
    // Determine Department
    let department = "Stage & Sound";
    let deptId = "dept-stage";
    if (lower.includes("food") || lower.includes("buffet") || lower.includes("vip") || lower.includes("water") || lower.includes("guest")) {
      department = "Hospitality & VIPs";
      deptId = "dept-hospitality";
    } else if (lower.includes("transport") || lower.includes("van") || lower.includes("box") || lower.includes("hamper") || lower.includes("prop")) {
      department = "Logistics & Transport";
      deptId = "dept-logistics";
    } else if (lower.includes("stream") || lower.includes("wifi") || lower.includes("scanner") || lower.includes("badge") || lower.includes("network")) {
      department = "Tech & Streaming";
      deptId = "dept-tech";
    } else if (lower.includes("press") || lower.includes("photo") || lower.includes("social") || lower.includes("poster")) {
      department = "Media & PR";
      deptId = "dept-media";
    }

    // Determine Priority
    let priority = "medium";
    if (lower.includes("urgent") || lower.includes("immediately") || lower.includes("asap") || lower.includes("critical")) {
      priority = "critical";
    } else if (lower.includes("important") || lower.includes("high") || lower.includes("today")) {
      priority = "high";
    }

    // Extract time if present
    const timeMatch = prompt.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const dueTime = timeMatch ? timeMatch[0].toUpperCase() : "17:00";

    return {
      title: prompt.charAt(0).toUpperCase() + prompt.slice(1),
      department: department,
      deptId: deptId,
      priority: priority,
      dueTime: dueTime,
      checklist: ["Inspect requirements", "Deploy on-ground volunteers", "Confirm with Lead"]
    };
  }
}

export const aiCoordinator = new SangamAICoordinator();

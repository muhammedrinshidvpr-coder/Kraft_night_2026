// ==============================================================================
// SANGAM - Main Application Controller
// Team LINX - Kraft Night 2026
// ==============================================================================

import { auth } from "./auth.js";
import { taskManager } from "./tasks.js";
import { chatManager } from "./chat.js";
import { aiCoordinator } from "./ai.js";
import { emailService } from "./email.js";
import { DEPARTMENTS } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  let currentDepartmentFilter = "all";

  // Elements
  const deptListEl = document.getElementById("dept-list");
  const statsTotal = document.getElementById("stat-total");
  const statsInProgress = document.getElementById("stat-in-progress");
  const statsCritical = document.getElementById("stat-critical");
  const statsRate = document.getElementById("stat-rate");
  const aiPromptInput = document.getElementById("ai-prompt-input");
  const aiPromptBtn = document.getElementById("ai-prompt-btn");
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const activeDeptTitle = document.getElementById("active-dept-title");

  // Modals
  const inviteModal = document.getElementById("invite-modal");
  const inviteBtn = document.getElementById("btn-invite-member");
  const inviteClose = document.getElementById("invite-close");
  const inviteForm = document.getElementById("invite-form");

  const briefingModal = document.getElementById("briefing-modal");
  const briefingBtn = document.getElementById("btn-ai-briefing");
  const briefingClose = document.getElementById("briefing-close");
  const briefingContent = document.getElementById("briefing-content");

  // 1. Render Department List
  function renderDepartments() {
    deptListEl.innerHTML = "";
    
    // "All Departments" option
    const allLi = document.createElement("li");
    allLi.className = `dept-item ${currentDepartmentFilter === 'all' ? 'active' : ''}`;
    allLi.innerHTML = `<span>🌐 All Departments</span>`;
    allLi.onclick = () => {
      currentDepartmentFilter = "all";
      renderDepartments();
      renderTasks();
      activeDeptTitle.textContent = "Global Event Board";
    };
    deptListEl.appendChild(allLi);

    DEPARTMENTS.forEach(dept => {
      const li = document.createElement("li");
      li.className = `dept-item ${currentDepartmentFilter === dept.id ? 'active' : ''}`;
      li.innerHTML = `
        <span>${dept.icon} ${dept.name}</span>
        <span class="badge-count">${dept.count}</span>
      `;
      li.onclick = () => {
        currentDepartmentFilter = dept.id;
        chatManager.setActiveDepartment(dept.id);
        renderDepartments();
        renderTasks();
        renderChat();
        activeDeptTitle.textContent = dept.name;
      };
      deptListEl.appendChild(li);
    });
  }

  // 2. Render Kanban Tasks
  function renderTasks() {
    const tasks = taskManager.getTasks(currentDepartmentFilter);
    const cols = {
      todo: document.getElementById("col-todo"),
      in_progress: document.getElementById("col-in_progress"),
      review: document.getElementById("col-review"),
      completed: document.getElementById("col-completed")
    };

    Object.values(cols).forEach(col => col.innerHTML = "");

    tasks.forEach(task => {
      const card = document.createElement("div");
      card.className = "task-card";
      card.innerHTML = `
        <span class="priority-tag priority-${task.priority}">${task.priority}</span>
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span>${task.department}</span>
          <span>🕒 ${task.dueTime || "18:00"}</span>
        </div>
      `;

      // Quick move on click for demo convenience
      card.onclick = () => {
        const nextStatusMap = {
          todo: "in_progress",
          in_progress: "review",
          review: "completed",
          completed: "todo"
        };
        taskManager.updateTaskStatus(task.id, nextStatusMap[task.status]);
      };

      if (cols[task.status]) {
        cols[task.status].appendChild(card);
      }
    });

    // Update Stats
    const stats = taskManager.getStats();
    statsTotal.textContent = stats.total;
    statsInProgress.textContent = stats.inProgress;
    statsCritical.textContent = stats.critical;
    statsRate.textContent = `${stats.completionRate}%`;
  }

  // 3. Render Live Chat
  function renderChat() {
    const msgs = chatManager.getMessages();
    chatMessagesEl.innerHTML = "";
    msgs.forEach(msg => {
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble";
      bubble.innerHTML = `
        <div class="chat-header">
          <span class="chat-sender">${msg.sender} (${msg.role.toUpperCase()})</span>
          <span class="chat-time">${msg.time}</span>
        </div>
        <div class="chat-body">${msg.text}</div>
      `;
      chatMessagesEl.appendChild(bubble);
    });
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  // Chat Send Handler
  function handleSendMessage() {
    const text = chatInput.value.trim();
    if (text) {
      chatManager.sendMessage(text);
      chatInput.value = "";
      renderChat();
    }
  }

  chatSendBtn.onclick = handleSendMessage;
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSendMessage();
  });

  // 4. AI Prompt-to-Task Handler
  async function handleAIPrompt() {
    const promptText = aiPromptInput.value.trim();
    if (!promptText) return;

    aiPromptBtn.textContent = "⏳ Parsing...";
    aiPromptBtn.disabled = true;

    try {
      const structuredTask = await aiCoordinator.parseNaturalLanguageToTask(promptText);
      taskManager.addTask(structuredTask);
      aiPromptInput.value = "";
      alert(`✨ Sangam AI Created Task:\n"${structuredTask.title}" assigned to ${structuredTask.department} [${structuredTask.priority.toUpperCase()}]`);
    } catch (err) {
      console.error(err);
    } finally {
      aiPromptBtn.textContent = "✨ Convert to Task";
      aiPromptBtn.disabled = false;
    }
  }

  aiPromptBtn.onclick = handleAIPrompt;
  aiPromptInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAIPrompt();
  });

  // 5. Role Switcher Handlers
  document.querySelectorAll(".role-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const roleKey = btn.getAttribute("data-role");
      auth.setRole(roleKey);
    };
  });

  auth.onUserChange((user) => {
    document.getElementById("user-name-display").textContent = user.name;
    document.getElementById("user-role-badge").textContent = user.role.toUpperCase();
    document.getElementById("user-avatar").src = user.avatar;
  });

  // 6. SendGrid Invitation Modal
  inviteBtn.onclick = () => inviteModal.classList.add("active");
  inviteClose.onclick = () => inviteModal.classList.remove("active");
  inviteForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("invite-email").value;
    const name = document.getElementById("invite-name").value;
    const role = document.getElementById("invite-role").value;
    const dept = document.getElementById("invite-dept").value;

    const res = await emailService.sendInvitation({ email, name, role, department: dept });
    alert(res.message);
    inviteModal.classList.remove("active");
    inviteForm.reset();
  };

  // 7. Executive Status Briefing Modal
  briefingBtn.onclick = async () => {
    briefingContent.innerHTML = "<p>Analyzing live tasks and bottlenecks with Google Gemini...</p>";
    briefingModal.classList.add("active");
    const briefing = await aiCoordinator.generateStatusBriefing(taskManager.getTasks("all"));

    briefingContent.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 4px 10px; border-radius: 999px; font-weight: bold; font-size: 12px;">Status: ${briefing.status}</span>
        <span style="margin-left: 8px; font-size: 13px; color: #94a3b8;">Completion: ${briefing.completionRate}</span>
      </div>
      <p style="font-size: 14px; line-height: 1.5; margin-bottom: 16px;">${briefing.summary}</p>
      <h4 style="font-size: 13px; color: #f43f5e; margin-bottom: 8px;">⚠️ Identified Bottlenecks & Delay Risks:</h4>
      <ul style="padding-left: 20px; font-size: 13px; margin-bottom: 16px; color: #fda4af;">
        ${briefing.identifiedRisks.length > 0 ? briefing.identifiedRisks.map(r => `<li>${r}</li>`).join("") : "<li>No critical delays detected. All streams active.</li>"}
      </ul>
      <h4 style="font-size: 13px; color: #10b981; margin-bottom: 8px;">✅ Immediate 2-Hour Action Plan:</h4>
      <ul style="padding-left: 20px; font-size: 13px; color: #a7f3d0;">
        ${briefing.nextActions.map(a => `<li>${a}</li>`).join("")}
      </ul>
    `;
  };
  briefingClose.onclick = () => briefingModal.classList.remove("active");

  // Initial Sync
  taskManager.onTasksChange(() => renderTasks());
  renderDepartments();
  renderChat();
});

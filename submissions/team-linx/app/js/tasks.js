// ==============================================================================
// SANGAM - Real-Time Kanban Task Board
// Team LINX - Kraft Night 2026
// ==============================================================================

import { INITIAL_TASKS } from "./config.js";
import { auth } from "./auth.js";

class TaskManager {
  constructor() {
    this.tasks = JSON.parse(localStorage.getItem("sangam_tasks")) || [...INITIAL_TASKS];
    this.listeners = [];
  }

  getTasks(departmentFilter = "all") {
    if (departmentFilter === "all") {
      return this.tasks;
    }
    return this.tasks.filter(t => t.deptId === departmentFilter || t.department === departmentFilter);
  }

  addTask(task) {
    const newTask = {
      id: "task-" + Date.now(),
      status: "todo",
      priority: task.priority || "medium",
      title: task.title,
      department: task.department || "Stage & Sound",
      deptId: task.deptId || "dept-stage",
      dueTime: task.dueTime || "18:00",
      assignedTo: task.assignedTo || auth.getCurrentUser().name,
      assignedRole: task.assignedRole || auth.getCurrentUser().role,
      checklist: task.checklist || []
    };
    this.tasks.unshift(newTask);
    this.saveAndNotify("Task Created: " + newTask.title);
    return newTask;
  }

  updateTaskStatus(taskId, newStatus) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = newStatus;
      this.saveAndNotify(`Task moved to ${newStatus.replace('_', ' ').toUpperCase()}`);
    }
  }

  deleteTask(taskId) {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.saveAndNotify("Task removed");
  }

  getStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status === "completed").length;
    const inProgress = this.tasks.filter(t => t.status === "in_progress").length;
    const critical = this.tasks.filter(t => t.priority === "critical" && t.status !== "completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, critical, completionRate };
  }

  saveAndNotify(actionDescription = "") {
    localStorage.setItem("sangam_tasks", JSON.stringify(this.tasks));
    for (const listener of this.listeners) {
      listener(this.tasks, actionDescription);
    }
  }

  onTasksChange(callback) {
    this.listeners.push(callback);
    callback(this.tasks, "initial");
  }
}

export const taskManager = new TaskManager();

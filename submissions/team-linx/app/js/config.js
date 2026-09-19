// ==============================================================================
// SANGAM - Configuration & State Defaults
// Team LINX - Kraft Night 2026
// ==============================================================================

export const CONFIG = {
  SUPABASE_URL: window.ENV_SUPABASE_URL || "https://xyzcompany.supabase.co",
  SUPABASE_ANON_KEY: window.ENV_SUPABASE_ANON_KEY || "public-anon-key-placeholder",
  USE_LIVE_BACKEND: false, // Set to true when connected to an active Supabase project; otherwise uses local mock state
};

// Preset Demo Users for Hackathon Evaluators
export const PRESET_USERS = {
  admin: {
    id: "user-admin-101",
    name: "Aravind Menon (Organizer)",
    role: "admin",
    roleLabel: "Organizer / Administrator",
    department: "All Departments",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Aravind"
  },
  lead: {
    id: "user-lead-202",
    name: "Sneha Nair (Stage Lead)",
    role: "lead",
    roleLabel: "Department Team Lead",
    department: "Stage & Sound",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sneha"
  },
  volunteer: {
    id: "user-vol-303",
    name: "Rahul Krishna (Volunteer)",
    role: "volunteer",
    roleLabel: "On-Ground Volunteer",
    department: "Logistics",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Rahul"
  }
};

// Default Departments
export const DEPARTMENTS = [
  { id: "dept-stage", name: "Stage & Sound", icon: "🎤", lead: "Sneha Nair", count: 8 },
  { id: "dept-logistics", name: "Logistics & Transport", icon: "📦", lead: "Anand K", count: 12 },
  { id: "dept-hospitality", name: "Hospitality & VIPs", icon: "☕", lead: "Meera V", count: 6 },
  { id: "dept-tech", name: "Tech & Streaming", icon: "💻", lead: "Rohan J", count: 5 },
  { id: "dept-media", name: "Media & PR", icon: "📸", lead: "Fathima S", count: 7 }
];

// Initial Mock Tasks for Wireframe & Live Demo
export const INITIAL_TASKS = [
  {
    id: "task-1",
    title: "Setup 4 cordless microphones and podium audio check",
    department: "Stage & Sound",
    deptId: "dept-stage",
    priority: "critical",
    status: "in_progress",
    dueTime: "16:00",
    assignedTo: "Rahul Krishna",
    assignedRole: "volunteer",
    checklist: ["Test wireless frequencies", "Replace AA batteries", "Soundcheck with lead singer"]
  },
  {
    id: "task-2",
    title: "Inspect stage backdrop LED wall cabling",
    department: "Stage & Sound",
    deptId: "dept-stage",
    priority: "high",
    status: "todo",
    dueTime: "16:30",
    assignedTo: "Sneha Nair",
    assignedRole: "lead",
    checklist: ["HDMI matrix switch test", "Power backup line verification"]
  },
  {
    id: "task-3",
    title: "Transport 50 VIP gift hampers from warehouse to greenroom",
    department: "Logistics & Transport",
    deptId: "dept-logistics",
    priority: "medium",
    status: "todo",
    dueTime: "17:15",
    assignedTo: "Anand K",
    assignedRole: "volunteer",
    checklist: ["Count inventory", "Verify room pass"]
  },
  {
    id: "task-4",
    title: "Setup registration kiosk barcode scanners and badging tablets",
    department: "Tech & Streaming",
    deptId: "dept-tech",
    priority: "high",
    status: "review",
    dueTime: "15:45",
    assignedTo: "Rohan J",
    assignedRole: "lead",
    checklist: ["Test network latency", "Print test badge"]
  },
  {
    id: "task-5",
    title: "Coordinate dinner buffet layout with catering vendors",
    department: "Hospitality & VIPs",
    deptId: "dept-hospitality",
    priority: "low",
    status: "completed",
    dueTime: "14:30",
    assignedTo: "Meera V",
    assignedRole: "lead",
    checklist: ["Drinking water dispensers setup", "Food safety certificate inspected"]
  }
];

// Initial Department Chat Messages
export const INITIAL_CHATS = {
  "dept-stage": [
    { id: "c-1", sender: "Sneha Nair", role: "lead", text: "Team, mic soundcheck starts promptly at 4:15 PM. Ensure all backup batteries are installed.", time: "15:10" },
    { id: "c-2", sender: "Rahul Krishna", role: "volunteer", text: "Batteries replaced in Mics 1 to 4. Standing by at the soundboard.", time: "15:18" }
  ],
  "dept-logistics": [
    { id: "c-3", sender: "Anand K", role: "lead", text: "Van carrying the stage props has entered gate 2. Volunteers please assist unloading.", time: "15:05" }
  ],
  "dept-hospitality": [
    { id: "c-4", sender: "Meera V", role: "lead", text: "Chief guest flight has landed. Escort vehicle dispatched.", time: "14:50" }
  ],
  "dept-tech": [
    { id: "c-5", sender: "Rohan J", role: "lead", text: "YouTube live streaming stream key tested and verified at 1080p60.", time: "15:20" }
  ],
  "dept-media": [
    { id: "c-6", sender: "Fathima S", role: "lead", text: "Press release sent to major media handles.", time: "14:40" }
  ]
};

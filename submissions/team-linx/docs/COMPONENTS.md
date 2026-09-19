# Component Catalog & UI Specifications (COMPONENTS.md)
## Project Name: Sangam (സംഗമം) — Event Command & Coordination Platform
**Team:** LINX (Kraft Night 2026 Hackathon)  
**Status:** Approved for Implementation  
**Author:** Team LINX  

---

## 1. Design System Tokens & Foundations

The UI follows a clean, light workspace design system using CSS custom properties (no CSS frameworks):

```css
:root {
  /* Color Palette */
  --bg-base: #0a0e1a;
  --bg-surface: rgba(15, 23, 42, 0.75);
  --bg-card: rgba(30, 41, 59, 0.65);
  --bg-elevated: rgba(51, 65, 85, 0.5);

  /* Borders & Glassmorphism */
  --border-subtle: rgba(148, 163, 184, 0.12);
  --border-focus: rgba(99, 102, 241, 0.5);
  --backdrop-blur: blur(16px);

  /* Accents */
  --accent-cyan: #06b6d4;
  --accent-indigo: #6366f1;
  --accent-emerald: #10b981;
  --accent-amber: #f59e0b;
  --accent-rose: #f43f5e;

  /* Typography & Radii */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}
```

---

## 2. Component Specifications

### 2.1. Top Navigation Bar (`<header class="navbar">`)
- **Purpose**: Global branding, active event context indicator, live role switcher, and quick-action triggers.
- **Child Elements**:
  - `BrandSection`: Event acronym logo (`സ`), Title (`SANGAM`), and Subtitle (`Kraft Night 2026`).
  - `EventCodeBadge`: Displays active 6-digit code (`PIN: 482910`) with one-click copy button.
  - `RoleSwitcher`: Evaluator toolbar with buttons for **Manager**, **VIP / Overseer**, **Team Leader**, and **Volunteer**.
  - `UserProfilePill`: Shows avatar image, full name, and current role tag.

---

### 2.2. Landing Hero Section (`<section class="landing-hero">`)
- **Visual Reference**: [`docs/images/01_landing_login_page.jpg`](images/01_landing_login_page.jpg)
- **Purpose**: Welcomes unauthenticated or first-time users with a high-impact presentation of the platform.
- **Key Features**:
  - Animated glowing background with purple/cyan gradients.
  - Value proposition: *"Unified Event Command & Coordination — Schedule programs, orchestrate teams, and real-time group collaboration"*.
  - Primary CTA button: `[Get Started]` which routes directly to the Event Gateway.
  - Top right buttons: `[Login]` and `[Sign In]` modals.

---

### 2.3. Event Gateway Hub (`<section class="event-gateway">`)
- **Visual Reference**: [`docs/images/02_create_find_event.jpg`](images/02_create_find_event.jpg)
- **Purpose**: Two-card portal for either creating a new event or joining an existing one.
- **Cards**:
  1. **Create an Event**:
     - Input field: `Event Title` (placeholder: e.g., "Kraft Night 2026").
     - Button: `[Create Event & Become Manager]`.
     - Action: Generates 6-digit code, sets user role to `manager`, and enters Command Center.
  2. **Find an Event**:
     - Six distinct PIN input cells with auto-advance on keypress.
     - Button: `[Join Event]`.
     - Action: Validates code, registers user as a joined member in the lobby, and loads attendee view.

---

### 2.4. Workspace Sidebar Navigation (`<aside class="sidebar">`)
- **Visual Reference**: [`docs/images/03_manager_dashboard.jpg`](images/03_manager_dashboard.jpg)
- **Menu Items** (one active workspace page at a time):
  - `Dashboard`: Timeline, assigned roles for the selected programme, event snapshot.
  - `Assign Roles`: Inline member form plus roster cards with manager-only remove.
  - `Create Program`: Inline programme form plus full schedule list with manager status controls.
  - `Groups`: Group directory plus per-group chat stream and inline team creation.
  - `About Event`: Event summary, operational groups, organizers and leads.
- **Session Panel**: Sidebar footer profile button opens role switcher, event PIN copy, and gateway return.
- **AI Briefing**: Persistent right rail on desktop; drawer opened from the header on tablet/mobile.

---

### 2.5. Programmes Timeline Component (`<div class="programmes-timeline">`)
- **Purpose**: Displays the chronological schedule of event activities with real-time status indicators.
- **Card Elements (`.programme-card`)**:
  - Time badge (e.g., `18:00 - 19:15`).
  - Program Title (e.g., `Inauguration & Lighting Ceremony`).
  - Venue / Stage (e.g., `Main Auditorium`).
  - Status Pill:
    - 🟢 `Scheduled` (Normal)
    - 🟡 `In Progress` (Live)
    - 🔴 `Delayed` (Alert triggered)
    - ⚪ `Completed`
  - Action Controls: Manager can click to cycle status or edit schedule. Read-only for Overseer, Leader, and Volunteers.

---

### 2.6. Joined People Roster (`<div class="joined-people-roster">`)
- **Purpose**: Displays all attendees who joined the event using the 6-digit PIN.
- **Roster Items**:
  - Member Avatar & Full Name (e.g., *Athul K.*, *Athira S.*, *Imdad M.*).
  - Current Role Badge (`VIP / Overseer`, `Team Leader`, `Volunteer`, or `Awaiting Assignment`).
  - Assigned Department Tag (e.g., `Food Coordination`, `Stage & Sound`, `Unassigned`).
  - Action Button: `[Assign Role & Group]` (visible exclusively to Manager).
- **Assign Role Modal**:
  - Dropdown 1: Role (`VIP / Overseer`, `Team Leader`, `Volunteer`).
  - Dropdown 2: Operational Group (`Food`, `Stage & Sound`, etc.).

---

### 2.7. In-App Team Chat Hub (`<section class="chat-hub">`)
- **Visual Reference**: [`docs/images/04_team_chat_gemini.jpg`](images/04_team_chat_gemini.jpg)
- **Panels**:
  1. **Group Channels Directory (Left Column)**:
     - Channel item displays group icon, name, active member count, and unread badges.
     - Role Filtering: Volunteers only see their assigned group; Managers, Overseers, and Leaders see all groups.
  2. **Active Group Chat Stream (Center Column)**:
     - Header: Group name, total members, and leader name.
     - Message List: Scrolling stream of messages with avatars, names, role tags, timestamps, and message text.
     - Input Bar:
       - Active for Manager and assigned members.
       - Disabled with a notice `[Read-Only Observer Mode]` for Overseer / Principal.
       - Disabled for Team Leaders and Volunteers when viewing unassigned groups.

---

### 2.8. Gemini AI Assistant Drawer (`<div class="gemini-drawer">`)
- **Purpose**: Event-aware assistant for briefings, conflict checks, and natural-language queries.
- **Features**:
  - Sparkle branding header (`✨ Sangam AI Event Assistant`).
  - Quick Suggestion Chips:
    - *"Summarize recent catering updates"*
    - *"Check timeline clashes for VIP arrival"*
    - *"Draft announcement for program delay"*
  - Real-time conversation thread with formatted markdown cards.
  - Direct natural-language input bar.

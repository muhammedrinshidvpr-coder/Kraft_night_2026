# Product Requirements Document (PRD)
## Project Name: Sangam (സംഗമം) — Event Command & Coordination Platform
**Team:** LINX (Kraft Night 2026 Hackathon)  
**Status:** Draft / Approved for Design  
**Author:** Team LINX  

---

## 1. Problem Statement & Background

College and enterprise event operations currently suffer from severe communication fragmentation:
- **Chaotic WhatsApp Groups**: Hundreds of messages where critical updates (e.g., stage delays, food delivery times, VIP arrivals) get buried.
- **Disconnected Spreadsheets**: Static run-of-show schedules that become obsolete the moment a delay occurs.
- **Unclear Role Boundaries**: Volunteers don't know who is authorized to make decisions, and executive overseers (e.g., Principal, Faculty) have no clean way to observe without interrupting operations.
- **Slow Onboarding**: Adding committee members across multiple disjointed tools takes hours.

### The Solution: Sangam (സംഗമം)
A unified, real-time command center where an organizer creates an event in seconds, volunteers join with a **6-Digit PIN**, members are organized into specialized working groups (Food, Stage, Hospitality), real-time in-app chats operate under strict role rules, schedules update live, and an **Embedded Gemini AI Assistant** provides instant briefings and answers.

---

## 2. Target Personas & Role Matrix

| Persona / Role | Real-World Example | Key Responsibilities | Access Level |
| :--- | :--- | :--- | :--- |
| **VIP / Overseer** | College Principal, Chief Patron | Wants a birds-eye view of event execution, crowd safety, and schedule status without administrative duties. | **Read-Only Observer**: Can view all program schedules, attendee rosters, and read all group chats. Cannot alter data or post messages (*"can see all things, cannot alterate"*). |
| **Event Manager** | Student Convener, General Secretary | Sovereign administrator. Creates the event, creates and schedules programs, creates operational groups, assigns roles & leaders, and broadcasts announcements. | **Full Admin Access**: Can create/edit/delete programs, assign roles, create groups, and read & post across **all** group chats. |
| **Team Leader / Organiser** | Food Head, Stage Coordinator | Leads a specific operational committee. Manages ground volunteers and coordinates with other leaders. | **Departmental Lead**: Has cross-department read access across all group chats for situational awareness, but can **only post messages** in their assigned group. |
| **Worker / Volunteer** | Student Volunteer, Ground Crew | Executes specific operational tasks (e.g., moving mics, distributing food boxes). | **Focused Member**: Can only view and post in their assigned group chat. Restricted from modifying schedules or global settings. |

---

## 3. User Journeys & Functional Requirements

### 3.1. User Journey 1: Landing & Authentication
- **Requirement 1.1**: The user lands on a modern, light-themed home screen with the event branding.
- **Requirement 1.2**: Header provides `Login` and `Sign In` buttons for registered accounts.
- **Requirement 1.3**: Hero section features a prominent `Get Started` button that directs the user to the Event Gateway.

### 3.2. User Journey 2: Event Entry Hub (Create vs. Find Event)
- **Requirement 2.1 — Create an Event**:
  - Requires only the `Event Title` (e.g., "Kraft Night 2026").
  - The system automatically generates a unique **6-digit Event Code** (e.g., `482910`).
  - The creator is automatically granted the **Manager** role and redirected to the Manager Command Center.
- **Requirement 2.2 — Find an Event**:
  - Provides a dedicated 6-box input field for the 6-digit code.
  - Submitting a valid code adds the user to the event's **Joined People Lobby** with the default status of "Awaiting Assignment".

### 3.3. User Journey 3: Workspace Command Center & Program Scheduling
- **Requirement 3.1 — Sidebar Navigation**:
  - `Dashboard` (Timeline, assigned roles for the selected programme, event snapshot).
  - `Assign Roles` (Add or update joined members with role and operational group).
  - `Create Program` (Inline programme creation plus full schedule list).
  - `Groups` (Group directory plus per-group chat stream).
  - `About Event` (Event details derived from live state: venue, PIN, counts, groups, leads).
- **Requirement 3.2 — Programmes Timeline**:
  - Displays chronological list of scheduled items: Start Time, Program Title, Venue/Stage, and Status (`scheduled`, `in_progress`, `completed`, `delayed`).
  - Manager can add, edit time, or cycle status.
- **Requirement 3.3 — Joined People Roster**:
  - Displays all users who entered the 6-digit code (e.g., Athul, Athira, Imdad).
  - Manager can assign their Role (`VIP / Overseer`, `Team Leader`, `Volunteer`) and Department (`Food`, `Stage`, etc.).

### 3.4. User Journey 4: In-App Group Chat Channels
- **Requirement 4.1 — Dedicated Group Channels**:
  - Every group created by the Manager gets an isolated in-app chat channel.
- **Requirement 4.2 — Permission-Governed Messaging**:
  - **Manager**: Can switch between all group channels and post messages.
  - **VIP / Overseer**: Can switch between all group channels, but input box is disabled with a "Read-Only Observer" indicator.
  - **Team Leader**: Can switch to any group channel to read, but can only type/post in their own group.
  - **Volunteer**: Only sees their assigned group channel in the sidebar; input enabled only in that channel.
- **Requirement 4.3 — Message UI**:
  - Message bubble displays sender avatar, full name, role badge (`Manager`, `Leader`, `Volunteer`), timestamp, and content.

### 3.5. User Journey 5: Embedded Gemini AI Assistant
- **Requirement 5.1 — Context Awareness**:
  - The Gemini assistant has direct read access to the live event state (current time, current active program, delayed programs, list of groups and leaders).
- **Requirement 5.2 — Quick Action Prompts**:
  - *"Summarize recent updates in Food Coordination"*
  - *"Check timeline clashes for VIP arrival"*
  - *"Draft volunteer briefing for Stage 1"*
- **Requirement 5.3 — Conversational Chat**:
  - Interactive chat panel where any user can query the event schedule or ask operational questions.

---

## 4. Visual Wireframe Mappings

| Screen | Wireframe File | Corresponding Handwritten Note |
| :--- | :--- | :--- |
| **Landing & Auth** | [`docs/images/01_landing_login_page.jpg`](images/01_landing_login_page.jpg) | Note 1: Top bar with Login/Sign up, Get Started button |
| **Event Gateway** | [`docs/images/02_create_find_event.jpg`](images/02_create_find_event.jpg) | Note 1 & Note 4: Create Event card & Find Event with 6-digit code |
| **Manager Command Center** | [`docs/images/03_manager_dashboard.jpg`](images/03_manager_dashboard.jpg) | Note 2 & Note 4: Sidebar, Program Timeline & Joined People roster |
| **In-App Chat & Gemini AI** | [`docs/images/04_team_chat_gemini.jpg`](images/04_team_chat_gemini.jpg) | Note 3 & Note 5: Group chat section, role badges, Gemini AI assistant |

---

## 5. Non-Functional Requirements

1. **Zero-Setup Evaluation**: Must run in any modern browser out-of-the-box using standard static serving (`npx serve submissions/team-linx/app/`) with localStorage state simulation when live Supabase keys are not provided.
2. **Instant Role Switching**: Include an evaluator role switcher in the sidebar profile panel allowing hackathon judges to instantly switch between **Manager**, **VIP / Overseer**, **Team Leader**, and **Volunteer** to test permissions in real-time.
3. **Light Workspace Aesthetic**: Clean light interface (`#fafaf9` surfaces, `#e8e8e6` borders, 14–16px radii), DM Sans / DM Mono typography, pink-to-orange gradient accents, red live / purple upcoming / gray completed states, and zero framework CSS.
4. **Resilience**: Graceful fallbacks for network disconnection or API rate limits.

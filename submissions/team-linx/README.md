# Team Name: LINX

## Members
| Name | Email | GitHub |
|------|-------|--------|
| Member 1 | member1@example.com | @github-handle |
| Member 2 | member2@example.com | @github-handle |
| Member 3 | member3@example.com | @github-handle |
| Member 4 | member4@example.com | @github-handle |

## Project Name
Sangam (സംഗമം / संगम) — Real-Time Event Collaboration & Management Platform

## Goal / Problem Statement
Event management teams currently struggle with fragmented tools—chaotic WhatsApp group chats, disconnected spreadsheets, and missed deadlines. **Sangam** unites organizers, department team leads, and on-ground volunteers into a single intelligent real-time command center. It features live multi-department chat, real-time Kanban task management, role-based access, SendGrid email invites, and an **AI Event Coordinator** powered by Google Gemini that auto-generates status briefings, identifies delay risks, and converts plain natural-language requests into structured tasks.

## Tech Stack
- **Frontend**: Vanilla HTML5, Modern CSS3 (Glassmorphism design system), Vanilla JavaScript (ES6+ Modules) — *Zero frameworks, zero bundlers*
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Supabase Realtime WebSockets, Supabase Storage)
- **AI Intelligence**: Google AI SDK / Gemini API (via Supabase Edge Function proxy)
- **Email Service**: SendGrid Mail API (invitations & critical delay escalations)

## Demo Video
*(Link will be updated prior to final submission)*

## Screenshots
See the `photos/` folder in this directory for working screenshots of the dashboard, Kanban board, department chat, and AI coordinator.

## How to Run
1. Navigate to `submissions/team-linx/app/`.
2. Open `index.html` directly in any modern web browser, or start a lightweight static server:
   ```bash
   npx serve submissions/team-linx/app/
   ```
3. To test different user journeys, use the **Role Switcher** in the top bar to toggle between **Administrator**, **Department Lead**, and **Volunteer** views.

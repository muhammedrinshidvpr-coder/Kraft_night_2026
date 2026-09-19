# Team Name: LINX

## Members
<!-- TODO(FILL-LATER): replace with real names, emails, GitHub handles before final PR -->
| Name | Email | GitHub |
|------|-------|--------|
| <!-- TODO --> Member 1 | member1@example.com | @github-handle |
| <!-- TODO --> Member 2 | member2@example.com | @github-handle |
| <!-- TODO --> Member 3 | member3@example.com | @github-handle |
| <!-- TODO --> Member 4 | member4@example.com | @github-handle |

## Project Name
Sangam (സംഗമം / संगम) — Real-Time Event Collaboration & Management Platform

## Goal / Problem Statement
Event management teams currently struggle with fragmented tools—chaotic WhatsApp group chats, disconnected spreadsheets, and missed deadlines. **Sangam** unites organizers, department team leads, and on-ground volunteers into a single intelligent real-time command center. It features live multi-department chat, real-time Kanban task management, role-based access, SendGrid email invites, and an **AI Event Coordinator** powered by Google Gemini that auto-generates status briefings, identifies delay risks, and converts plain natural-language requests into structured tasks.

## Tech Stack
- **Frontend**: Vanilla HTML5, Modern CSS3 (Glassmorphism design system), Vanilla JavaScript (ES6+ Modules) — *Zero frameworks, zero bundlers*
- **Backend & Database**: Supabase (PostgreSQL / SQL, Supabase Auth, Supabase Realtime WebSockets, Supabase Storage, Edge Functions in TypeScript/Deno — languages allowed, frameworks banned)
- **AI Intelligence**: Google AI SDK / Gemini API (via Supabase Edge Function proxy)
- **Email Service**: SendGrid Mail API (invitations & critical delay escalations)

## 🌐 Live Production Deployment
- **Live URL**: **[https://app-opal-tau-88.vercel.app](https://app-opal-tau-88.vercel.app)**
- **Realtime Engine**: Supabase Realtime WebSockets (Live multi-device sync across laptops & mobile phones)
- **CI/CD**: GitHub Actions automated pipeline deploying on push to `main`

## Demo Video
<!-- TODO(FILL-LATER): paste unlisted YouTube/Drive link before final submission -->
*(Link will be updated prior to final submission — TODO)*

## Screenshots
See the `photos/` folder in this directory for working screenshots of the light five-page workspace (Dashboard, Assign Roles, Create Program, Groups, About Event) and the persistent AI briefing rail.

## 📖 Documentation & Architecture Specifications
Comprehensive engineering documentation and wireframes are available in the **[`docs/`](docs/README.md)** directory:
- **[Product Requirements Document (PRD)](docs/PRD.md)** — User journeys, role hierarchy (Manager, VIP Overseer, Team Leader, Volunteer), and feature rules.
- **[Technical Requirements Document (TRD)](docs/TRD.md)** — Dual-mode architecture, Realtime WebSocket specs, and RBAC matrix.
- **[System Architecture (ARCHITECTURE.md)](docs/ARCHITECTURE.md)** — SPA view routing, data-flow sequence diagrams, and state management.
- **[Component Specifications (COMPONENTS.md)](docs/COMPONENTS.md)** — Design tokens, element specs, and visual states for all components.
- **[Data Models & Schema (DATA_MODEL.md)](docs/DATA_MODEL.md)** — Entity-relationship diagram, PostgreSQL / Supabase DDL, and mock data models.
- **[Visual Wireframe Gallery](docs/README.md#visual-wireframes--ui-designs)** — High-fidelity UI mockups for all 4 primary screens.

## How to Run
1. Navigate to `submissions/team-linx/app/`.
2. Open `index.html` directly in any modern web browser, or start a lightweight static server:
   ```bash
   npx serve submissions/team-linx/app/
   ```
3. To test different user journeys, open the profile panel in the sidebar footer to switch between **Manager**, **VIP Overseer**, **Team Leader**, and **Volunteer** views.
4. Optional dependency-free UI smoke test: serve `app/` and open `app/tests/ui-smoke.html`, then press **Run tests** (covers programme creation across pages plus reload persistence).

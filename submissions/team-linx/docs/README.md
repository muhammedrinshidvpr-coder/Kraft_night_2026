# Sangam (സംഗമം) — Project Engineering Documentation
**Team:** LINX • Kraft Night 2026 Hackathon  
**Platform:** Unified Event Command & Coordination System  

Welcome to the central engineering and design documentation for **Sangam**. All documentation, technical specifications, and UI wireframes have been created and organized inside `submissions/team-linx/docs/` in accordance with the competition submission guidelines.

---

## 📚 Documentation Index

| Document | Description |
| :--- | :--- |
| **[PRD.md](PRD.md)** | **Product Requirements Document**: Problem statement, target personas (Manager, VIP Overseer, Team Leader, Volunteer), user journeys, feature requirements, and wireframe mappings. |
| **[TRD.md](TRD.md)** | **Technical Requirements Document**: Tech stack breakdown (HTML5/CSS3/Vanilla JS + Supabase + Gemini API), dual-mode architecture (Mock vs. Live Cloud), WebSocket real-time specs, and RBAC rules. |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | **System Architecture & Workflows**: High-level component diagrams, SPA view routing lifecycles, data-flow sequences, and state management models. |
| **[COMPONENTS.md](COMPONENTS.md)** | **UI Component Catalog**: Detailed design tokens, DOM element specifications, behavior guidelines, and visual states for all 8 core app components. |
| **[DATA_MODEL.md](DATA_MODEL.md)** | **Database & Entity Schemas**: Full Entity-Relationship (ER) diagram, production PostgreSQL / Supabase DDL with RLS policies, and client-side seed data structures. |

---

## 🎨 Visual Wireframes & UI Designs

All high-fidelity visual mockups generated from the handwritten design notes are stored in [`docs/images/`](images/):

1. **[01_landing_login_page.jpg](images/01_landing_login_page.jpg)**: Light entry hero with *Get Started* and *Direct Demo Login*.
2. **[02_create_find_event.jpg](images/02_create_find_event.jpg)**: Event gateway with *Create an Event* (enter title -> become manager) and *Find an Event* (6-digit PIN input).
3. **[03_manager_dashboard.jpg](images/03_manager_dashboard.jpg)**: Workspace with sidebar (*Dashboard*, *Assign Roles*, *Create Program*, *Groups*, *About Event*), schedule timeline, assigned roles, event snapshot, and persistent AI briefing rail.
4. **[04_team_chat_gemini.jpg](images/04_team_chat_gemini.jpg)**: Groups directory plus per-group chat stream with RBAC banner and integrated AI coordinator.
5. Refresh `photos/` and `docs/images/` after final visual review of the light workspace at desktop, tablet, and mobile widths.

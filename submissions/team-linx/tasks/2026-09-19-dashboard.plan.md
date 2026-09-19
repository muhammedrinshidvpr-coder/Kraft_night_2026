# Dashboard Workspace Plan — Figma Light UI in Vanilla Stack

## Scope
- WHERE: `submissions/team-linx/` ONLY.
- WHAT: Vanilla HTML5 + Vanilla JS ES modules + Vanilla CSS3 + Supabase/SQL only. No React, Tailwind, Vite, bundlers, CSS frameworks, UI kits, jQuery, or new npm deps.
- Reference UI: `C:\Users\lenovo\Downloads\Create dashboard page\src\App.tsx` + `src\index.css` + 5 WhatsApp reference images.
- Decision: copy Figma visual system/layout, keep Sangam/Kraft Night branding, event data, RBAC, localStorage, chat, Gemini.

## Backbone
- Data models: unchanged (`programmes`, `groups`, `joinedPeople`, `messages`, `currentEvent`, `currentUser`). No migration change.
- Public contracts:
  - `TaskManager.addProgramme/getProgrammes/cycleProgrammeStatus/deleteProgramme/getStats`
  - `ChatManager.getMessages/sendMessage/setActiveGroup`
  - `AuthManager.setRole/canCreateProgramme/canEditProgramme/canAssignRoles/canCreateGroup/canPostInGroup/canViewGroup`
  - `aiCoordinator.askGemini/generateStatusBriefing`
  - `AppController.switchView/switchWorkspacePage/render*`
- Orchestration: `AppController.init -> bind* -> switchView -> render(page) -> Task/Chat/Auth/AI managers -> localStorage`.
- Routing: `landing | gateway | dashboard | assign-roles | create-program | groups | about-event`. Legacy `chat` normalizes to `groups`. Persist `sangam_active_view`.
- Error strategy: fail-safe UI; invalid forms do not mutate; AI failure falls back to local engine; RBAC denials alert and block.
- Testing: dependency-free `app/tests/ui-smoke.html` iframe runner + feature verification (create programme on Create Program -> visible on Dashboard -> survives reload).

## Boundaries
- IN SCOPE: `app/index.html`, `app/style.css`, `app/js/main.js`, small `config.js` display defaults if needed, `app/tests/ui-smoke.*`, docs, screenshots.
- OUT OF SCOPE: Supabase migrations, Edge Functions, email, new tables/columns, framework tooling.
- MUST NOT CHANGE: `app/supabase/**`, secrets, other teams, repo root.
- MUST FOLLOW: `agent.md` stack/scope, existing manager module APIs, localStorage keys, RBAC matrix.

## Pre-decisions
- Landing/gateway kept and restyled (not removed).
- Assign Roles edits existing joined members (no new person schema).
- Group create keeps existing fields (name/icon/leader/description); no table/track columns.
- About Event derives organizers/tracks/counts from existing state; no new persisted metadata.
- Role switcher lives in profile popover + remains keyboard accessible.
- AI rail persistent on desktop, drawer on tablet/mobile (not hidden without access).

## Verification checkpoints
1. After shell: all 7 views exist, one visible, landmarks valid.
2. After routing: 5 pages switch, header/active state match, legacy chat->groups.
3. After dashboard: select != mutate; manager status control works; snapshot derived.
4. After roles/programs/groups/about/AI: CRUD persists, RBAC enforced, AI responds.
5. After responsive/a11y: 390/768/1024/1440 pass, keyboard + focus + reduced motion pass.
6. After tests/docs: smoke + matrix + `git diff --check` + no forbidden imports pass.

## Acceptance
- 5 pages match Figma density/layout/tokens; Sangam data/RBAC/features intact.
- Entry flows work; no horizontal overflow; keyboard usable.
- New feature test passes; no framework/migration/secret introduced.
- Docs + screenshots updated.

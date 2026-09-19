# Agent Rules — Team Linx (Kraft Night 2026)

This file defines hard constraints for any AI agent / contributor working in this repo.
These rules override any default behavior.

## 1. Scope — ONLY work inside Team Linx folder

- **Allowed directory:** `submissions/team-linx/` (this folder — `.` relative to this file)
- **ONLY edit, create, or delete files inside:** `submissions/team-linx/`
- **NEVER edit, create, or delete files outside that folder.** This includes but is not limited to:
  - `README.md` at repo root
  - `submissions/_TEMPLATE/`
  - `submissions/team-*/` for any other team
  - `.git/`, `.github/`, workflows, configs at root
- If a task requires a change outside `submissions/team-linx/`, STOP and ask the user for explicit permission first. Do not proceed without approval.

## 2. Tech Stack — Allowlist Only

When creating anything (new features, files, fixes, refactors), ONLY use these technologies:

1. **Supabase** — PostgreSQL / SQL, Auth, Realtime, Storage, Edge Functions (Supabase only)
   - Client via `@supabase/supabase-js` CDN / ESM import only
2. **HTML** — Vanilla HTML5, no templating engines
3. **JavaScript** — Vanilla JS (ES6+ Modules), no frameworks
4. **TypeScript** — Allowed everywhere as a language (superset of JavaScript). Already used in Supabase Edge Functions (`app/supabase/functions/*/index.ts`, Deno runtime); optional in frontend (`app/js/`) too, but still no frameworks, no bundlers, no build-step dependency unless you explicitly approve one.
5. **CSS** — Vanilla / Modern CSS3, no preprocessors or CSS frameworks
6. **SQL** — Postgres SQL for `app/supabase/migrations/` only

Rule of thumb: **languages are allowed, frameworks are banned.**

### 2.1 Explicitly FORBIDDEN — Do NOT use frameworks:

- No frontend frameworks/libraries: React, Vue, Angular, Svelte, Next.js, Nuxt, Solid, etc.
- No bundlers / toolchains: Vite, Webpack, Rollup, Parcel, esbuild builds, npm build steps
- No backend languages/frameworks: Node.js/Express, Python/Django/Flask, PHP, Go, Java, etc.
- No other databases / BaaS: Firebase, MongoDB, PlanetScale, Appwrite, etc. — Supabase only
- No CSS frameworks / preprocessors: Tailwind, Bootstrap, Bulma, Sass, Less, etc.
- No UI component kits, no jQuery. No new npm dependencies except `supabase-js`. If a library seems necessary, STOP and ask first.
- TypeScript is allowed everywhere as a language. Do NOT use it to pull in frameworks (no Angular, Nest, Next, etc.). Frontend default stays plain `.js` unless you explicitly choose `.ts`.

### 2.2 How to build:

- Static files under `app/` (`index.html`, `style.css`, `js/`, `supabase/`)
- No build step — must run by opening `index.html` or via a static server (e.g. `npx serve submissions/team-linx/app/`)
- Supabase keys / config: use `env.example.js` pattern, never commit real secrets. Respect existing `.gitignore`.
- Keep existing docs in `docs/` consistent if schema or architecture changes.

## 3. Workflow

1. Before any edit, verify target path is inside `submissions/team-linx/`.
2. Prefer editing existing files over creating new ones.
3. Match existing vanilla JS module + glassmorphism CSS style.
4. After changes, sanity-check: no forbidden imports, no files created outside scope, no secrets committed.
5. Summarize what changed and confirm scope + stack compliance.

## 4. Summary for Agents

- **WHERE:** `submissions/team-linx/` ONLY.
- **WHAT:** Supabase + SQL + HTML + JavaScript + TypeScript + CSS ONLY. Languages yes, frameworks no.
- **ELSE:** Ask before doing anything outside these bounds.

## 5. Database Migrations — One File Per Table + UI->SQL Rule

- **Source of truth:** `app/supabase/migrations/` — one file per table:
  - `00_init.sql` (extensions + enum), `01_profiles.sql`, `02_events.sql`,
    `03_event_groups.sql`, `04_event_members.sql`, `05_programmes.sql`,
    `06_chat_messages.sql`, `07_ai_chat_sessions.sql`, `08_realtime.sql`
  - `app/supabase/schema.sql` is legacy snapshot only. Do not treat as source of truth.
  - **Apply method:** manual — paste each file in order (00→08) into Supabase Dashboard SQL Editor. No CLI required. See `app/supabase/migrations/README.md`.
- **UI->SQL sync (Alert + Ask Permission — MANDATORY):**
  1. Whenever a UI change in `app/index.html`, `app/style.css`, or `app/js/*.js` needs a DB change (new/renamed/removed column, table, enum value, RLS policy, realtime subscription), STOP. Do not edit SQL silently.
  2. ALERT the user with: (a) which UI file changed, (b) which migration file is affected (e.g. `05_programmes.sql` for `js/tasks.js`), (c) exact proposed SQL diff.
  3. ASK for explicit permission and WAIT for `yes` before touching any file under `app/supabase/migrations/`.
  4. After approval: edit only the corresponding per-table file, update its `UI mapping` header comment, keep changes idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`), and tell the user which file(s) to re-run in SQL Editor.
- **Never:** auto-update SQL alongside UI, bundle multiple tables into one file, or add a new table without its own `NN_<name>.sql` file + README order entry.

# Supabase Migrations — Team Linx (Sangam)

Manual-apply setup. One file per table. No CLI, no build step.

## Run order (Supabase Dashboard → SQL Editor → New Query)

Run each file in order, one paste per file:

1. `00_init.sql` — extensions + `event_role_type` enum
2. `01_profiles.sql` — `public.profiles`
3. `02_events.sql` — `public.events`
4. `03_event_groups.sql` — `public.event_groups`
5. `04_event_members.sql` — `public.event_members`
6. `05_programmes.sql` — `public.programmes`
7. `06_chat_messages.sql` — `public.chat_messages`
8. `07_ai_chat_sessions.sql` — `public.ai_chat_sessions`
9. `08_realtime.sql` — Realtime publication adds

Verify in **Table Editor**: `profiles, events, event_groups, event_members, programmes, chat_messages, ai_chat_sessions`.
Verify in **Database → Replication → supabase_realtime**: `chat_messages, programmes, event_members` checked.

## Legacy file

- `../schema.sql` is the old single-file snapshot. Kept for reference.
- **Source of truth going forward is `migrations/`** — one file per table.
- If you change `migrations/`, optionally regenerate `../schema.sql` by concatenating 00→08 in order, or leave it frozen and note the divergence here.

## UI → SQL rule (enforced by agent.md)

Whenever a UI change (in `app/index.html`, `app/style.css`, `app/js/*.js`) needs a new / renamed / removed DB column, table, enum value, policy, or realtime subscription:

1. **STOP** — do not silently edit SQL.
2. **ALERT** — state: which UI file changed, which table file is affected, exact SQL diff proposed (e.g. `ALTER TABLE public.programmes ADD COLUMN priority text;`).
3. **ASK PERMISSION** — wait for explicit user `yes` before touching any file under `app/supabase/migrations/`.
4. Only after approval: edit the corresponding per-table file, keep header `UI mapping` comment in sync, and summarize what to re-run in SQL Editor.

No auto-migration. No silent schema drift.

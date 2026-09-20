# Supabase Migrations — Team Linx (Sangam)

The deployed project uses the text-ID base schema in `../schema.sql`.

## AI migration order (Supabase Dashboard → SQL Editor → New Query)

1. Run `../schema.sql` once for the base application tables.
2. `09_ai_event_blueprints.sql` — AI plan drafts, unfilled role slots, and atomic apply RPC.
3. `10_auth_profile_trigger.sql` — creates a profile for every Supabase Auth user.
4. `11_programme_sync_security.sql` — shared schedule authority: manager-of-that-event programme RLS plus transactional `replace_event_programmes` recovery RPC. Deploy before the frontend.

Verify in **Table Editor**: `profiles, events, event_groups, event_members, programmes, chat_messages, ai_chat_sessions, ai_event_blueprints, event_role_slots`.
Verify in **Database → Replication → supabase_realtime**: `chat_messages, programmes, event_members` checked.

## Alternate schema files

- `00_init.sql` through `08_realtime.sql` define an alternate UUID schema and
  are not compatible with the deployed text-ID project.
- Do not run those files alongside `../schema.sql`.

## AI coordinator secrets

Configure `GEMINI_API_KEY` as a Supabase Edge Function secret before deploying `ai-coordinator`. Do not add it to `env.js`, `env.example.js`, browser configuration, or source control. The function also uses Supabase's server-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to validate the caller and persist drafts.

## UI → SQL rule (enforced by agent.md)

Whenever a UI change (in `app/index.html`, `app/style.css`, `app/js/*.js`) needs a new / renamed / removed DB column, table, enum value, policy, or realtime subscription:

1. **STOP** — do not silently edit SQL.
2. **ALERT** — state: which UI file changed, which table file is affected, exact SQL diff proposed (e.g. `ALTER TABLE public.programmes ADD COLUMN priority text;`).
3. **ASK PERMISSION** — wait for explicit user `yes` before touching any file under `app/supabase/migrations/`.
4. Only after approval: edit the corresponding per-table file, keep header `UI mapping` comment in sync, and summarize what to re-run in SQL Editor.

No auto-migration. No silent schema drift.

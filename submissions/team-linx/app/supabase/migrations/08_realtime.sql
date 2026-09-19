-- ==============================================================================
-- SANGAM — 08_realtime: enable Realtime WebSockets
-- Team LINX • Kraft Night 2026
-- UI mapping: js/supabase-client.js getSupabase() subscriptions,
--             live updates in js/chat.js + js/tasks.js
-- Run order: LAST, after 01_* .. 07_*
-- UI->SQL rule: if UI needs live updates on a new table,
--   STOP + alert and ask permission before adding ALTER PUBLICATION here.
-- ==============================================================================
-- Idempotent adds (ignore error if already a member):
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.programmes;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.event_members;
exception when duplicate_object then null;
end $$;

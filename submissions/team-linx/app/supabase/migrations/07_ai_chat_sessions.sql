-- ==============================================================================
-- SANGAM — 07_ai_chat_sessions: Gemini AI coordinator logs
-- Team LINX • Kraft Night 2026
-- UI mapping: js/ai.js aiCoordinator, AI panel in index.html,
--             Edge Function supabase/functions/ai-coordinator
-- Run order: after 02_events.sql
-- UI->SQL rule: if UI adds AI fields (action_type options, tokens,
--   model name, feedback), STOP + alert and ask permission before ALTER here.
-- ==============================================================================
create table if not exists public.ai_chat_sessions (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  prompt text not null,
  response_text text not null,
  action_type text default 'query',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.ai_chat_sessions enable row level security;

drop policy if exists "Allow read ai sessions" on public.ai_chat_sessions;
create policy "Allow read ai sessions"
  on public.ai_chat_sessions for select using (true);

drop policy if exists "Allow insert ai sessions" on public.ai_chat_sessions;
create policy "Allow insert ai sessions"
  on public.ai_chat_sessions for insert with check (true);

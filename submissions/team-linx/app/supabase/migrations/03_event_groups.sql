-- ==============================================================================
-- SANGAM — 03_event_groups: operational departments / groups
-- Team LINX • Kraft Night 2026
-- UI mapping: group list / department switcher in index.html,
--             js/chat.js setActiveGroup(), js/main.js renderJoinedPeople()
-- Run order: after 02_events.sql (event_id -> events.id)
-- UI->SQL rule: if UI adds group fields (color, capacity, meeting link),
--   STOP + alert and ask permission before ALTER here.
-- ==============================================================================
create table if not exists public.event_groups (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null,
  description text,
  icon text default '👥',
  leader_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_event_groups_event_id on public.event_groups(event_id);

alter table public.event_groups enable row level security;

drop policy if exists "Allow public read access to event groups" on public.event_groups;
create policy "Allow public read access to event groups"
  on public.event_groups for select using (true);

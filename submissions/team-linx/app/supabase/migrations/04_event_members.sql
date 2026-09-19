-- ==============================================================================
-- SANGAM — 04_event_members: user <-> event role assignments
-- Team LINX • Kraft Night 2026
-- UI mapping: js/auth.js RBAC (manager/overseer/lead/volunteer),
--             roster in js/main.js renderJoinedPeople(), role switcher
-- Run order: after 00_init.sql (enum), 02_events.sql, 03_event_groups.sql
-- UI->SQL rule: if UI adds roles, statuses, or assignment fields,
--   STOP + alert and ask permission before ALTER / ALTER TYPE here.
-- ==============================================================================
create table if not exists public.event_members (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  assigned_group_id uuid references public.event_groups(id) on delete set null,
  role event_role_type not null default 'volunteer',
  joined_at timestamptz default timezone('utc'::text, now()) not null,
  unique(event_id, user_id)
);

create index if not exists idx_event_members_event on public.event_members(event_id);
create index if not exists idx_event_members_user on public.event_members(user_id);

alter table public.event_members enable row level security;

drop policy if exists "Allow members read access" on public.event_members;
create policy "Allow members read access"
  on public.event_members for select using (true);

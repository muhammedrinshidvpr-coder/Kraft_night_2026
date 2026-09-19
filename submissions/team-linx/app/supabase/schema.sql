-- ==============================================================================
-- SANGAM (സംഗമം / संगम) - Production Database Schema
-- Platform: Supabase PostgreSQL & Realtime WebSockets
-- Team: LINX (Kraft Night 2026 Hackathon)
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (Supports both Supabase Auth & Persona Evaluator logins)
create table if not exists public.profiles (
  id text primary key,
  full_name text not null,
  email text,
  avatar_url text,
  phone text,
  role text default 'volunteer',
  department text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;
drop policy if exists "Profiles Public Read" on public.profiles;
drop policy if exists "Profiles Public Write" on public.profiles;
create policy "Profiles Public Read" on public.profiles for select using (true);
create policy "Profiles Public Write" on public.profiles for all using (true) with check (true);

-- 2. Events Table (With 6-digit Code for instant PIN entry)
create table if not exists public.events (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  six_digit_code varchar(10) unique not null,
  venue text default 'Main Campus & Auditorium',
  status text check (status in ('draft', 'active', 'completed', 'archived')) default 'active',
  manager_id text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_events_six_digit_code on public.events(six_digit_code);
alter table public.events enable row level security;
drop policy if exists "Events Public Read" on public.events;
drop policy if exists "Events Public Write" on public.events;
create policy "Events Public Read" on public.events for select using (true);
create policy "Events Public Write" on public.events for all using (true) with check (true);

-- 3. Operational Groups (e.g. Food Coordination, Stage & Sound, VIP Protocol)
create table if not exists public.event_groups (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade not null,
  name text not null,
  description text,
  icon text default '👥',
  leader_id text,
  leader_name text,
  member_count int default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_event_groups_event on public.event_groups(event_id);
alter table public.event_groups enable row level security;
drop policy if exists "Event Groups Public Read" on public.event_groups;
drop policy if exists "Event Groups Public Write" on public.event_groups;
create policy "Event Groups Public Read" on public.event_groups for select using (true);
create policy "Event Groups Public Write" on public.event_groups for all using (true) with check (true);

-- 4. Event Members (Mapping attendees to roles: manager, overseer, lead, volunteer)
create table if not exists public.event_members (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade not null,
  user_id text not null,
  name text not null,
  email text,
  role text not null default 'volunteer',
  role_badge text,
  assigned_group_id text,
  group_name text,
  status text default 'active',
  joined_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_event_members_event on public.event_members(event_id);
alter table public.event_members enable row level security;
drop policy if exists "Event Members Public Read" on public.event_members;
drop policy if exists "Event Members Public Write" on public.event_members;
create policy "Event Members Public Read" on public.event_members for select using (true);
create policy "Event Members Public Write" on public.event_members for all using (true) with check (true);

-- 5. Programmes Table (Schedule Timeline)
create table if not exists public.programmes (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade not null,
  title text not null,
  description text,
  start_time text not null,
  end_time text not null,
  venue text default 'Main Stage',
  status text check (status in ('scheduled', 'in_progress', 'completed', 'delayed')) default 'scheduled',
  lead_group text,
  created_by text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_programmes_event on public.programmes(event_id);
alter table public.programmes enable row level security;
drop policy if exists "Programmes Public Read" on public.programmes;
drop policy if exists "Programmes Public Write" on public.programmes;
create policy "Programmes Public Read" on public.programmes for select using (true);
create policy "Programmes Public Write" on public.programmes for all using (true) with check (true);

-- 6. In-App Group Chat Messages Table
create table if not exists public.chat_messages (
  id text primary key default gen_random_uuid()::text,
  group_id text not null,
  sender_id text not null,
  sender_name text not null,
  sender_role text default 'volunteer',
  message_text text not null,
  attachment_url text,
  avatar text,
  time text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_chat_messages_group on public.chat_messages(group_id, created_at);
alter table public.chat_messages enable row level security;
drop policy if exists "Chat Messages Public Read" on public.chat_messages;
drop policy if exists "Chat Messages Public Write" on public.chat_messages;
create policy "Chat Messages Public Read" on public.chat_messages for select using (true);
create policy "Chat Messages Public Write" on public.chat_messages for all using (true) with check (true);

-- 7. Gemini AI Chat Logs Table
create table if not exists public.ai_chat_sessions (
  id text primary key default gen_random_uuid()::text,
  event_id text,
  user_id text,
  prompt text not null,
  response_text text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.ai_chat_sessions enable row level security;
drop policy if exists "AI Chat Public Read" on public.ai_chat_sessions;
drop policy if exists "AI Chat Public Write" on public.ai_chat_sessions;
create policy "AI Chat Public Read" on public.ai_chat_sessions for select using (true);
create policy "AI Chat Public Write" on public.ai_chat_sessions for all using (true) with check (true);

-- ==============================================================================
-- Realtime WebSocket Setup (Enables instant multi-client push)
-- ==============================================================================
alter table public.chat_messages replica identity full;
alter table public.programmes replica identity full;
alter table public.event_members replica identity full;
alter table public.event_groups replica identity full;
alter table public.events replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'programmes') then
    alter publication supabase_realtime add table public.programmes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'event_members') then
    alter publication supabase_realtime add table public.event_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'event_groups') then
    alter publication supabase_realtime add table public.event_groups;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

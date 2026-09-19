-- ==============================================================================
-- SANGAM (സംഗമം / संगम) - Database Schema
-- Platform: Supabase PostgreSQL
-- Team: LINX (Kraft Night 2026)
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (Extends Supabase Auth users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null unique,
  role text check (role in ('admin', 'lead', 'volunteer')) default 'volunteer',
  avatar_url text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;
create policy "Allow public read access to profiles" on public.profiles for select using (true);
create policy "Allow users to update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. Events Table
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  tagline text,
  description text,
  venue text default 'Main Auditorium',
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  status text check (status in ('upcoming', 'live', 'completed')) default 'live',
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.events enable row level security;
create policy "Allow public read access to events" on public.events for select using (true);

-- 3. Departments Table
create table if not exists public.departments (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null,
  icon text default '📌',
  lead_id uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.departments enable row level security;
create policy "Allow public read access to departments" on public.departments for select using (true);

-- 4. Event Members (Mapping users to event departments and roles)
create table if not exists public.event_members (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  department_id uuid references public.departments(id) on delete set null,
  role text check (role in ('admin', 'lead', 'volunteer')) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(event_id, user_id)
);

alter table public.event_members enable row level security;
create policy "Allow members read access" on public.event_members for select using (true);

-- 5. Tasks Table
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  department_id uuid references public.departments(id) on delete cascade not null,
  title text not null,
  description text,
  status text check (status in ('todo', 'in_progress', 'review', 'completed')) default 'todo',
  priority text check (priority in ('low', 'medium', 'high', 'critical')) default 'medium',
  due_date timestamp with time zone,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;
create policy "Allow read access to tasks" on public.tasks for select using (true);
create policy "Allow insert tasks" on public.tasks for insert with check (true);
create policy "Allow update tasks" on public.tasks for update using (true);

-- Enable Realtime for Tasks
alter publication supabase_realtime add table public.tasks;

-- 6. Department Chat Messages Table
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  department_id uuid references public.departments(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  sender_name text not null,
  sender_role text default 'volunteer',
  message text not null,
  attachment_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.chat_messages enable row level security;
create policy "Allow read access to chat messages" on public.chat_messages for select using (true);
create policy "Allow insert chat messages" on public.chat_messages for insert with check (true);

-- Enable Realtime for Chat
alter publication supabase_realtime add table public.chat_messages;

-- 7. AI Briefings & Risk Logs Table
create table if not exists public.ai_briefings (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  briefing_type text not null, -- 'executive_summary', 'risk_alert', 'nl_task_conversion'
  summary text not null,
  risks jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_briefings enable row level security;
create policy "Allow read access to AI briefings" on public.ai_briefings for select using (true);

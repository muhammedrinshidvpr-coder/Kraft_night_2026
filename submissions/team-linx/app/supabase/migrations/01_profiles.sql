-- ==============================================================================
-- SANGAM — 01_profiles: user profiles (linked to Supabase Auth)
-- Team LINX • Kraft Night 2026
-- UI mapping: js/auth.js (login / role switcher), index.html top-bar,
--             js/chat.js (sender_name), js/tasks.js (created_by display)
-- Run order: after 00_init.sql
-- UI->SQL rule: if UI adds a profile field (e.g. phone, department,
--   avatar), STOP + alert and ask permission before ALTER TABLE here.
-- ==============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null unique,
  avatar_url text,
  phone text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

drop policy if exists "Allow public read access to profiles" on public.profiles;
create policy "Allow public read access to profiles"
  on public.profiles for select using (true);

drop policy if exists "Allow users to update own profile" on public.profiles;
create policy "Allow users to update own profile"
  on public.profiles for update using (auth.uid() = id);

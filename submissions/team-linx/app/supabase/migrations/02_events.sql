-- ==============================================================================
-- SANGAM — 02_events: top-level event (join via 6-digit code)
-- Team LINX • Kraft Night 2026
-- UI mapping: gateway forms in js/main.js (Create vs Find Event),
--             index.html event header, js/config.js SEED_DATA.event
-- Run order: after 01_profiles.sql (manager_id -> profiles.id)
-- UI->SQL rule: if UI adds event fields (tagline, venue detail,
--   dates, cover image), STOP + alert and ask permission before ALTER here.
-- ==============================================================================
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  six_digit_code varchar(6) unique not null,
  venue text default 'Main Campus & Auditorium',
  status text check (status in ('draft', 'active', 'completed', 'archived')) default 'active',
  manager_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_events_six_digit_code on public.events(six_digit_code);

alter table public.events enable row level security;

drop policy if exists "Allow public read access to events" on public.events;
create policy "Allow public read access to events"
  on public.events for select using (true);

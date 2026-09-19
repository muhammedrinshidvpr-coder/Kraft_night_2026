-- ==============================================================================
-- SANGAM — 05_programmes: event schedule timeline (Kanban / timeline UI)
-- Team LINX • Kraft Night 2026
-- UI mapping: js/tasks.js TaskManager (addProgramme, cycleProgrammeStatus),
--             timeline view in js/main.js renderProgrammesTimeline()
-- Run order: after 02_events.sql
-- UI->SQL rule: if UI adds programme fields (priority, leadGroup,
--   checklist, attachments), STOP + alert and ask permission before ALTER here.
-- ==============================================================================
create table if not exists public.programmes (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  venue_or_stage text default 'Main Stage',
  status text check (status in ('scheduled', 'in_progress', 'completed', 'delayed')) default 'scheduled',
  created_by uuid references public.profiles(id),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_programmes_event_time on public.programmes(event_id, start_time);

alter table public.programmes enable row level security;

drop policy if exists "Allow read access to programmes" on public.programmes;
create policy "Allow read access to programmes"
  on public.programmes for select using (true);

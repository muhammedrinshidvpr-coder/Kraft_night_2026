-- ==============================================================================
-- SANGAM — 11_programme_sync_security: shared schedule authority + recovery
-- Team LINX • Kraft Night 2026
-- UI mapping: js/tasks.js TaskManager (setActiveEvent, awaited writes, filtered
--             realtime), js/main.js programme sync notice + publishManagerSchedule
-- Run order: after ../schema.sql (+ 09/10). Deployed text-ID schema only.
--   Do NOT run alongside 00_init.sql..08_realtime.sql (alternate UUID schema).
-- UI->SQL rule: UI changes needing new programme columns/policies must STOP +
--   alert + ask permission before editing this file.
-- ==============================================================================
--
-- Problem: `schema.sql` grants public write on `public.programmes`, so
-- "manager-only" was browser-only and divergent local caches could masquerade
-- as shared data. This migration makes Supabase the authority:
--   1. public read stays (joined members see the schedule live);
--   2. insert/update/delete require the caller to manage THAT event;
--   3. one-time reconciliation uses a transactional RPC (all-or-nothing).
--
-- Deploy: Supabase Dashboard → SQL Editor → New Query → paste this file →
--   Run. Then verify Database → Replication → supabase_realtime includes
--   `programmes`.

-- 1. Replace public write with manager-of-that-event writes (read stays public).
alter table public.programmes enable row level security;

drop policy if exists "Programmes Public Write" on public.programmes;
drop policy if exists "Managers write own event programmes" on public.programmes;
drop policy if exists "Managers update own event programmes" on public.programmes;
drop policy if exists "Managers delete own event programmes" on public.programmes;

-- Public read (members need live read-only schedule).
drop policy if exists "Programmes Public Read" on public.programmes;
create policy "Programmes Public Read"
  on public.programmes for select using (true);

-- Manager of THAT event may insert rows for THAT event.
create policy "Managers write own event programmes"
  on public.programmes for insert
  with check (
    exists (
      select 1 from public.events
      where events.id = programmes.event_id
        and events.manager_id = auth.uid()::text
    )
  );

-- Manager of THAT event may update rows of THAT event.
create policy "Managers update own event programmes"
  on public.programmes for update
  using (
    exists (
      select 1 from public.events
      where events.id = programmes.event_id
        and events.manager_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.events
      where events.id = programmes.event_id
        and events.manager_id = auth.uid()::text
    )
  );

-- Manager of THAT event may delete rows of THAT event.
create policy "Managers delete own event programmes"
  on public.programmes for delete
  using (
    exists (
      select 1 from public.events
      where events.id = programmes.event_id
        and events.manager_id = auth.uid()::text
    )
  );

-- 2. Transactional one-time reconciliation: manager publishes a reviewed list.
-- Either the whole schedule is replaced or nothing changes. Never merges.
create or replace function public.replace_event_programmes(
  p_event_id text, p_programmes jsonb
) returns table (programme_id text, programme_title text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id text := auth.uid()::text;
  v_item jsonb;
  v_title text;
  v_start text;
  v_end text;
  v_venue text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_event_id is null or btrim(p_event_id) = '' then
    raise exception 'Event id is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_programmes, '[]'::jsonb)) <> 'array' then
    raise exception 'Programmes must be a JSON array.' using errcode = '22023';
  end if;
  -- Only the manager recorded on the event may reconcile it.
  if not exists (
    select 1 from public.events where id = p_event_id and manager_id = v_user_id
  ) then
    raise exception 'Only the event manager can publish the schedule.' using errcode = '42501';
  end if;

  -- All-or-nothing: lock the event row for the duration of the replacement.
  perform 1 from public.events where id = p_event_id for update;

  delete from public.programmes where event_id = p_event_id;

  for v_item in select value from jsonb_array_elements(p_programmes) loop
    v_title := btrim(coalesce(v_item ->> 'title', ''));
    if v_title = '' then
      raise exception 'Every programme needs a title.' using errcode = '22023';
    end if;
    v_start := nullif(btrim(coalesce(v_item ->> 'startTime', v_item ->> 'start_time', '10:00')), '');
    v_end := nullif(btrim(coalesce(v_item ->> 'endTime', v_item ->> 'end_time', '')), '');
    v_venue := coalesce(nullif(btrim(v_item ->> 'venue'), ''), 'Main Stage');
    v_status := coalesce(nullif(btrim(v_item ->> 'status'), ''), 'scheduled');
    if v_status not in ('scheduled', 'in_progress', 'completed', 'delayed') then
      v_status := 'scheduled';
    end if;
    insert into public.programmes (event_id, title, description, start_time, end_time, venue, status, lead_group, created_by)
    values (
      p_event_id,
      v_title,
      nullif(btrim(coalesce(v_item ->> 'description', '')), ''),
      coalesce(v_start, '10:00'),
      coalesce(v_end, v_start, '10:00'),
      v_venue,
      v_status,
      coalesce(nullif(btrim(v_item ->> 'leadGroup'), ''), 'General Coordination'),
      v_user_id
    );
  end loop;

  return query select id, title from public.programmes where event_id = p_event_id order by start_time asc;
end;
$$;

revoke all on function public.replace_event_programmes(text, jsonb) from public, anon;
grant execute on function public.replace_event_programmes(text, jsonb) to authenticated;

-- 3. Ensure realtime publication includes programmes (idempotent).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'programmes'
  ) then
    alter publication supabase_realtime add table public.programmes;
  end if;
end $$;

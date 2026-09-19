-- ==============================================================================
-- SANGAM - 09_ai_event_blueprints: deployed text-ID schema edition
-- ==============================================================================

create table if not exists public.ai_event_blueprints (
  id uuid default gen_random_uuid() primary key,
  manager_id text references public.profiles(id) on delete cascade not null,
  prompt text not null check (char_length(prompt) between 1 and 4000),
  blueprint jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'applied', 'failed')),
  applied_event_id text references public.events(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_ai_event_blueprints_manager_status on public.ai_event_blueprints(manager_id, status);
alter table public.ai_event_blueprints enable row level security;
drop policy if exists "Managers read own AI event blueprints" on public.ai_event_blueprints;
create policy "Managers read own AI event blueprints" on public.ai_event_blueprints for select using (auth.uid()::text = manager_id);

create table if not exists public.event_role_slots (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.events(id) on delete cascade not null,
  group_id text references public.event_groups(id) on delete set null,
  title text not null,
  responsibility text not null,
  assigned_member_id text references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_event_role_slots_event_id on public.event_role_slots(event_id);
alter table public.event_role_slots enable row level security;
drop policy if exists "Event members read role slots" on public.event_role_slots;
create policy "Event members read role slots" on public.event_role_slots for select using (
  exists (select 1 from public.event_members where event_id = event_role_slots.event_id and user_id = auth.uid()::text)
);

create or replace function public.apply_ai_event_blueprint(
  p_blueprint_id uuid, p_event_title text, p_venue text, p_groups jsonb, p_role_slots jsonb, p_programmes jsonb default '[]'::jsonb
) returns table (event_id text, event_title text, event_venue text, event_status text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id text := auth.uid()::text; v_manager_id text; v_status text; v_name text; v_email text;
  v_event_id text; v_code varchar(10); v_group_ids text[] := array[]::text[]; v_group_id text; v_item jsonb; v_index integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select full_name, email into v_name, v_email from public.profiles where id = v_user_id and role = 'manager';
  if v_name is null then raise exception 'Only event managers can apply AI blueprints.' using errcode = '42501'; end if;
  select manager_id, status into v_manager_id, v_status from public.ai_event_blueprints where id = p_blueprint_id for update;
  if not found or v_manager_id <> v_user_id or v_status <> 'draft' then raise exception 'Blueprint cannot be applied.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_event_title, ''))) not between 1 and 160 or char_length(btrim(coalesce(p_venue, ''))) not between 1 and 160 then raise exception 'Event title and venue are required.' using errcode = '22023'; end if;
  if jsonb_typeof(p_groups) <> 'array' or jsonb_typeof(p_role_slots) <> 'array' or jsonb_typeof(p_programmes) <> 'array' then raise exception 'Blueprint collections are invalid.' using errcode = '22023'; end if;
  loop
    v_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    begin
      insert into public.events (title, six_digit_code, venue, status, manager_id) values (btrim(p_event_title), v_code, btrim(p_venue), 'draft', v_user_id) returning id into v_event_id;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  insert into public.event_members (event_id, user_id, name, email, role, role_badge, group_name, status) values (v_event_id, v_user_id, v_name, v_email, 'manager', 'Event Manager', 'Unassigned', 'active');
  if jsonb_array_length(p_groups) > 0 then
    for v_index in 0..jsonb_array_length(p_groups) - 1 loop
      v_item := p_groups -> v_index;
      insert into public.event_groups (event_id, name, description, icon) values (v_event_id, btrim(v_item ->> 'name'), nullif(btrim(v_item ->> 'description'), ''), coalesce(nullif(btrim(v_item ->> 'icon'), ''), 'group')) returning id into v_group_id;
      v_group_ids := array_append(v_group_ids, v_group_id);
    end loop;
  end if;
  for v_item in select value from jsonb_array_elements(p_role_slots) loop
    v_group_id := null;
    if v_item ? 'groupIndex' then v_group_id := v_group_ids[(v_item ->> 'groupIndex')::integer + 1]; end if;
    insert into public.event_role_slots (event_id, group_id, title, responsibility) values (v_event_id, v_group_id, btrim(v_item ->> 'title'), btrim(v_item ->> 'responsibility'));
  end loop;
  for v_item in select value from jsonb_array_elements(p_programmes) loop
    insert into public.programmes (event_id, title, description, start_time, end_time, venue, status, created_by) values (v_event_id, btrim(v_item ->> 'title'), nullif(btrim(v_item ->> 'description'), ''), v_item ->> 'startTime', nullif(v_item ->> 'endTime', ''), coalesce(nullif(btrim(v_item ->> 'venueOrStage'), ''), 'Main Stage'), 'scheduled', v_user_id);
  end loop;
  update public.ai_event_blueprints set status = 'applied', applied_event_id = v_event_id, blueprint = jsonb_build_object('title', btrim(p_event_title), 'venue', btrim(p_venue), 'groups', p_groups, 'roleSlots', p_role_slots, 'programmes', p_programmes) where id = p_blueprint_id;
  return query select v_event_id, btrim(p_event_title), btrim(p_venue), 'draft'::text;
end;
$$;

revoke all on function public.apply_ai_event_blueprint(uuid, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.apply_ai_event_blueprint(uuid, text, text, jsonb, jsonb, jsonb) to authenticated;

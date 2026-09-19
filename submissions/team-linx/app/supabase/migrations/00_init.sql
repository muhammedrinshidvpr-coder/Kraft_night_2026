-- ==============================================================================
-- SANGAM — 00_init: extensions + shared enums
-- Team LINX • Kraft Night 2026
-- Run FIRST in Supabase SQL Editor before 01_* .. 08_*
-- ==============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Shared role enum used by event_members.role
do $$ begin
  create type event_role_type as enum ('manager', 'overseer', 'lead', 'volunteer');
exception
  when duplicate_object then null;
end $$;

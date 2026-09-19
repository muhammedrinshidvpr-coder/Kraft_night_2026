-- ==============================================================================
-- SANGAM — 06_chat_messages: in-app group chat
-- Team LINX • Kraft Night 2026
-- UI mapping: js/chat.js ChatManager (sendMessage, getMessages),
--             chat panel in index.html + style.css
-- Run order: after 03_event_groups.sql
-- UI->SQL rule: if UI adds message fields (reactions, reply_to,
--   edited_at, message_type), STOP + alert and ask permission before ALTER here.
-- ==============================================================================
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.event_groups(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  sender_name text not null,
  sender_role text default 'volunteer',
  message_text text not null,
  attachment_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_chat_messages_group on public.chat_messages(group_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Allow read chat messages" on public.chat_messages;
create policy "Allow read chat messages"
  on public.chat_messages for select using (true);

drop policy if exists "Allow insert chat messages" on public.chat_messages;
create policy "Allow insert chat messages"
  on public.chat_messages for insert with check (true);

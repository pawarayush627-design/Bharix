-- Run this in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  share_token text unique,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chats enable row level security;
create policy "Users can read their own chats" on public.chats for select using (auth.uid() = user_id);
create policy "Users can create their own chats" on public.chats for insert with check (auth.uid() = user_id);
create policy "Users can update their own chats" on public.chats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own chats" on public.chats for delete using (auth.uid() = user_id);

-- Public share links intentionally expose only chats where the owner explicitly enabled sharing.
create or replace function public.get_shared_chat(token text)
returns table (title text, messages jsonb, shared_at timestamptz)
language sql security definer set search_path = public
as $$
  select c.title, c.messages, c.shared_at
  from public.chats c
  where c.share_token = token and c.shared_at is not null
  limit 1;
$$;
revoke all on function public.get_shared_chat(text) from public;
grant execute on function public.get_shared_chat(text) to anon, authenticated;

-- Run once in Supabase SQL Editor.
-- This creates per-user synchronized state + file metadata and a private storage bucket.

create table if not exists public.dashboard_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_state enable row level security;
drop policy if exists "users read own dashboard state" on public.dashboard_state;
drop policy if exists "users insert own dashboard state" on public.dashboard_state;
drop policy if exists "users update own dashboard state" on public.dashboard_state;
create policy "users read own dashboard state" on public.dashboard_state for select using (auth.uid() = user_id);
create policy "users insert own dashboard state" on public.dashboard_state for insert with check (auth.uid() = user_id);
create policy "users update own dashboard state" on public.dashboard_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.dashboard_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null unique,
  size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

alter table public.dashboard_files enable row level security;
drop policy if exists "users read own file metadata" on public.dashboard_files;
drop policy if exists "users insert own file metadata" on public.dashboard_files;
drop policy if exists "users delete own file metadata" on public.dashboard_files;
create policy "users read own file metadata" on public.dashboard_files for select using (auth.uid() = user_id);
create policy "users insert own file metadata" on public.dashboard_files for insert with check (auth.uid() = user_id);
create policy "users delete own file metadata" on public.dashboard_files for delete using (auth.uid() = user_id);

insert into storage.buckets (id,name,public)
values ('application-files','application-files',false)
on conflict (id) do update set public=false;

drop policy if exists "users upload own application files" on storage.objects;
drop policy if exists "users read own application files" on storage.objects;
drop policy if exists "users delete own application files" on storage.objects;
create policy "users upload own application files" on storage.objects for insert to authenticated
with check (bucket_id='application-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users read own application files" on storage.objects for select to authenticated
using (bucket_id='application-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users delete own application files" on storage.objects for delete to authenticated
using (bucket_id='application-files' and (storage.foldername(name))[1]=auth.uid()::text);

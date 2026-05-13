-- Memory Calendar Supabase setup
-- Run this in Supabase SQL Editor after creating your project.

create extension if not exists pgcrypto;

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  photo_path text,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_calendar_entries_updated_at on public.calendar_entries;
create trigger set_calendar_entries_updated_at
before update on public.calendar_entries
for each row execute function public.set_updated_at();

alter table public.calendar_entries enable row level security;

create policy "Users can view own calendar entries"
on public.calendar_entries
for select
using ((select auth.uid()) = user_id);

create policy "Users can create own calendar entries"
on public.calendar_entries
for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update own calendar entries"
on public.calendar_entries
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own calendar entries"
on public.calendar_entries
for delete
using ((select auth.uid()) = user_id);

-- Storage setup
-- Create a PRIVATE storage bucket named: calendar-photos
-- You can create it in Storage > New bucket, or run this if allowed in your project:
insert into storage.buckets (id, name, public)
values ('calendar-photos', 'calendar-photos', false)
on conflict (id) do nothing;

-- Storage object policies.
-- Files must be stored under: user-id/YYYY-MM-DD/file-name
create policy "Users can view own calendar photos"
on storage.objects
for select
using (
  bucket_id = 'calendar-photos'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "Users can upload own calendar photos"
on storage.objects
for insert
with check (
  bucket_id = 'calendar-photos'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "Users can update own calendar photos"
on storage.objects
for update
using (
  bucket_id = 'calendar-photos'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'calendar-photos'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "Users can delete own calendar photos"
on storage.objects
for delete
using (
  bucket_id = 'calendar-photos'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

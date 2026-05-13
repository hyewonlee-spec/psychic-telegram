-- Memory Calendar — Venues module
-- Run this in Supabase SQL Editor after your original calendar schema.

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  venue_type text not null default 'cafe',
  status text not null default 'want_to_go',

  instagram_handle text,
  instagram_url text,

  notes text,
  rating int,
  visited_at date,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint venues_rating_check check (rating is null or rating between 1 and 5),
  constraint venues_status_check check (status in ('want_to_go', 'visited', 'not_interested')),
  constraint venues_type_check check (venue_type in ('cafe', 'restaurant', 'bar', 'bakery', 'dessert', 'other'))
);

alter table venues enable row level security;

drop policy if exists "Users can view own venues" on venues;
create policy "Users can view own venues"
on venues
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own venues" on venues;
create policy "Users can create own venues"
on venues
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own venues" on venues;
create policy "Users can update own venues"
on venues
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own venues" on venues;
create policy "Users can delete own venues"
on venues
for delete
using (auth.uid() = user_id);

create index if not exists venues_user_status_idx on venues(user_id, status);
create index if not exists venues_user_created_idx on venues(user_id, created_at desc);

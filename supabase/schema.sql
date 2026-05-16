-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Bugs table
create table if not exists bugs (
  id text primary key,
  title text not null,
  tester text not null default 'Unknown',
  device text default '—',
  page text default '—',
  severity text not null check (severity in ('critical', 'high', 'low')),
  category text,
  description text,
  created_at timestamptz default now()
);

-- Comments table
create table if not exists comments (
  id bigint generated always as identity primary key,
  bug_id text not null references bugs(id) on delete cascade,
  text text not null,
  author text,
  time text,
  created_at timestamptz default now()
);

-- Attachments table
create table if not exists attachments (
  id bigint generated always as identity primary key,
  bug_id text not null references bugs(id) on delete cascade,
  name text not null,
  note text,
  url text,
  type text,
  created_at timestamptz default now()
);

-- Open questions table
create table if not exists open_questions (
  id text primary key,
  text text not null,
  tester text not null
);

-- Enable RLS and restrict table access to authenticated users
alter table bugs enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table open_questions enable row level security;

drop policy if exists "Public read/write bugs" on bugs;
drop policy if exists "Public read/write comments" on comments;
drop policy if exists "Public read/write attachments" on attachments;
drop policy if exists "Public read/write open_questions" on open_questions;
drop policy if exists "Authenticated read/write bugs" on bugs;
drop policy if exists "Authenticated read/write comments" on comments;
drop policy if exists "Authenticated read/write attachments" on attachments;
drop policy if exists "Authenticated read/write open_questions" on open_questions;

create policy "Authenticated read/write bugs" on bugs for all to authenticated using (true) with check (true);
create policy "Authenticated read/write comments" on comments for all to authenticated using (true) with check (true);
create policy "Authenticated read/write attachments" on attachments for all to authenticated using (true) with check (true);
create policy "Authenticated read/write open_questions" on open_questions for all to authenticated using (true) with check (true);

-- Storage bucket for file uploads (public read, authenticated write/delete)
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict do nothing;

drop policy if exists "Public upload attachments" on storage.objects;
drop policy if exists "Public read attachments" on storage.objects;
drop policy if exists "Authenticated upload attachments" on storage.objects;
drop policy if exists "Authenticated delete attachments" on storage.objects;

create policy "Authenticated upload attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "Authenticated delete attachments" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments');

create policy "Public read attachments" on storage.objects
  for select
  using (bucket_id = 'attachments');

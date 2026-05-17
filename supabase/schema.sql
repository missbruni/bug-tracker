-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

create extension if not exists pgcrypto;

-- Organization and team model (single-company bootstrap)
create table if not exists organizations (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  created_by uuid,
  created_at timestamptz default now(),
  unique (organization_id, slug)
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('team_admin', 'member')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz default now(),
  unique (team_id, user_id)
);

insert into organizations (id, name)
values ('theaccessgroup', 'The Access Group')
on conflict (id) do nothing;

insert into teams (id, organization_id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'theaccessgroup', 'EVO IBE', 'evo-ibe')
on conflict (id) do update
set organization_id = excluded.organization_id,
    name = excluded.name,
    slug = excluded.slug;

-- Bugs table
create table if not exists bugs (
  id text primary key,
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
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
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
  bug_id text not null references bugs(id) on delete cascade,
  text text not null,
  author text,
  time text,
  created_at timestamptz default now()
);

-- Attachments table
create table if not exists attachments (
  id bigint generated always as identity primary key,
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
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
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
  text text not null,
  tester text not null
);

-- Enable RLS and restrict table access to authenticated users
alter table organizations enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table bugs enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table open_questions enable row level security;

drop policy if exists "Authenticated read/write organizations" on organizations;
drop policy if exists "Authenticated read/write teams" on teams;
drop policy if exists "Authenticated read/write team_members" on team_members;
drop policy if exists "Public read/write bugs" on bugs;
drop policy if exists "Public read/write comments" on comments;
drop policy if exists "Public read/write attachments" on attachments;
drop policy if exists "Public read/write open_questions" on open_questions;
drop policy if exists "Authenticated read/write bugs" on bugs;
drop policy if exists "Authenticated read/write comments" on comments;
drop policy if exists "Authenticated read/write attachments" on attachments;
drop policy if exists "Authenticated read/write open_questions" on open_questions;

create policy "Authenticated read/write organizations" on organizations for all to authenticated using (true) with check (true);
create policy "Authenticated read/write teams" on teams for all to authenticated using (true) with check (true);
create policy "Authenticated read/write team_members" on team_members for all to authenticated using (true) with check (true);
create policy "Authenticated read/write bugs" on bugs for all to authenticated using (true) with check (true);
create policy "Authenticated read/write comments" on comments for all to authenticated using (true) with check (true);
create policy "Authenticated read/write attachments" on attachments for all to authenticated using (true) with check (true);
create policy "Authenticated read/write open_questions" on open_questions for all to authenticated using (true) with check (true);

create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_bugs_team_id on bugs(team_id);
create index if not exists idx_comments_team_id on comments(team_id);
create index if not exists idx_attachments_team_id on attachments(team_id);
create index if not exists idx_open_questions_team_id on open_questions(team_id);

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

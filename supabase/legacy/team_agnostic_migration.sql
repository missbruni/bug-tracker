-- Team-agnostic migration (single company bootstrap: theaccessgroup)
-- Run this after existing schema/scripts to migrate current data into team-aware ownership.

create extension if not exists pgcrypto;

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

alter table bugs add column if not exists team_id uuid;
alter table comments add column if not exists team_id uuid;
alter table attachments add column if not exists team_id uuid;
alter table open_questions add column if not exists team_id uuid;
alter table testers add column if not exists team_id uuid;
alter table sessions add column if not exists team_id uuid;
alter table scenarios add column if not exists team_id uuid;
alter table assignments add column if not exists team_id uuid;
alter table session_feedback add column if not exists team_id uuid;

update bugs
set team_id = coalesce(team_id, '11111111-1111-1111-1111-111111111111');

update comments c
set team_id = coalesce(c.team_id, b.team_id, '11111111-1111-1111-1111-111111111111')
from bugs b
where c.bug_id = b.id;

update attachments a
set team_id = coalesce(a.team_id, b.team_id, '11111111-1111-1111-1111-111111111111')
from bugs b
where a.bug_id = b.id;

update open_questions
set team_id = coalesce(team_id, '11111111-1111-1111-1111-111111111111');

update testers
set team_id = coalesce(team_id, '11111111-1111-1111-1111-111111111111');

update sessions
set team_id = coalesce(team_id, '11111111-1111-1111-1111-111111111111');

update scenarios s
set team_id = coalesce(s.team_id, sess.team_id, '11111111-1111-1111-1111-111111111111')
from sessions sess
where s.session_id = sess.id;

update assignments a
set team_id = coalesce(a.team_id, sess.team_id, '11111111-1111-1111-1111-111111111111')
from sessions sess
where a.session_id = sess.id;

update session_feedback sf
set team_id = coalesce(sf.team_id, sess.team_id, '11111111-1111-1111-1111-111111111111')
from sessions sess
where sf.session_id = sess.id;

alter table bugs alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table comments alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table attachments alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table open_questions alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table testers alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table sessions alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table scenarios alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table assignments alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table session_feedback alter column team_id set default '11111111-1111-1111-1111-111111111111';

alter table bugs alter column team_id set not null;
alter table comments alter column team_id set not null;
alter table attachments alter column team_id set not null;
alter table open_questions alter column team_id set not null;
alter table testers alter column team_id set not null;
alter table sessions alter column team_id set not null;
alter table scenarios alter column team_id set not null;
alter table assignments alter column team_id set not null;
alter table session_feedback alter column team_id set not null;

create index if not exists idx_bugs_team_id on bugs(team_id);
create index if not exists idx_comments_team_id on comments(team_id);
create index if not exists idx_attachments_team_id on attachments(team_id);
create index if not exists idx_open_questions_team_id on open_questions(team_id);
create index if not exists idx_testers_team_id on testers(team_id);
create index if not exists idx_sessions_team_id on sessions(team_id);
create index if not exists idx_scenarios_team_id on scenarios(team_id);
create index if not exists idx_assignments_team_id on assignments(team_id);
create index if not exists idx_session_feedback_team_id on session_feedback(team_id);
create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_team_members_user on team_members(user_id);

-- Enable RLS on new tables
alter table organizations enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;

-- Team-scoped RLS policies are defined in team_scoped_policies.sql

-- Products per team
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz default now(),
  unique (team_id, slug)
);

alter table sessions add column if not exists product_id uuid references products(id) on delete set null;

create index if not exists idx_products_team_id on products(team_id);
create index if not exists idx_sessions_product_id on sessions(product_id);

alter table products enable row level security;

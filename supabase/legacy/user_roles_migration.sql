-- Migration: Set up user roles for Microsoft-authenticated users
-- Bruna = app owner (god mode) + team_admin for EVO IBE
-- All other testers = members of EVO IBE
--
-- Run this AFTER link_users_migration.sql has been applied and users have logged in
-- (so auth.users records exist via the auto-link trigger).

-- Step 1: Add app_owners table for god-mode users
create table if not exists app_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table app_owners enable row level security;

drop policy if exists "Authenticated read app_owners" on app_owners;
create policy "Authenticated read app_owners" on app_owners
  for select to authenticated using (true);

-- Step 2: Insert Bruna as app owner (god mode)
-- Replace the subquery email if needed
insert into app_owners (user_id)
select id from auth.users where lower(email) = 'bruna.lima@theaccessgroup.com'
on conflict (user_id) do nothing;

-- Step 3: Insert Bruna as team_admin for EVO IBE
insert into team_members (team_id, user_id, role, status)
select '11111111-1111-1111-1111-111111111111', id, 'team_admin', 'active'
from auth.users where lower(email) = 'bruna.lima@theaccessgroup.com'
on conflict (team_id, user_id) do update set role = 'team_admin', status = 'active';

-- Step 4: Insert all other testers as members of EVO IBE
insert into team_members (team_id, user_id, role, status)
select '11111111-1111-1111-1111-111111111111', id, 'member', 'active'
from auth.users
where lower(email) in (
  'ayaz.shaikh@theaccessgroup.com',
  'bojan.tasevski@theaccessgroup.com',
  'darshita.bhalala@theaccessgroup.com',
  'dayang.dai@theaccessgroup.com',
  'denisa.buftea@theaccessgroup.com',
  'ionut.nistor@theaccessgroup.com',
  'jigar.vadiwala@theaccessgroup.com',
  'leo.costa@theaccessgroup.com',
  'mateusz.kolasa@theaccessgroup.com',
  'oliwia.szwon@theaccessgroup.com',
  'ricardo.agullo@theaccessgroup.com',
  'robert.ventura@theaccessgroup.com',
  'tomasz.siwiec@theaccessgroup.com'
)
on conflict (team_id, user_id) do update set role = 'member', status = 'active';

-- Verify
-- SELECT au.email, tm.role, tm.status,
--        CASE WHEN ao.user_id IS NOT NULL THEN 'YES' ELSE 'no' END as is_owner
-- FROM team_members tm
-- JOIN auth.users au ON au.id = tm.user_id
-- LEFT JOIN app_owners ao ON ao.user_id = tm.user_id
-- WHERE tm.team_id = '11111111-1111-1111-1111-111111111111'
-- ORDER BY tm.role, au.email;

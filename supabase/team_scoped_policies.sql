-- Team-scoped RLS policies migration
-- Replaces wide-open using(true) policies with role-based team membership checks.
--
-- Permission model:
--   Owner (app_owners)  → full access to everything
--   Team admin          → full CRUD on own team data + team/member management
--   Team member         → full CRUD on own team data only
--
-- Run this in Supabase SQL Editor BEFORE deploying the frontend changes
-- that remove PIN auth (which was the only anon-access path).
--
-- Idempotent: safe to re-run.

-- ============================================================
-- 1. Helper functions (SECURITY DEFINER so they can read app_owners)
-- ============================================================

create or replace function is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_owners where user_id = auth.uid()
  );
$$;

create or replace function is_team_member(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = _team_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function is_team_admin_or_owner(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_app_owner() or exists (
    select 1 from team_members
    where team_id = _team_id
      and user_id = auth.uid()
      and role = 'team_admin'
      and status = 'active'
  );
$$;

-- ============================================================
-- 2. Auto-assign creator as team_admin on team creation
-- ============================================================

create or replace function assign_team_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into team_members (team_id, user_id, role, status)
  values (new.id, auth.uid(), 'team_admin', 'active')
  on conflict (team_id, user_id) do update
    set role = 'team_admin', status = 'active';
  return new;
exception when others then
  raise warning 'assign_team_creator failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_assign_team_creator on teams;
create trigger trg_assign_team_creator
  after insert on teams
  for each row
  execute function assign_team_creator();

-- ============================================================
-- 3. organizations — read-only for all authenticated
-- ============================================================

drop policy if exists "Public read/write organizations" on organizations;
drop policy if exists "Authenticated read/write organizations" on organizations;
drop policy if exists "Authenticated read organizations" on organizations;

create policy "Authenticated read organizations" on organizations
  for select to authenticated
  using (true);

-- ============================================================
-- 4. teams — anyone can SELECT/INSERT, only admin/owner can UPDATE/DELETE
-- ============================================================

drop policy if exists "Public read/write teams" on teams;
drop policy if exists "Authenticated read/write teams" on teams;
drop policy if exists "Authenticated select teams" on teams;
drop policy if exists "Authenticated insert teams" on teams;
drop policy if exists "Admin or owner update teams" on teams;
drop policy if exists "Admin or owner delete teams" on teams;

create policy "Authenticated select teams" on teams
  for select to authenticated
  using (true);

create policy "Authenticated insert teams" on teams
  for insert to authenticated
  with check (true);

create policy "Admin or owner update teams" on teams
  for update to authenticated
  using (is_team_admin_or_owner(id));

create policy "Admin or owner delete teams" on teams
  for delete to authenticated
  using (is_team_admin_or_owner(id));

-- ============================================================
-- 5. team_members — members see own team, admin/owner manage
-- ============================================================

drop policy if exists "Public read/write team_members" on team_members;
drop policy if exists "Authenticated read/write team_members" on team_members;
drop policy if exists "Team member select own team" on team_members;
drop policy if exists "Admin or owner manage members" on team_members;

create policy "Team member select own team" on team_members
  for select to authenticated
  using (
    is_app_owner()
    or team_id in (
      select tm.team_id from team_members tm
      where tm.user_id = auth.uid() and tm.status = 'active'
    )
  );

create policy "Admin or owner manage members" on team_members
  for insert to authenticated
  with check (is_team_admin_or_owner(team_id));

create policy "Admin or owner update members" on team_members
  for update to authenticated
  using (is_team_admin_or_owner(team_id));

create policy "Admin or owner delete members" on team_members
  for delete to authenticated
  using (is_team_admin_or_owner(team_id));

-- ============================================================
-- 6. Data tables — owner or team member has full CRUD
-- ============================================================

-- bugs
drop policy if exists "Public read/write bugs" on bugs;
drop policy if exists "Authenticated read/write bugs" on bugs;
drop policy if exists "Team scoped bugs" on bugs;

create policy "Team scoped bugs" on bugs
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- comments
drop policy if exists "Public read/write comments" on comments;
drop policy if exists "Authenticated read/write comments" on comments;
drop policy if exists "Team scoped comments" on comments;

create policy "Team scoped comments" on comments
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- attachments
drop policy if exists "Public read/write attachments" on attachments;
drop policy if exists "Authenticated read/write attachments" on attachments;
drop policy if exists "Team scoped attachments" on attachments;

create policy "Team scoped attachments" on attachments
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- open_questions
drop policy if exists "Public read/write open_questions" on open_questions;
drop policy if exists "Authenticated read/write open_questions" on open_questions;
drop policy if exists "Team scoped open_questions" on open_questions;

create policy "Team scoped open_questions" on open_questions
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- testers
drop policy if exists "Public read/write testers" on testers;
drop policy if exists "Authenticated read/write testers" on testers;
drop policy if exists "Team scoped testers" on testers;

create policy "Team scoped testers" on testers
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- sessions
drop policy if exists "Public read/write sessions" on sessions;
drop policy if exists "Authenticated read/write sessions" on sessions;
drop policy if exists "Team scoped sessions" on sessions;

create policy "Team scoped sessions" on sessions
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- scenarios
drop policy if exists "Public read/write scenarios" on scenarios;
drop policy if exists "Authenticated read/write scenarios" on scenarios;
drop policy if exists "Team scoped scenarios" on scenarios;

create policy "Team scoped scenarios" on scenarios
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- assignments
drop policy if exists "Public read/write assignments" on assignments;
drop policy if exists "Authenticated read/write assignments" on assignments;
drop policy if exists "Team scoped assignments" on assignments;

create policy "Team scoped assignments" on assignments
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- session_feedback
drop policy if exists "Public read/write session_feedback" on session_feedback;
drop policy if exists "Authenticated read/write session_feedback" on session_feedback;
drop policy if exists "Team scoped session_feedback" on session_feedback;

create policy "Team scoped session_feedback" on session_feedback
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- products
drop policy if exists "Public read/write products" on products;
drop policy if exists "Authenticated read/write products" on products;
drop policy if exists "Team scoped products" on products;

create policy "Team scoped products" on products
  for all to authenticated
  using (is_app_owner() or is_team_member(team_id))
  with check (is_app_owner() or is_team_member(team_id));

-- ============================================================
-- 7. app_owners — read-only for authenticated (already exists, ensure it's set)
-- ============================================================

drop policy if exists "Authenticated read app_owners" on app_owners;

create policy "Authenticated read app_owners" on app_owners
  for select to authenticated
  using (true);

-- ============================================================
-- 8. Storage — keep authenticated upload/delete, public read
-- ============================================================

drop policy if exists "Public upload attachments" on storage.objects;
drop policy if exists "Public delete attachments" on storage.objects;
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

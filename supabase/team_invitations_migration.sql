-- Migration: team_invitations table + RLS policies + auto-accept trigger
--
-- Allows team admins to invite external users by email.
-- When the invited user signs in via Microsoft OAuth, a trigger
-- automatically adds them to the team and marks the invitation accepted.
--
-- Idempotent: safe to re-run.

-- ============================================================
-- 1. Create the table (skip if already created via dashboard)
-- ============================================================

create table if not exists team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('team_admin', 'member')),
  invited_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz default now(),
  unique (team_id, email)
);

create index if not exists idx_team_invitations_team on team_invitations(team_id);
create index if not exists idx_team_invitations_email on team_invitations(email);

-- ============================================================
-- 2. Enable RLS (skip if already enabled via dashboard button)
-- ============================================================

alter table team_invitations enable row level security;

-- ============================================================
-- 3. RLS policies — mirrors team_members pattern
-- ============================================================

drop policy if exists "Team member select invitations" on team_invitations;
create policy "Team member select invitations" on team_invitations
  for select to authenticated
  using (
    is_app_owner()
    or is_team_member(team_id)
  );

drop policy if exists "Admin or owner insert invitations" on team_invitations;
create policy "Admin or owner insert invitations" on team_invitations
  for insert to authenticated
  with check (is_team_admin_or_owner(team_id));

drop policy if exists "Admin or owner update invitations" on team_invitations;
create policy "Admin or owner update invitations" on team_invitations
  for update to authenticated
  using (is_team_admin_or_owner(team_id));

drop policy if exists "Admin or owner delete invitations" on team_invitations;
create policy "Admin or owner delete invitations" on team_invitations
  for delete to authenticated
  using (is_team_admin_or_owner(team_id));

-- ============================================================
-- 4. Auto-accept trigger: when a new user signs in and has
--    pending invitations, add them to the team automatically.
-- ============================================================

create or replace function accept_pending_invitations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  for inv in
    select id, team_id, role
    from team_invitations
    where lower(email) = lower(new.email)
      and status = 'pending'
  loop
    insert into team_members (team_id, user_id, role, status)
    values (inv.team_id, new.id, inv.role, 'active')
    on conflict (team_id, user_id) do update
      set role = excluded.role, status = 'active';

    update team_invitations
    set status = 'accepted'
    where id = inv.id;
  end loop;

  return new;
exception when others then
  raise warning 'accept_pending_invitations failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_accept_pending_invitations on auth.users;
create trigger trg_accept_pending_invitations
  after insert or update on auth.users
  for each row
  execute function accept_pending_invitations();

-- ============================================================
-- Verify (uncomment to check):
-- ============================================================
-- SELECT * FROM team_invitations ORDER BY created_at DESC;

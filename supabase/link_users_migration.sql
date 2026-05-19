-- Migration: Auto-link PIN-auth testers to Microsoft accounts on first login
--
-- How it works:
--   1. Pre-populate a mapping table with tester name → Microsoft email
--   2. A trigger fires every time a Microsoft user logs in
--   3. If their email matches a mapping, the tester record is auto-linked
--   4. Once all PIN users have logged in, drop the trigger + mapping table
--
-- Run Steps 1-4 in Supabase SQL Editor. Step 5 is cleanup for later.

-- Step 1: Add user_id column to testers table
alter table testers
add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_testers_user_id on testers(user_id);

-- Step 2: Create persistent mapping table (tester name → Microsoft email)
create table if not exists tester_email_mapping (
  tester_name text primary key,
  microsoft_email text not null unique
);

-- Step 3: Insert your known mappings
insert into tester_email_mapping (tester_name, microsoft_email) values
  ('Ayaz Shaikh',      'ayaz.shaikh@theaccessgroup.com'),
  ('Bojan Tasevski',   'bojan.tasevski@theaccessgroup.com'),
  ('Bruna Lima',       'bruna.lima@theaccessgroup.com'),
  ('Darshita Bhalala', 'darshita.bhalala@theaccessgroup.com'),
  ('Dayang Dai',       'dayang.dai@theaccessgroup.com'),
  ('Denisa Buftea',    'denisa.buftea@theaccessgroup.com'),
  ('Ionut Nistor',     'ionut.nistor@theaccessgroup.com'),
  ('Jigar Vadiwala',   'jigar.vadiwala@theaccessgroup.com'),
  ('Leo Costa',        'leo.costa@theaccessgroup.com'),
  ('Mateusz Kolasa',   'mateusz.kolasa@theaccessgroup.com'),
  ('Oliwia Szwon',     'oliwia.szwon@theaccessgroup.com'),
  ('Ricardo Agullo',   'ricardo.agullo@theaccessgroup.com'),
  ('Robert Ventura',   'robert.ventura@theaccessgroup.com'),
  ('Tomasz Siwiec',    'tomasz.siwiec@theaccessgroup.com')
on conflict (tester_name) do update set microsoft_email = excluded.microsoft_email;

-- Step 4: Create trigger function that auto-links on login
-- Uses public.* qualified names so it works from auth schema context
-- Wrapped in exception handler so it NEVER blocks login
create or replace function link_tester_on_login()
returns trigger as $$
begin
  update public.testers t
  set user_id = new.id
  from public.tester_email_mapping tem
  where lower(tem.microsoft_email) = lower(new.email)
    and lower(t.name) = lower(tem.tester_name)
    and t.user_id is null;
  return new;
exception when others then
  raise warning 'link_tester_on_login failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- Fire on both INSERT (first login) and UPDATE (subsequent logins refresh the record)
drop trigger if exists trg_link_tester_on_login on auth.users;
create trigger trg_link_tester_on_login
  after insert or update on auth.users
  for each row
  execute function link_tester_on_login();

-- Verify: Check which testers have been linked so far
-- SELECT t.name, t.user_id, au.email
-- FROM testers t
-- JOIN auth.users au ON t.user_id = au.id;

-- Check which testers are still unlinked
-- SELECT t.name, tem.microsoft_email
-- FROM tester_email_mapping tem
-- LEFT JOIN testers t ON lower(t.name) = lower(tem.tester_name)
-- WHERE t.user_id IS NULL;

-- Step 5: CLEANUP (run this once ALL PIN users have logged in via Microsoft)
-- drop trigger trg_link_tester_on_login on auth.users;
-- drop function link_tester_on_login();
-- drop table tester_email_mapping;

-- Temporary rollback for PIN-only access while Microsoft tenant approval is pending.
-- Run this once in Supabase SQL Editor.
--
-- This restores public (anon + authenticated) read/write access patterns
-- so users behind the frontend PIN gate can use the app like before.
--
-- IMPORTANT: when Entra access is approved, run `supabase/authenticated_policies.sql`
-- to switch back to authenticated-only access.

-- Base bug tracker tables
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

create policy "Public read/write bugs" on bugs
  for all
  using (true)
  with check (true);

create policy "Public read/write comments" on comments
  for all
  using (true)
  with check (true);

create policy "Public read/write attachments" on attachments
  for all
  using (true)
  with check (true);

create policy "Public read/write open_questions" on open_questions
  for all
  using (true)
  with check (true);

-- Testing sessions tables
alter table testers enable row level security;
alter table sessions enable row level security;
alter table scenarios enable row level security;
alter table assignments enable row level security;
alter table session_feedback enable row level security;

drop policy if exists "Public read/write testers" on testers;
drop policy if exists "Public read/write sessions" on sessions;
drop policy if exists "Public read/write scenarios" on scenarios;
drop policy if exists "Public read/write assignments" on assignments;
drop policy if exists "Public read/write session_feedback" on session_feedback;
drop policy if exists "Authenticated read/write testers" on testers;
drop policy if exists "Authenticated read/write sessions" on sessions;
drop policy if exists "Authenticated read/write scenarios" on scenarios;
drop policy if exists "Authenticated read/write assignments" on assignments;
drop policy if exists "Authenticated read/write session_feedback" on session_feedback;

create policy "Public read/write testers" on testers
  for all
  using (true)
  with check (true);

create policy "Public read/write sessions" on sessions
  for all
  using (true)
  with check (true);

create policy "Public read/write scenarios" on scenarios
  for all
  using (true)
  with check (true);

create policy "Public read/write assignments" on assignments
  for all
  using (true)
  with check (true);

create policy "Public read/write session_feedback" on session_feedback
  for all
  using (true)
  with check (true);

-- Storage policies for attachments bucket
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public upload attachments" on storage.objects;
drop policy if exists "Public delete attachments" on storage.objects;
drop policy if exists "Public read attachments" on storage.objects;
drop policy if exists "Authenticated upload attachments" on storage.objects;
drop policy if exists "Authenticated delete attachments" on storage.objects;

create policy "Public upload attachments" on storage.objects
  for insert
  with check (bucket_id = 'attachments');

create policy "Public read attachments" on storage.objects
  for select
  using (bucket_id = 'attachments');

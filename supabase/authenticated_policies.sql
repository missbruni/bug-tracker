-- Run this in Supabase SQL Editor to migrate an existing project from public access to authenticated-only access.
-- Keep attachments publicly readable while requiring authenticated users for upload/delete.

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

create policy "Authenticated read/write bugs" on bugs
  for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated read/write comments" on comments
  for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated read/write attachments" on attachments
  for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated read/write open_questions" on open_questions
  for all to authenticated
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

create policy "Authenticated read/write testers" on testers
  for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated read/write sessions" on sessions
  for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated read/write scenarios" on scenarios
  for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated read/write assignments" on assignments
  for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated read/write session_feedback" on session_feedback
  for all to authenticated
  using (true)
  with check (true);

-- Storage policies for attachments bucket
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict do nothing;

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

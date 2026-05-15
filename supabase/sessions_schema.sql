-- Testing Sessions feature — run after schema.sql

-- Testers table
create table if not exists testers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  devices text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Sessions table
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at timestamptz default now()
);

-- Scenarios table
create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  letter text not null,
  title text not null,
  description text,
  device_requirement text,
  sort_order int not null default 0
);

-- Assignments table
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  tester_id uuid not null references testers(id) on delete cascade,
  unique (session_id, scenario_id)
);

-- Link bugs to sessions
alter table bugs add column if not exists session_id uuid references sessions(id) on delete set null;

-- Session feedback (anonymous surveys)
create table if not exists session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  length_feel text not null check (length_feel in ('too_short', 'just_right', 'too_long')),
  clarity int not null check (clarity between 1 and 5),
  helpfulness text not null check (helpfulness in ('not_at_all', 'somewhat', 'very')),
  worked_well text,
  to_improve text,
  created_at timestamptz default now()
);

-- Enable RLS with public access (matches existing pattern)
alter table testers enable row level security;
alter table sessions enable row level security;
alter table scenarios enable row level security;
alter table assignments enable row level security;

create policy "Public read/write testers" on testers for all using (true) with check (true);
create policy "Public read/write sessions" on sessions for all using (true) with check (true);
create policy "Public read/write scenarios" on scenarios for all using (true) with check (true);
create policy "Public read/write assignments" on assignments for all using (true) with check (true);
create policy "Public read/write session_feedback" on session_feedback for all using (true) with check (true);

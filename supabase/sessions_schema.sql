-- Testing Sessions feature — run after schema.sql

-- Testers table
create table if not exists testers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
  name text not null,
  devices text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Sessions table
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
  name text not null,
  date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at timestamptz default now()
);

-- Scenarios table
create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
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
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
  session_id uuid not null references sessions(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  tester_id uuid not null references testers(id) on delete cascade,
  unique (session_id, scenario_id)
);

-- Link bugs to real testers (prevents deleting testers with bug history)
alter table bugs add column if not exists tester_id uuid references testers(id) on delete restrict;
create index if not exists idx_bugs_tester_id on bugs(tester_id);

alter table bugs add column if not exists team_id uuid references teams(id);
update bugs set team_id = '11111111-1111-1111-1111-111111111111' where team_id is null;
alter table bugs alter column team_id set default '11111111-1111-1111-1111-111111111111';
alter table bugs alter column team_id set not null;

-- Backfill tester_id from existing plain-text tester names
with tester_name_map as (
  select distinct on (lower(name)) id, lower(name) as lname
  from testers
  order by lower(name), created_at asc
)
update bugs b
set tester_id = tnm.id
from tester_name_map tnm
where b.tester_id is null
  and lower(b.tester) = tnm.lname;

-- Link bugs to sessions
alter table bugs add column if not exists session_id uuid references sessions(id) on delete set null;

-- Session feedback (anonymous surveys)
create table if not exists session_feedback (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null default '11111111-1111-1111-1111-111111111111' references teams(id),
  session_id uuid not null references sessions(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  length_feel text not null check (length_feel in ('too_short', 'just_right', 'too_long')),
  clarity int not null check (clarity between 1 and 5),
  helpfulness text not null check (helpfulness in ('not_at_all', 'somewhat', 'very')),
  worked_well text,
  to_improve text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table testers enable row level security;
alter table sessions enable row level security;
alter table scenarios enable row level security;
alter table assignments enable row level security;
alter table session_feedback enable row level security;

-- Team-scoped RLS policies are defined in team_scoped_policies.sql

create index if not exists idx_testers_team_id on testers(team_id);
create index if not exists idx_sessions_team_id on sessions(team_id);
create index if not exists idx_scenarios_team_id on scenarios(team_id);
create index if not exists idx_assignments_team_id on assignments(team_id);
create index if not exists idx_session_feedback_team_id on session_feedback(team_id);

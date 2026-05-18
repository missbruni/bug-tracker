-- Add duration tracking to sessions
alter table sessions add column if not exists duration_seconds int;

-- Seed 45 min (2700s) into the existing session
update sessions set duration_seconds = 2700;

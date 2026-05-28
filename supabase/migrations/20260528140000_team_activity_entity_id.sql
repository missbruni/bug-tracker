-- Track which entity an activity row refers to so the UI can render links
-- (e.g. session_created → /sessions/<entity_id>). Nullable: many actions
-- (team renames, settings changes) carry no separately-addressable entity.
ALTER TABLE public.team_activity
  ADD COLUMN IF NOT EXISTS entity_id text;

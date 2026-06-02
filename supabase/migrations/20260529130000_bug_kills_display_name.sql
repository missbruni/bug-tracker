-- Add display_name to bug_kills for leaderboard rendering
-- Also update the increment RPC to accept and store a display name

ALTER TABLE public.bug_kills
  ADD COLUMN IF NOT EXISTS display_name text;

-- Replace RPC to include display_name upsert
CREATE OR REPLACE FUNCTION public.increment_bug_kills(
  p_team_id uuid,
  p_user_id uuid,
  p_count integer DEFAULT 1,
  p_display_name text DEFAULT NULL
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  INSERT INTO public.bug_kills (team_id, user_id, kill_count, display_name, last_updated)
  VALUES (p_team_id, p_user_id, p_count, p_display_name, now())
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET
    kill_count    = bug_kills.kill_count + EXCLUDED.kill_count,
    display_name  = COALESCE(EXCLUDED.display_name, bug_kills.display_name),
    last_updated  = now();
$$;

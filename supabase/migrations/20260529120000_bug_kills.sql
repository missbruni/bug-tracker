-- Bug kill leaderboard: tracks how many crawling bugs each user has squashed

CREATE TABLE IF NOT EXISTS public.bug_kills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kill_count integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX idx_bug_kills_team ON public.bug_kills (team_id);

ALTER TABLE public.bug_kills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team scoped bug_kills"
  ON public.bug_kills
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

GRANT ALL ON TABLE public.bug_kills TO anon;
GRANT ALL ON TABLE public.bug_kills TO authenticated;
GRANT ALL ON TABLE public.bug_kills TO service_role;

GRANT ALL ON SEQUENCE public.bug_kills_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bug_kills_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bug_kills_id_seq TO service_role;

-- RPC to atomically increment kill count (upsert)
CREATE OR REPLACE FUNCTION public.increment_bug_kills(
  p_team_id uuid,
  p_user_id uuid,
  p_count integer DEFAULT 1
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  INSERT INTO public.bug_kills (team_id, user_id, kill_count, last_updated)
  VALUES (p_team_id, p_user_id, p_count, now())
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET
    kill_count = bug_kills.kill_count + EXCLUDED.kill_count,
    last_updated = now();
$$;

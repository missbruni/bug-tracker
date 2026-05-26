-- Bug activity feed: lightweight audit log via trigger

-- Table
CREATE TABLE IF NOT EXISTS public.bug_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bug_id text NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  team_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111'::uuid,
  action text NOT NULL,
  description text NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bug_activity_team_created ON public.bug_activity (team_id, created_at DESC);
CREATE INDEX idx_bug_activity_bug_created ON public.bug_activity (bug_id, created_at DESC);

-- RLS
ALTER TABLE public.bug_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team scoped bug_activity"
  ON public.bug_activity
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

-- Grants
GRANT ALL ON TABLE public.bug_activity TO anon;
GRANT ALL ON TABLE public.bug_activity TO authenticated;
GRANT ALL ON TABLE public.bug_activity TO service_role;

GRANT ALL ON SEQUENCE public.bug_activity_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bug_activity_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bug_activity_id_seq TO service_role;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bug_activity;

-- Trigger function for bugs table
CREATE OR REPLACE FUNCTION public.log_bug_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  change_action text;
  change_desc text;
  actor_name text;
begin
  -- Try to resolve a display name for the current user
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  ) into actor_name
  from auth.users
  where id = auth.uid();

  if TG_OP = 'INSERT' then
    insert into public.bug_activity (bug_id, team_id, action, description, actor)
    values (
      new.id,
      new.team_id,
      'created',
      format('Created bug %s "%s" (%s)', new.id, new.title, new.severity),
      coalesce(actor_name, new.tester, 'System')
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    -- Severity changed
    if old.severity IS DISTINCT FROM new.severity then
      insert into public.bug_activity (bug_id, team_id, action, description, actor)
      values (
        new.id, new.team_id, 'severity_changed',
        format('Severity changed from %s to %s', old.severity, new.severity),
        coalesce(actor_name, 'System')
      );
    end if;

    -- Reviewed / completed
    if old.reviewed IS DISTINCT FROM new.reviewed then
      if new.reviewed then
        change_action := 'reviewed';
        change_desc := format('Marked %s as completed', new.id);
      else
        change_action := 'reopened';
        change_desc := format('Reopened %s', new.id);
      end if;
      insert into public.bug_activity (bug_id, team_id, action, description, actor)
      values (new.id, new.team_id, change_action, change_desc, coalesce(actor_name, 'System'));
    end if;

    -- Title changed
    if old.title IS DISTINCT FROM new.title then
      insert into public.bug_activity (bug_id, team_id, action, description, actor)
      values (
        new.id, new.team_id, 'edited',
        format('Title changed to "%s"', new.title),
        coalesce(actor_name, 'System')
      );
    end if;

    -- Description changed
    if old.description IS DISTINCT FROM new.description then
      insert into public.bug_activity (bug_id, team_id, action, description, actor)
      values (
        new.id, new.team_id, 'edited',
        'Description updated',
        coalesce(actor_name, 'System')
      );
    end if;

    -- Tester changed
    if old.tester IS DISTINCT FROM new.tester then
      insert into public.bug_activity (bug_id, team_id, action, description, actor)
      values (
        new.id, new.team_id, 'edited',
        format('Tester changed from %s to %s', old.tester, new.tester),
        coalesce(actor_name, 'System')
      );
    end if;

    -- Published to backlog
    if (old.backlog_url IS NULL OR old.backlog_url = '') AND new.backlog_url IS NOT NULL AND new.backlog_url <> '' then
      insert into public.bug_activity (bug_id, team_id, action, description, actor)
      values (
        new.id, new.team_id, 'published',
        format('Published %s to backlog', new.id),
        coalesce(actor_name, 'System')
      );
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

CREATE TRIGGER trg_log_bug_activity
  AFTER INSERT OR UPDATE ON public.bugs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_bug_activity();

-- Trigger function for comments table
CREATE OR REPLACE FUNCTION public.log_comment_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text;
  bug_team_id uuid;
begin
  -- Resolve actor
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  ) into actor_name
  from auth.users
  where id = auth.uid();

  -- Get team_id from the bug
  select team_id into bug_team_id from public.bugs where id = new.bug_id;

  insert into public.bug_activity (bug_id, team_id, action, description, actor)
  values (
    new.bug_id,
    coalesce(bug_team_id, new.team_id),
    'comment_added',
    format('Comment added on %s', new.bug_id),
    coalesce(actor_name, 'System')
  );
  return new;
end;
$$;

CREATE TRIGGER trg_log_comment_activity
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_comment_activity();

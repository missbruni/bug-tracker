-- Session and tester triggers for the team activity feed.
-- These were intended to ship in 20260528120000_team_activity.sql but were
-- pushed after PR #35 was already squash-merged, so they never landed.

CREATE OR REPLACE FUNCTION public.log_session_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text;
begin
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  ) into actor_name
  from auth.users
  where id = auth.uid();

  if TG_OP = 'INSERT' then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      new.team_id,
      'session_created',
      format('Created session "%s"', new.name),
      coalesce(actor_name, 'System'),
      new.id::text
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if old.name IS DISTINCT FROM new.name then
      insert into public.team_activity (team_id, action, description, actor, entity_id)
      values (
        new.team_id,
        'session_renamed',
        format('Renamed session from "%s" to "%s"', old.name, new.name),
        coalesce(actor_name, 'System'),
        new.id::text
      );
    end if;

    if old.status IS DISTINCT FROM new.status then
      if new.status = 'active' then
        insert into public.team_activity (team_id, action, description, actor, entity_id)
        values (new.team_id, 'session_started', format('Started session "%s"', new.name), coalesce(actor_name, 'System'), new.id::text);
      elsif new.status = 'completed' then
        insert into public.team_activity (team_id, action, description, actor, entity_id)
        values (new.team_id, 'session_completed', format('Completed session "%s"', new.name), coalesce(actor_name, 'System'), new.id::text);
      elsif new.status = 'draft' then
        insert into public.team_activity (team_id, action, description, actor, entity_id)
        values (new.team_id, 'session_reopened', format('Reopened session "%s" as draft', new.name), coalesce(actor_name, 'System'), new.id::text);
      end if;
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      old.team_id,
      'session_removed',
      format('Deleted session "%s"', old.name),
      coalesce(actor_name, 'System'),
      old.id::text
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_session_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

DROP TRIGGER IF EXISTS trg_log_session_activity ON public.sessions;
CREATE TRIGGER trg_log_session_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_session_activity();

CREATE OR REPLACE FUNCTION public.log_tester_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text;
begin
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  ) into actor_name
  from auth.users
  where id = auth.uid();

  if TG_OP = 'INSERT' then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      new.team_id,
      'tester_added',
      format('Added tester "%s"', new.name),
      coalesce(actor_name, 'System'),
      new.id::text
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if old.name IS DISTINCT FROM new.name then
      insert into public.team_activity (team_id, action, description, actor, entity_id)
      values (
        new.team_id,
        'tester_renamed',
        format('Renamed tester from "%s" to "%s"', old.name, new.name),
        coalesce(actor_name, 'System'),
        new.id::text
      );
    end if;

    if old.active IS DISTINCT FROM new.active then
      if new.active then
        insert into public.team_activity (team_id, action, description, actor, entity_id)
        values (new.team_id, 'tester_activated', format('Activated tester "%s"', new.name), coalesce(actor_name, 'System'), new.id::text);
      else
        insert into public.team_activity (team_id, action, description, actor, entity_id)
        values (new.team_id, 'tester_deactivated', format('Deactivated tester "%s"', new.name), coalesce(actor_name, 'System'), new.id::text);
      end if;
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      old.team_id,
      'tester_removed',
      format('Removed tester "%s"', old.name),
      coalesce(actor_name, 'System'),
      old.id::text
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_tester_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

DROP TRIGGER IF EXISTS trg_log_tester_activity ON public.testers;
CREATE TRIGGER trg_log_tester_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.testers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tester_activity();

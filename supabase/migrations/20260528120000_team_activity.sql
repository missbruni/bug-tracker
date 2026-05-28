-- Team activity feed: lightweight audit log for team-level changes

CREATE TABLE IF NOT EXISTS public.team_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  action text NOT NULL,
  description text NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_activity_team_created ON public.team_activity (team_id, created_at DESC);

ALTER TABLE public.team_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team scoped team_activity"
  ON public.team_activity
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

GRANT ALL ON TABLE public.team_activity TO anon;
GRANT ALL ON TABLE public.team_activity TO authenticated;
GRANT ALL ON TABLE public.team_activity TO service_role;

GRANT ALL ON SEQUENCE public.team_activity_id_seq TO anon;
GRANT ALL ON SEQUENCE public.team_activity_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.team_activity_id_seq TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.team_activity;

-- Resolve the current user's display name (matches the bug_activity pattern)
CREATE OR REPLACE FUNCTION public.team_activity_actor_name()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  )
  from auth.users
  where id = auth.uid();
$$;

-- Helper: resolve a user's display name from their user_id
CREATE OR REPLACE FUNCTION public.team_activity_user_label(target_user_id uuid)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' ')),
    'Unknown'
  )
  from auth.users
  where id = target_user_id;
$$;

-- ─── Teams trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_team_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text := team_activity_actor_name();
begin
  if TG_OP = 'INSERT' then
    insert into public.team_activity (team_id, action, description, actor)
    values (
      new.id,
      'team_created',
      format('Created team "%s"', new.name),
      coalesce(actor_name, 'System')
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if old.name IS DISTINCT FROM new.name then
      insert into public.team_activity (team_id, action, description, actor)
      values (
        new.id,
        'team_renamed',
        format('Renamed team from "%s" to "%s"', old.name, new.name),
        coalesce(actor_name, 'System')
      );
    end if;
    return new;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_team_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

CREATE TRIGGER trg_log_team_activity
  AFTER INSERT OR UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_activity();

-- ─── Team members trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_team_member_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text := team_activity_actor_name();
  target_name text;
  role_label text;
begin
  if TG_OP = 'INSERT' then
    target_name := team_activity_user_label(new.user_id);
    role_label := case when new.role = 'team_admin' then 'team admin' else 'member' end;
    insert into public.team_activity (team_id, action, description, actor)
    values (
      new.team_id,
      'member_added',
      format('%s joined as %s', target_name, role_label),
      coalesce(actor_name, 'System')
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    target_name := team_activity_user_label(new.user_id);

    if old.role IS DISTINCT FROM new.role then
      insert into public.team_activity (team_id, action, description, actor)
      values (
        new.team_id,
        'role_changed',
        format(
          '%s role changed from %s to %s',
          target_name,
          case when old.role = 'team_admin' then 'team admin' else 'member' end,
          case when new.role = 'team_admin' then 'team admin' else 'member' end
        ),
        coalesce(actor_name, 'System')
      );
    end if;

    if old.status IS DISTINCT FROM new.status then
      insert into public.team_activity (team_id, action, description, actor)
      values (
        new.team_id,
        'member_status_changed',
        format('%s status changed from %s to %s', target_name, old.status, new.status),
        coalesce(actor_name, 'System')
      );
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    target_name := team_activity_user_label(old.user_id);
    insert into public.team_activity (team_id, action, description, actor)
    values (
      old.team_id,
      'member_removed',
      format('%s was removed', target_name),
      coalesce(actor_name, 'System')
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_team_member_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

CREATE TRIGGER trg_log_team_member_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_member_activity();

-- ─── Team invitations trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_team_invitation_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text := team_activity_actor_name();
begin
  if TG_OP = 'INSERT' then
    insert into public.team_activity (team_id, action, description, actor)
    values (
      new.team_id,
      'invitation_sent',
      format('Invited %s as %s', new.email, case when new.role = 'team_admin' then 'team admin' else 'member' end),
      coalesce(actor_name, 'System')
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.status IS DISTINCT FROM new.status then
    insert into public.team_activity (team_id, action, description, actor)
    values (
      new.team_id,
      'invitation_status_changed',
      format('Invitation for %s marked as %s', new.email, new.status),
      coalesce(actor_name, 'System')
    );
    return new;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.team_activity (team_id, action, description, actor)
    values (
      old.team_id,
      'invitation_cancelled',
      format('Cancelled invitation for %s', old.email),
      coalesce(actor_name, 'System')
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_team_invitation_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

CREATE TRIGGER trg_log_team_invitation_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_invitation_activity();

-- ─── Products trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_product_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text := team_activity_actor_name();
begin
  if TG_OP = 'INSERT' then
    insert into public.team_activity (team_id, action, description, actor)
    values (
      new.team_id,
      'product_added',
      format('Added product "%s"', new.name),
      coalesce(actor_name, 'System')
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if old.name IS DISTINCT FROM new.name then
      insert into public.team_activity (team_id, action, description, actor)
      values (
        new.team_id,
        'product_renamed',
        format('Renamed product from "%s" to "%s"', old.name, new.name),
        coalesce(actor_name, 'System')
      );
    elsif old.description IS DISTINCT FROM new.description
       or old.link IS DISTINCT FROM new.link
       or old.links IS DISTINCT FROM new.links then
      insert into public.team_activity (team_id, action, description, actor)
      values (
        new.team_id,
        'product_updated',
        format('Updated product "%s"', new.name),
        coalesce(actor_name, 'System')
      );
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.team_activity (team_id, action, description, actor)
    values (
      old.team_id,
      'product_removed',
      format('Removed product "%s"', old.name),
      coalesce(actor_name, 'System')
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_product_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

CREATE TRIGGER trg_log_product_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_activity();

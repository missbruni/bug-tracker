-- Fix: actor was not being captured on team_activity rows.
-- The original 20260528120000 migration routed actor resolution through a
-- SECURITY DEFINER helper function (team_activity_actor_name()), which
-- returned NULL at runtime so every row fell back to 'System'. Inline the
-- lookup the same way log_bug_activity() does — that pattern works.
--
-- Also populate entity_id (added in 20260528140000) so the UI can render
-- links back to the underlying row when it still exists.

CREATE OR REPLACE FUNCTION public.log_team_activity()
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
      new.id,
      'team_created',
      format('Created team "%s"', new.name),
      coalesce(actor_name, 'System'),
      new.id::text
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if old.name IS DISTINCT FROM new.name then
      insert into public.team_activity (team_id, action, description, actor, entity_id)
      values (
        new.id,
        'team_renamed',
        format('Renamed team from "%s" to "%s"', old.name, new.name),
        coalesce(actor_name, 'System'),
        new.id::text
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

CREATE OR REPLACE FUNCTION public.log_team_member_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text;
  target_name text;
  role_label text;
begin
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  ) into actor_name
  from auth.users
  where id = auth.uid();

  if TG_OP = 'INSERT' then
    target_name := team_activity_user_label(new.user_id);
    role_label := case when new.role = 'team_admin' then 'team admin' else 'member' end;
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      new.team_id,
      'member_added',
      format('%s joined as %s', target_name, role_label),
      coalesce(actor_name, 'System'),
      new.user_id::text
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    target_name := team_activity_user_label(new.user_id);

    if old.role IS DISTINCT FROM new.role then
      insert into public.team_activity (team_id, action, description, actor, entity_id)
      values (
        new.team_id,
        'role_changed',
        format(
          '%s role changed from %s to %s',
          target_name,
          case when old.role = 'team_admin' then 'team admin' else 'member' end,
          case when new.role = 'team_admin' then 'team admin' else 'member' end
        ),
        coalesce(actor_name, 'System'),
        new.user_id::text
      );
    end if;

    if old.status IS DISTINCT FROM new.status then
      insert into public.team_activity (team_id, action, description, actor, entity_id)
      values (
        new.team_id,
        'member_status_changed',
        format('%s status changed from %s to %s', target_name, old.status, new.status),
        coalesce(actor_name, 'System'),
        new.user_id::text
      );
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    target_name := team_activity_user_label(old.user_id);
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      old.team_id,
      'member_removed',
      format('%s was removed', target_name),
      coalesce(actor_name, 'System'),
      old.user_id::text
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_team_member_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

CREATE OR REPLACE FUNCTION public.log_team_invitation_activity()
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
      'invitation_sent',
      format('Invited %s as %s', new.email, case when new.role = 'team_admin' then 'team admin' else 'member' end),
      coalesce(actor_name, 'System'),
      new.id::text
    );
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.status IS DISTINCT FROM new.status then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      new.team_id,
      'invitation_status_changed',
      format('Invitation for %s marked as %s', new.email, new.status),
      coalesce(actor_name, 'System'),
      new.id::text
    );
    return new;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      old.team_id,
      'invitation_cancelled',
      format('Cancelled invitation for %s', old.email),
      coalesce(actor_name, 'System'),
      old.id::text
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_team_invitation_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

CREATE OR REPLACE FUNCTION public.log_product_activity()
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
      'product_added',
      format('Added product "%s"', new.name),
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
        'product_renamed',
        format('Renamed product from "%s" to "%s"', old.name, new.name),
        coalesce(actor_name, 'System'),
        new.id::text
      );
    elsif old.description IS DISTINCT FROM new.description
       or old.link IS DISTINCT FROM new.link
       or old.links IS DISTINCT FROM new.links then
      insert into public.team_activity (team_id, action, description, actor, entity_id)
      values (
        new.team_id,
        'product_updated',
        format('Updated product "%s"', new.name),
        coalesce(actor_name, 'System'),
        new.id::text
      );
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      old.team_id,
      'product_removed',
      format('Removed product "%s"', old.name),
      coalesce(actor_name, 'System'),
      old.id::text
    );
    return old;
  end if;

  return coalesce(new, old);
exception when others then
  raise warning 'log_product_activity failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

-- Drop the unused helper now that no trigger references it.
DROP FUNCTION IF EXISTS public.team_activity_actor_name();

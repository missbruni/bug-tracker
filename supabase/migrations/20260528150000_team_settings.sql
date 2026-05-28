-- Team-level settings: timezone + default product
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS default_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Activity log for settings changes
CREATE OR REPLACE FUNCTION public.log_team_settings_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_name text;
  old_product_name text;
  new_product_name text;
begin
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  ) into actor_name
  from auth.users
  where id = auth.uid();

  if old.timezone IS DISTINCT FROM new.timezone then
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      new.id,
      'team_timezone_changed',
      case
        when new.timezone is null then 'Cleared team timezone'
        when old.timezone is null then format('Set team timezone to %s', new.timezone)
        else format('Changed team timezone from %s to %s', old.timezone, new.timezone)
      end,
      coalesce(actor_name, 'System'),
      new.id::text
    );
  end if;

  if old.default_product_id IS DISTINCT FROM new.default_product_id then
    select name into old_product_name from public.products where id = old.default_product_id;
    select name into new_product_name from public.products where id = new.default_product_id;
    insert into public.team_activity (team_id, action, description, actor, entity_id)
    values (
      new.id,
      'team_default_product_changed',
      case
        when new.default_product_id is null then format('Cleared default product (was "%s")', coalesce(old_product_name, 'Unknown'))
        when old.default_product_id is null then format('Set default product to "%s"', coalesce(new_product_name, 'Unknown'))
        else format('Changed default product from "%s" to "%s"', coalesce(old_product_name, 'Unknown'), coalesce(new_product_name, 'Unknown'))
      end,
      coalesce(actor_name, 'System'),
      new.id::text
    );
  end if;

  return new;
exception when others then
  raise warning 'log_team_settings_activity failed: %', sqlerrm;
  return new;
end;
$$;

CREATE TRIGGER trg_log_team_settings_activity
  AFTER UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_settings_activity();

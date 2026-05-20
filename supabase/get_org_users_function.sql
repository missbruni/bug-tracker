-- Function: get_org_users()
-- Returns all auth.users whose email matches the allowed org domain.
-- SECURITY DEFINER so it can read auth.users (not accessible to clients).
-- Callable via supabase.rpc('get_org_users').
--
-- Idempotent: safe to re-run.

create or replace function get_org_users()
returns table (
  id uuid,
  email text,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    au.id,
    au.email::text,
    coalesce(
      au.raw_user_meta_data->>'name',
      au.raw_user_meta_data->>'full_name',
      split_part(au.email::text, '@', 1)
    ) as display_name
  from auth.users au
  where au.email ilike '%@theaccessgroup.com'
  order by au.email;
$$;

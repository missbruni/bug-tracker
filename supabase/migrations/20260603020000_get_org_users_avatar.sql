DROP FUNCTION IF EXISTS public.get_org_users();

CREATE OR REPLACE FUNCTION public.get_org_users()
RETURNS TABLE(id uuid, email text, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    au.id,
    au.email::text,
    COALESCE(
      NULLIF(au.raw_user_meta_data->>'name', ''),
      NULLIF(au.raw_user_meta_data->>'full_name', ''),
      NULLIF(au.raw_user_meta_data->>'preferred_username', ''),
      INITCAP(REPLACE(SPLIT_PART(au.email::text, '@', 1), '.', ' '))
    ) AS display_name,
    NULLIF(au.raw_user_meta_data->>'avatar_url', '') AS avatar_url
  FROM auth.users au
  WHERE au.email ILIKE '%@theaccessgroup.com'
  ORDER BY au.email;
$$;

GRANT ALL ON FUNCTION public.get_org_users() TO anon;
GRANT ALL ON FUNCTION public.get_org_users() TO authenticated;
GRANT ALL ON FUNCTION public.get_org_users() TO service_role;

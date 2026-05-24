-- Fix RLS policy to allow team creation trigger to add creator as team admin
-- The previous policy required users to already be team admins to insert into team_members,
-- which created a chicken-and-egg problem when creating new teams.

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Admin or owner manage members" ON "public"."team_members";

-- Create a more permissive INSERT policy that allows:
-- 1. Team admins/owners to manage members (existing functionality)
-- 2. Users to insert themselves as team admins for new teams (fixes the trigger issue)
CREATE POLICY "Admin or owner manage members" ON "public"."team_members" 
FOR INSERT TO "authenticated" 
WITH CHECK (
  "public"."is_team_admin_or_owner"("team_id") OR 
  (role = 'team_admin' AND status = 'active' AND user_id = auth.uid())
);
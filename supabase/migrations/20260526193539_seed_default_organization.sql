-- Ensure the default organization exists in all environments.
-- The application hardcodes ORGANIZATION_ID = 'theaccessgroup' (src/lib/teamScope.ts)
-- and every team INSERT references it via the teams.organization_id FK.
-- Without this row, team creation fails with:
--   "Insert or update on table 'teams' violates foreign key constraint 'teams_organization_id_fkey'"

INSERT INTO organizations (id, name)
VALUES ('theaccessgroup', 'The Access Group')
ON CONFLICT (id) DO NOTHING;

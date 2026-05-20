# Project Agent Notes

## Supabase Database Workflow

- Source of truth: `supabase/migrations/*.sql`.
- Migration baseline file exists and is tracked in git.
- CI includes `db_dry_run` validation (`supabase db push --dry-run`) when Supabase secrets are configured.

## Legacy SQL

- Historical manual SQL scripts are under `supabase/legacy/`.
- Keep for reference only.
- Do not add new schema changes to `supabase/legacy/`.

## Required Secrets for CI db dry-run

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

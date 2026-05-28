# Project Agent Notes

## Supabase Database Workflow

- Source of truth: `supabase/migrations/*.sql`.
- Migration baseline file exists and is tracked in git.
- CI includes `db_dry_run` validation (`supabase db push --dry-run`) when Supabase secrets are configured.

## Required Secrets for CI db dry-run

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

## Required Secrets for staging migration apply

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_STAGING_DB_PASSWORD`
- `SUPABASE_STAGING_PROJECT_ID`

## Production migration apply gate

- CI includes `db_apply_prod` after staging migration apply.
- `db_apply_prod` uses GitHub Actions `production` environment protection (manual approval should be configured in repository settings).

## Required Secrets for production migration apply

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

## Vercel Preview Deployments (staging)

- PRs get automatic Vercel preview deployments via the `deploy_preview` CI job.
- Preview builds use staging Supabase env vars.
- The preview URL is posted as a PR comment (updated on subsequent pushes).

### Required Secrets for preview deployments

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_SUPABASE_STAGING_URL`
- `VITE_SUPABASE_STAGING_ANON_KEY`
- `VITE_ALLOWED_EMAIL_DOMAIN`

## Local Development

- `bun run dev` — runs against **staging** Supabase (env from `.env.staging`).
- `bun run dev:local` — runs against **local** Supabase (env from `.env.localdb`); auto-starts Docker containers if not running.
- Seed data is applied automatically on `db:start` / `db:reset` (see `supabase/seed.sql`).
- Convenience scripts: `db:reset`, `db:migration:new`. Use `supabase stop` to stop containers.
- Vite uses `--mode staging` / `--mode localdb` to load the correct env file. Personal overrides go in `.env.local` (gitignored).
- Analytics container is disabled in `supabase/config.toml` for Colima/Docker compatibility.

## Code Style

- **Types co-location**: Types should live in the file where they are used. If a type is reused across files, export it from the file closest to its domain. **Do not create or grow a centralized `types.ts` file — keep types co-located with their usage.**
- **Activity / view-row types belong on the component, not the hook**: when a hook fetches rows and a component renders them, the row/action types are exported from the **component** and imported by the hook (see `BugActivity`/`BugActivityAction` in `src/components/BugActivityTimeline.tsx`, imported by `src/hooks/useBugActivity.ts`). Follow the same direction for any new `*Activity` / `*Timeline` / `*Feed` features. Do not invert this so the hook owns the types and the component re-exports them.
- **No new top-level folders without a refactor PR**: pages live in `src/pages/`, components in `src/components/`, hooks in `src/hooks/`, Zustand stores in `src/stores/`, cross-cutting helpers in `src/lib/`, and domain modules in `src/domains/<entity>/` (currently only `bugs/` and `sessions/`). Don't add a new domain folder (e.g. `domains/teams/`) just to host a single new file — put the file in the conventional location and propose a dedicated refactor PR if a new domain is warranted.
- **No dangling re-exports**: don't `export type { X }` from a file just because another file would otherwise have to import `X` from a third location. Import `X` directly from its source.
- Do not use single-character variable names. Use descriptive names that convey intent.
- Use `import React from 'react'` and access hooks via `React.useState`, `React.useEffect`, etc. Do not destructure hooks from the React import.
- Zustand stores live in `src/stores/`. Name the file after the domain (e.g. `panelStore.ts`, `notificationStore.ts`) and export a `use<Domain>Store` hook.

## AI Assistant

- The AI assistant (chat agent) must always support any new features or app capabilities.
- When adding a new feature, always check whether the agent needs updates: action types in `src/lib/aiTypes.ts`, handlers in `src/lib/aiSessionActions.ts`, prompt documentation in `src/lib/aiPrompt.ts`, and result handling in `src/hooks/useAiAssistant.ts`.
- If a feature adds new bug actions, filters, export formats, or UI capabilities, the agent prompt and session action handlers must be updated in the same PR.

## Pull Requests

- Do not commit or push code without being explicitly asked by the user.
- Keep PR descriptions concise — a short summary of what changed and why.
- Do not include a test plan section.
- Do not include "Generated with Devin" or similar attribution lines.

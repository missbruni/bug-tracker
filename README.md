# Mushi 🪲

*Catch every bug before your users do.*

Mushi (虫) is a real-time bug tracking tool built for QA testing sessions. Log bugs, triage as a team, and publish straight to your backlog — all in one place.

**Live:** [https://mushi-navy.vercel.app/](https://mushi-navy.vercel.app/)

## Features

- **Bug logging** — report bugs with severity, device, page, screenshots, and categories
- **Testing sessions** — plan sessions with scenarios, assign testers, and present a briefing deck
- **AI assistant** — log bugs and manage sessions from a chat panel
- **Real-time triage** — filter, sort, and review bugs as a team
- **Azure DevOps integration** — publish bugs to your backlog with one click
- **Multi-team support** — isolated data per team with role-based access
- **Keyboard shortcuts** — `⌘K` search, `⌘J` new bug, `⌘B` toggle crawling bugs
- **Dark mode** — automatic or manual theme switching

## Local Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Quick start

1. Install dependencies:

   ```bash
   bun install
   ```

2. Run the app (connects to **staging** Supabase by default):

   ```bash
   bun run dev
   ```

   Or run against a **local** Supabase (auto-starts Docker containers if needed):

   ```bash
   bun run dev:local
   ```

### Environment files

| File | Committed | Loaded by | Purpose |
|---|---|---|---|
| `.env.staging` | Yes | `bun run dev` | Staging Supabase URL + anon key |
| `.env.localdb` | Yes | `bun run dev:local` | Local Supabase defaults |
| `.env.local` | No (gitignored) | Always | Personal overrides |

### Database scripts

| Command | Description |
|---|---|
| `bun run db:reset` | Reset DB, re-apply migrations and seed data |
| `bun run db:migration:new <name>` | Create a new migration file |
| `supabase stop` | Stop local Supabase containers |

### Seed data

`supabase/seed.sql` creates a default team, org, and sample testers so you can start developing immediately with `dev:local`.

## Database Migrations

Schema changes live in `supabase/migrations/` as the source of truth.

### Creating a new migration

```bash
bun run db:migration:new my_change_description
# edit supabase/migrations/<timestamp>_my_change_description.sql
bun run db:reset   # verify locally
```

### CI pipeline

Migrations flow through CI automatically:

1. **PR** — `db_dry_run` validates migrations against the linked project
2. **Merge to main** — `db_apply_staging` applies to staging, then `db_apply_prod` applies to production (with manual approval gate)

### Baseline setup (one-time, already done)

The baseline was captured from production. If you ever need to re-pull:

```bash
supabase login
supabase link --project-ref <PROD_PROJECT_REF>
supabase db pull baseline_public
supabase db pull baseline_auth_storage --schema auth,storage
```

Avoid direct production SQL edits; if an emergency edit is made, backfill it into a migration file immediately after.

## Staging (Preview Deployments)

Every PR automatically gets a Vercel preview deployment connected to the **staging** Supabase database. The preview URL is posted as a comment on the PR.

### Required GitHub Secrets for previews

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `VITE_SUPABASE_STAGING_URL` — staging Supabase project URL
- `VITE_SUPABASE_STAGING_ANON_KEY` — staging Supabase anon key
- `VITE_ALLOWED_EMAIL_DOMAIN`

## Deploying to Vercel (Production)

This app is hosted on Vercel and uses a Vercel Function for AI proxying.

1. Import this repo into Vercel.
2. Set build settings:
   - Build command: `bun run build`
   - Output directory: `dist`
3. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ALLOWED_EMAIL_DOMAIN`
   - `VITE_MS_LOGIN_ENABLED` (`true` to enable Microsoft login button, default `false`)
   - `BACKLOG_WEBHOOK_URL` (optional, defaults to hosted n8n endpoint)
   - `BACKLOG_ALLOWED_HOSTS` (optional host allowlist for `BACKLOG_WEBHOOK_URL`, default `n8n.dev.ax.accessacloud.com`)
   - `BACKLOG_WEBHOOK_SECRET` (optional shared secret header value for n8n)
   - `BACKLOG_WEBHOOK_SECRET_HEADER` (optional header name, default `x-mushi-webhook-secret`)
   - `PUBLISH_RATE_LIMIT_MAX` / `PUBLISH_RATE_LIMIT_WINDOW_SECONDS` (optional publish endpoint throttling)
   - `AI_PROXY_ALLOWED_HOSTS` (comma-separated host allowlist, e.g. `api.openai.com,*.openai.azure.com`)
   - `VITE_PRESENTATION_PIN`
4. In Supabase Auth settings, add your Vercel production URL to allowed redirect URLs.

## AI Proxy

- AI requests are routed through the same-origin endpoint `/api/ai-proxy`.
- On Vercel (preview + production), this endpoint is served by `api/ai-proxy.ts`.
- In local development, Vite serves the same route via middleware in `vite.config.js`.
- In production, proxy targets must match `AI_PROXY_ALLOWED_HOSTS` (defaults to `api.openai.com,*.openai.azure.com`).

## Chrome Extension (MVP)

The repository now includes a Chrome extension in `extension/` for quick bug capture while testing other apps.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder in this repo

### Configure once

- Open Mushi production (`https://mushi-navy.vercel.app/`) in at least one tab so the extension can reuse the active session

### Capture flow

- On a tested page, use `Alt + Shift + B` to open the capture composer
- Add title, description, severity
- Attach multiple screenshots (capture button) and/or upload image/video files
- Submit to create a bug directly in Mushi

### Domain gating

- Capture is enabled only when the tested page domain matches product domains derived from `products.link` in the active team.
- If no product links are configured, capture is disabled until links are added in Team Management.

### Auth behavior

- The extension reuses Mushi web app auth session.
- If you are not logged in, it opens Mushi login and retries submission automatically after login.
- The bug `tester` defaults to the logged-in user identity.

### v1 limits

- Chrome only (Manifest V3)
- Video is upload-only (no in-extension recording)

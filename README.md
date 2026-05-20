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

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create a local `.env` with:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_ALLOWED_EMAIL_DOMAIN=theaccessgroup.com
   VITE_MS_LOGIN_ENABLED=false
   VITE_PRESENTATION_PIN=your-session-pin
   ```

3. Run the app:

   ```bash
   bun run dev
   ```

## Database Migrations (baseline setup)

Schema changes are moving to Supabase CLI migrations in `supabase/migrations` as the source of truth.

1. Install Supabase CLI and Docker.
2. Link to production (one-time for baseline capture):

   ```bash
   supabase login
   supabase link --project-ref <PROD_PROJECT_REF>
   ```

3. Pull baseline migrations from the current production schema:

   ```bash
   bun run db:baseline:pull
   bun run db:baseline:pull:auth-storage
   ```

4. Commit generated migration files in `supabase/migrations`.

Use `supabase/legacy/` only as historical reference for old manual SQL-editor scripts. Do not add new schema changes there.

Avoid direct production SQL edits; if an emergency edit is made, backfill it into a migration file immediately after.

## Deploying to Vercel

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
   - `TEAM_PIN`
   - `GOD_PIN`
   - `PIN_SESSION_SECRET`
   - `BACKLOG_WEBHOOK_URL` (optional, defaults to hosted n8n endpoint)
   - `BACKLOG_ALLOWED_HOSTS` (optional host allowlist for `BACKLOG_WEBHOOK_URL`, default `n8n.dev.ax.accessacloud.com`)
   - `BACKLOG_WEBHOOK_SECRET` (optional shared secret header value for n8n)
   - `BACKLOG_WEBHOOK_SECRET_HEADER` (optional header name, default `x-mushi-webhook-secret`)
   - `PUBLISH_RATE_LIMIT_MAX` / `PUBLISH_RATE_LIMIT_WINDOW_SECONDS` (optional publish endpoint throttling)
   - `PIN_RATE_LIMIT_MAX` / `PIN_RATE_LIMIT_WINDOW_SECONDS` (optional global PIN attempt throttling)
   - `PIN_FAILED_ATTEMPTS_MAX` / `PIN_FAILED_ATTEMPTS_WINDOW_SECONDS` / `PIN_FAILED_COOLDOWN_SECONDS` (optional PIN brute-force cooldown)
   - `AI_PROXY_ALLOWED_HOSTS` (comma-separated host allowlist, e.g. `api.openai.com,*.openai.azure.com`)
   - `VITE_PRESENTATION_PIN`
4. In Supabase Auth settings, add your Vercel production URL to allowed redirect URLs.

## PIN Auth

- PIN access is verified server-side by Vercel Functions (`api/auth/pin.ts`, `api/auth/session.ts`, `api/auth/logout.ts`).
- PIN values are read from server-only environment variables: `TEAM_PIN` and `GOD_PIN`.
- Session cookies are signed with `PIN_SESSION_SECRET` and stored as `HttpOnly` cookies.

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
- Ensure your Supabase project includes `products.link` and `products.description` columns (legacy manual script: `supabase/legacy/products_link_description_migration.sql`)

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

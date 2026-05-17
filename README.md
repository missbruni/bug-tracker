# Mushi 🪲

*Catch every bug before your users do.*

Mushi (虫) is a real-time bug tracking tool built for QA testing sessions. Log bugs, triage as a team, and publish straight to your backlog — all in one place.

**Live:** [https://mushi.vercel.app/](https://mushi.vercel.app/)

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
   VITE_TEAM_PIN=your-team-pin
   VITE_GOD_PIN=your-god-pin
   ```

3. Run the app:

   ```bash
   bun run dev
   ```

## Deploying to Vercel

This app is hosted on Vercel (frontend) and currently uses a Cloudflare Worker for AI proxying.

1. Import this repo into Vercel.
2. Set build settings:
   - Build command: `bun run build`
   - Output directory: `dist`
3. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ALLOWED_EMAIL_DOMAIN`
   - `VITE_TEAM_PIN`
   - `VITE_GOD_PIN`
4. In Supabase Auth settings, add your Vercel production URL to allowed redirect URLs.

## AI Proxy (Current)

- Production AI requests are routed through the Cloudflare Worker in `worker/`.
- Worker CORS allowlist is controlled by `ALLOWED_ORIGINS` (comma-separated), for example:

  ```
  https://your-project.vercel.app,http://localhost:5173
  ```
- After changing allowed origins in `worker/src/index.ts`, redeploy the worker:

  ```bash
  cd worker
  bun install
  bunx wrangler deploy
  ```

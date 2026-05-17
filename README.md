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
   ```

3. Run the app:

   ```bash
   bun run dev
   ```

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
   - `TEAM_PIN`
   - `GOD_PIN`
   - `PIN_SESSION_SECRET`
4. In Supabase Auth settings, add your Vercel production URL to allowed redirect URLs.

## PIN Auth

- PIN access is verified server-side by Vercel Functions (`api/auth/pin.ts`, `api/auth/session.ts`, `api/auth/logout.ts`).
- PIN values are read from server-only environment variables: `TEAM_PIN` and `GOD_PIN`.
- Session cookies are signed with `PIN_SESSION_SECRET` and stored as `HttpOnly` cookies.

## AI Proxy

- AI requests are routed through the same-origin endpoint `/api/ai-proxy`.
- On Vercel (preview + production), this endpoint is served by `api/ai-proxy.ts`.
- In local development, Vite serves the same route via middleware in `vite.config.js`.

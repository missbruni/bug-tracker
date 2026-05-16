# Bug Tracker

A real-time bug tracking app built for testing session triage, with crawling bug animations, keyboard shortcuts, and Azure DevOps backlog integration.

**Live:** [https://missbruni.github.io/bug-tracker/](https://missbruni.github.io/bug-tracker/)

## Stack

- **React 19** + **TypeScript**
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Supabase** for database and file storage
- **n8n** webhook for Azure DevOps backlog publishing
- **Bun** as package manager and runtime
- **GitHub Pages** for hosting (deployed via GitHub Actions)

## Getting Started

```bash
bun install
cp .env.example .env
bun dev
```

Set these values in `.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ALLOWED_EMAIL_DOMAIN=theaccessgroup.com
VITE_TEAM_PIN=jabbajubs!
```

## Authentication Setup (Supabase + Microsoft)

- In Supabase Auth, enable the Microsoft/Azure provider.
- Add redirect URLs:
  - `http://localhost:5173`
  - `https://missbruni.github.io/bug-tracker/`
- Set `VITE_ALLOWED_EMAIL_DOMAIN` to your company domain.
- Temporary fallback: set `VITE_TEAM_PIN` to keep app access open while tenant approval is pending.

## RLS Policy Migration

If your project already has public policies from older setup, run the SQL in `supabase/authenticated_policies.sql` via Supabase SQL Editor.

This migrates database access to authenticated users only while keeping attachment files publicly readable.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘ K` | Focus search |
| `⌘ J` | New bug |

# EVO IBE Bug Tracker

A real-time bug tracking app built for testing session triage, with crawling bug animations, keyboard shortcuts, and Azure DevOps backlog integration.

**Live:** [https://missbruni.github.io/bug-tracker/](https://missbruni.github.io/bug-tracker/)

## Stack

- **React 18** + **TypeScript**
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Supabase** for database and file storage
- **n8n** webhook for Azure DevOps backlog publishing
- **Bun** as package manager and runtime
- **GitHub Pages** for hosting (deployed via GitHub Actions)

## Getting Started

```bash
bun install
cp .env.example .env   # add your Supabase credentials
bun dev
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘ K` | Focus search |
| `⌘ J` | New bug |

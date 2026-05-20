# Microsoft Auth Cutover Runbook

Use this runbook when Entra app registration approvals are complete and you are ready to move from temporary PIN-only data access policies to authenticated Supabase policies.

## Prerequisites

- Microsoft login flow is verified in Supabase Auth (Azure provider configured).
- Production redirect URL is present in Supabase Auth redirect allowlist.
- `VITE_MS_LOGIN_ENABLED=true` is set in Vercel production.
- Keep `TEAM_PIN`, `GOD_PIN`, and `PIN_SESSION_SECRET` configured for temporary authorized access during approval transition.
- Confirm production has correct backlog proxy env vars (`BACKLOG_WEBHOOK_URL`, `BACKLOG_ALLOWED_HOSTS`, optional webhook secret).

## Cutover Steps (Production)

1. Deploy latest app code (includes `/api/backlog/publish` and rate protection).
2. In Supabase SQL Editor (production), run:
   - `supabase/authenticated_policies.sql`
3. Confirm SQL execution succeeded without policy conflicts.
4. Run smoke tests (below) before announcing completion.

## Smoke Checklist

- Auth:
  - Microsoft sign-in works for allowed domain users.
  - Unauthorized domain is rejected with correct message.
  - PIN access remains available for approved admin/team users during transition.
- Core app:
  - Create/edit/delete bug works.
  - Attachments upload and open correctly.
  - Comments and filters behave as expected.
- Extension:
  - Extension bridge reports authenticated context.
  - Domain gating and bug submission still work.
- Publish:
  - Publish to backlog succeeds through `/api/backlog/publish`.
  - Backlog URL and reviewed state persist correctly.
  - Repeated spam requests return `429` as expected.

## Monitoring (First 24–48h)

- Watch Vercel logs for:
  - `[auth/pin]` rate-limit and cooldown warnings.
  - `[backlog/publish]` rate-limit warnings.
- Track user reports for auth loops, publish failures, or missing permissions.

## Rollback

If production access breaks:

1. In Supabase SQL Editor (production), run:
   - `supabase/temporary_public_policies.sql`
2. Optionally set `VITE_MS_LOGIN_ENABLED=false` to force PIN-first behavior.
3. Keep PIN env vars enabled.
4. Re-run smoke checklist focused on PIN login and core CRUD actions.

-- Seed data for local Supabase development
-- Run automatically via `supabase start` when db.seed.enabled = true

-- ─── Auto-add new users to default team (local dev only) ────────────
-- Any user who signs up locally is automatically made a team admin
-- so they can see all team-scoped seed data through RLS.

CREATE OR REPLACE FUNCTION public.seed_auto_add_to_default_team()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES ('11111111-1111-1111-1111-111111111111', NEW.id, 'team_admin', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_auto_add_default_team
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_auto_add_to_default_team();

-- ─── Organisation & Team ────────────────────────────────────────────

INSERT INTO organizations (id, name) VALUES
  ('theaccessgroup', 'Stark Industries')
ON CONFLICT DO NOTHING;

INSERT INTO teams (id, organization_id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'theaccessgroup', 'The Avengers', 'evo-ibe')
ON CONFLICT DO NOTHING;

-- ─── Product ────────────────────────────────────────────────────────

INSERT INTO products (id, team_id, name, slug, description, link) VALUES
  ('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Jarvis UI', 'jarvis-ui', 'AI assistant interface — holographic & web', '{"label":"Jarvis","url":"https://jarvis.stark.local"}')
ON CONFLICT DO NOTHING;

-- ─── Testers ────────────────────────────────────────────────────────

INSERT INTO testers (id, name, devices, team_id) VALUES
  ('bbbb0000-0000-0000-0000-000000000001', 'Tony Stark',       '{"MacBook Pro","iPhone 15"}',        '11111111-1111-1111-1111-111111111111'),
  ('bbbb0000-0000-0000-0000-000000000002', 'Natasha Romanoff', '{"Windows Laptop","Samsung S24"}',   '11111111-1111-1111-1111-111111111111'),
  ('bbbb0000-0000-0000-0000-000000000003', 'Bruce Banner',     '{"MacBook Air","iPad Pro"}',         '11111111-1111-1111-1111-111111111111'),
  ('bbbb0000-0000-0000-0000-000000000004', 'Steve Rogers',     '{"Windows Desktop","Pixel 8"}',      '11111111-1111-1111-1111-111111111111'),
  ('bbbb0000-0000-0000-0000-000000000005', 'Wanda Maximoff',   '{"MacBook Pro","iPhone 14"}',        '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ─── Completed Session ──────────────────────────────────────────────

INSERT INTO sessions (id, name, date, status, team_id, product_id, duration_seconds) VALUES
  ('cccc0000-0000-0000-0000-000000000001', 'Sprint 42 — Suit Diagnostics',
   current_date - interval '3 days', 'completed', '11111111-1111-1111-1111-111111111111',
   'aaaa0000-0000-0000-0000-000000000001', 2700)
ON CONFLICT DO NOTHING;

-- Draft session for current work
INSERT INTO sessions (id, name, date, status, team_id, product_id) VALUES
  ('cccc0000-0000-0000-0000-000000000002', 'Sprint 43 — Threat Detection',
   current_date, 'draft', '11111111-1111-1111-1111-111111111111',
   'aaaa0000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ─── Scenarios (for the completed session) ──────────────────────────

INSERT INTO scenarios (id, session_id, letter, title, description, device_requirement, sort_order, team_id) VALUES
  ('dddd0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001',
   'A', 'Launch suit HUD overlay', 'Activate heads-up display, verify all vitals and weapon readouts render.', 'Desktop', 0, '11111111-1111-1111-1111-111111111111'),
  ('dddd0000-0000-0000-0000-000000000002', 'cccc0000-0000-0000-0000-000000000001',
   'B', 'Run threat scan', 'Initiate perimeter scan, confirm hostile markers appear on the map.', 'Mobile', 1, '11111111-1111-1111-1111-111111111111'),
  ('dddd0000-0000-0000-0000-000000000003', 'cccc0000-0000-0000-0000-000000000001',
   'C', 'Deploy emergency protocol', 'Trigger Veronica protocol and verify Hulkbuster assembly sequence.', NULL, 2, '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ─── Assignments ────────────────────────────────────────────────────

INSERT INTO assignments (session_id, scenario_id, tester_id, team_id) VALUES
  ('cccc0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('cccc0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000002', 'bbbb0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('cccc0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000003', 'bbbb0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ─── Bugs ───────────────────────────────────────────────────────────

INSERT INTO bugs (id, title, tester, tester_id, device, page, severity, category, description, reviewed, session_id, team_id) VALUES
  -- Critical bugs
  ('CRT-01', '[CRT] HUD freezes when suit reaches Mach 3',
   'Tony Stark', 'bbbb0000-0000-0000-0000-000000000001', 'MacBook Pro', 'Flight HUD', 'critical', 'Performance',
   'Above Mach 3 the heads-up display locks for 5+ seconds. All telemetry data stops refreshing and the altitude readout flatlines until speed drops below Mach 2.',
   false, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  ('CRT-02', '[CRT] Threat scanner marks friendly units as hostile',
   'Natasha Romanoff', 'bbbb0000-0000-0000-0000-000000000002', 'Windows Laptop', 'Threat Map', 'critical', 'Detection',
   'SHIELD transponder signals are misclassified as hostile. Red markers appear on the map for known friendly quinjets, risking friendly fire.',
   true, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  -- High-severity bugs
  ('HI-01', '[HI] Vitals panel loses data when switching suit modes',
   'Bruce Banner', 'bbbb0000-0000-0000-0000-000000000003', 'iPad Pro', 'Vitals', 'high', 'State',
   'Switch from combat mode to analysis mode, then back. Heart rate and gamma radiation readings are cleared. Expected: readings should persist across mode switches.',
   false, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  ('HI-02', '[HI] Language selector not updating labels in real time',
   'Steve Rogers', 'bbbb0000-0000-0000-0000-000000000004', 'Windows Desktop', 'Settings', 'high', 'i18n',
   'Switching interface language from English to Sokovian updates the dropdown label but all other UI text stays in English until a manual page refresh.',
   false, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  ('HI-03', '[HI] Mission timer allows end time before start time',
   'Wanda Maximoff', 'bbbb0000-0000-0000-0000-000000000005', 'MacBook Pro', 'Mission Planner', 'high', 'Validation',
   'It is possible to set a mission end time earlier than the start time. The planner then shows negative duration with no error message.',
   true, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  ('HI-04', '[HI] Repulsor charge indicator overlaps on small viewports',
   'Tony Stark', 'bbbb0000-0000-0000-0000-000000000001', 'iPhone 15', 'Combat HUD', 'high', 'Layout',
   'On screens narrower than 375px the left/right repulsor charge bars overlap the targeting reticle, making it impossible to aim.',
   false, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  -- Low-severity bugs
  ('LO-01', '[LO] Mission debrief email subject has double space',
   'Natasha Romanoff', 'bbbb0000-0000-0000-0000-000000000002', 'Windows Laptop', 'Notifications', 'low', 'Content',
   'The debrief email subject reads "Mission  Complete" with two spaces between "Mission" and "Complete".',
   true, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  ('LO-02', '[LO] Team roster avatar placeholder has wrong aspect ratio',
   'Bruce Banner', 'bbbb0000-0000-0000-0000-000000000003', 'MacBook Air', 'Team Roster', 'low', 'Layout',
   'When a team member has no profile photo, the grey placeholder is taller than actual avatars, causing layout shift when images lazy-load.',
   false, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),

  ('LO-03', '[LO] "Assemble" button text not translated in Asgardian locale',
   'Wanda Maximoff', 'bbbb0000-0000-0000-0000-000000000005', 'iPhone 14', 'Dashboard', 'low', 'i18n',
   'In the Asgardian locale the "Assemble" button still shows in English. All surrounding text is correctly translated.',
   false, 'cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ─── Comments ───────────────────────────────────────────────────────

INSERT INTO comments (bug_id, text, author, time, team_id) VALUES
  ('CRT-01', 'Reproduced in Mark 50 and Mark 85 suits. Looks like the render pipeline chokes on supersonic wind-resistance data.',
   'Bruce Banner', '2026-05-23 10:15', '11111111-1111-1111-1111-111111111111'),
  ('CRT-01', 'Confirmed — the telemetry buffer overflows at high velocity. Friday flagged the same issue last week.',
   'Tony Stark', '2026-05-23 10:42', '11111111-1111-1111-1111-111111111111'),
  ('HI-01', 'This might be caused by the vitals store being held in component state instead of persisted to the suit black box.',
   'Bruce Banner', '2026-05-23 11:05', '11111111-1111-1111-1111-111111111111'),
  ('HI-03', 'Added a min-time constraint in PR #18 — marking as reviewed.',
   'Wanda Maximoff', '2026-05-23 14:30', '11111111-1111-1111-1111-111111111111');

-- ─── Open Questions ─────────────────────────────────────────────────

INSERT INTO open_questions (id, text, tester, team_id) VALUES
  ('Q-01', 'Should the language setting persist across suit reboots or reset to the pilot default on each startup?',
   'Steve Rogers', '11111111-1111-1111-1111-111111111111'),
  ('Q-02', 'Do we want to show a "Mission Complete" banner when someone revisits a finished debrief link?',
   'Tony Stark', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ─── Session Feedback (for the completed session) ───────────────────

INSERT INTO session_feedback (session_id, rating, length_feel, clarity, helpfulness, worked_well, to_improve, name, team_id) VALUES
  ('cccc0000-0000-0000-0000-000000000001', 4, 'just_right', 4, 'very',
   'Good scenario coverage, clear briefing from Fury.', 'Could use more edge-case scenarios for Hulkbuster mode.',
   'Tony Stark', '11111111-1111-1111-1111-111111111111'),
  ('cccc0000-0000-0000-0000-000000000001', 5, 'just_right', 5, 'very',
   'Well-structured session, good team coordination.', NULL,
   'Natasha Romanoff', '11111111-1111-1111-1111-111111111111'),
  ('cccc0000-0000-0000-0000-000000000001', 3, 'too_long', 3, 'somewhat',
   'Found real bugs quickly.', 'The emergency protocol scenario was underspecified.',
   'Bruce Banner', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

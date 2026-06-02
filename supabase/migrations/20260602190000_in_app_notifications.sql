CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_created ON public.notifications (recipient_user_id, created_at DESC);
CREATE INDEX idx_notifications_recipient_unseen ON public.notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX idx_notifications_team_created ON public.notifications (team_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.notifications;

CREATE OR REPLACE FUNCTION public.notification_actor_name()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  select coalesce(
    nullif(raw_user_meta_data->>'name', ''),
    nullif(raw_user_meta_data->>'full_name', ''),
    initcap(replace(split_part(email::text, '@', 1), '.', ' '))
  )
  from auth.users
  where id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.create_comment_mention_notifications()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  mentioned_user_id uuid;
  bug_team_id uuid;
  actor_id uuid := auth.uid();
  actor_label text := notification_actor_name();
begin
  if coalesce(array_length(new.mentioned_user_ids, 1), 0) = 0 then
    return new;
  end if;

  select team_id into bug_team_id
  from public.bugs
  where id = new.bug_id;

  if bug_team_id is null then
    return new;
  end if;

  for mentioned_user_id in
    select distinct mentioned.user_id
    from unnest(new.mentioned_user_ids) as mentioned(user_id)
  loop
    if actor_id is not null and mentioned_user_id = actor_id then
      continue;
    end if;

    if not exists (
      select 1
      from public.team_members
      where team_id = bug_team_id
        and user_id = mentioned_user_id
        and status = 'active'
    ) then
      continue;
    end if;

    insert into public.notifications (
      recipient_user_id,
      team_id,
      type,
      actor_user_id,
      actor_name,
      entity_type,
      entity_id,
      title,
      body,
      href
    )
    values (
      mentioned_user_id,
      bug_team_id,
      'bug_comment_mention',
      actor_id,
      coalesce(actor_label, 'Someone'),
      'comment',
      new.id::text,
      format('%s mentioned you on %s', coalesce(actor_label, 'Someone'), new.bug_id),
      left(new.text, 240),
      format('/?q=%s', new.bug_id)
    );
  end loop;

  return new;
exception when others then
  raise warning 'create_comment_mention_notifications failed: %', sqlerrm;
  return new;
end;
$$;

CREATE TRIGGER trg_create_comment_mention_notifications
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_comment_mention_notifications();

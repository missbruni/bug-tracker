ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS backlog_key text,
  ADD COLUMN IF NOT EXISTS default_backlog_provider text NOT NULL DEFAULT 'mushi',
  ADD CONSTRAINT teams_default_backlog_provider_check CHECK (default_backlog_provider = ANY (ARRAY['mushi'::text, 'azure'::text]));

UPDATE public.teams
SET backlog_key = coalesce(nullif(upper(left(regexp_replace(slug, '[^a-zA-Z0-9]', '', 'g'), 6)), ''), 'TEAM')
WHERE backlog_key IS NULL;

UPDATE public.teams
SET default_backlog_provider = 'azure';

CREATE OR REPLACE FUNCTION public.normalize_team_backlog_settings()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
begin
  if new.backlog_key is null or btrim(new.backlog_key) = '' then
    new.backlog_key := coalesce(nullif(upper(left(regexp_replace(new.slug, '[^a-zA-Z0-9]', '', 'g'), 6)), ''), 'TEAM');
  else
    new.backlog_key := upper(left(regexp_replace(new.backlog_key, '[^a-zA-Z0-9]', '', 'g'), 12));
    if new.backlog_key = '' then
      new.backlog_key := 'TEAM';
    end if;
  end if;

  return new;
end;
$$;

CREATE TRIGGER trg_normalize_team_backlog_settings
  BEFORE INSERT OR UPDATE OF backlog_key, slug ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_team_backlog_settings();

CREATE TABLE IF NOT EXISTS public.backlog_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backlog_columns_team_order ON public.backlog_columns (team_id, is_archived, sort_order);

CREATE TABLE IF NOT EXISTS public.backlog_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  start_date date,
  target_date date,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backlog_milestones_status_check CHECK (status = ANY (ARRAY['planned'::text, 'active'::text, 'completed'::text, 'archived'::text]))
);

CREATE INDEX idx_backlog_milestones_team_status ON public.backlog_milestones (team_id, status, target_date);

CREATE TABLE IF NOT EXISTS public.backlog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  display_id text NOT NULL,
  sequence_number integer NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'task',
  priority text NOT NULL DEFAULT 'medium',
  column_id uuid REFERENCES public.backlog_columns(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  parent_item_id uuid REFERENCES public.backlog_items(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES public.backlog_milestones(id) ON DELETE SET NULL,
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_provider text,
  external_id text,
  external_url text,
  sort_order numeric NOT NULL DEFAULT 1000,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backlog_items_type_check CHECK (type = ANY (ARRAY['bug'::text, 'feature'::text, 'task'::text, 'chore'::text])),
  CONSTRAINT backlog_items_priority_check CHECK (priority = ANY (ARRAY['urgent'::text, 'high'::text, 'medium'::text, 'low'::text])),
  CONSTRAINT backlog_items_not_own_parent CHECK (id IS DISTINCT FROM parent_item_id),
  CONSTRAINT backlog_items_team_sequence_key UNIQUE (team_id, sequence_number),
  CONSTRAINT backlog_items_team_display_key UNIQUE (team_id, display_id)
);

CREATE INDEX idx_backlog_items_team_column_order ON public.backlog_items (team_id, column_id, archived_at, sort_order);
CREATE INDEX idx_backlog_items_team_parent ON public.backlog_items (team_id, parent_item_id);
CREATE INDEX idx_backlog_items_team_assignee ON public.backlog_items (team_id, assignee_user_id);
CREATE INDEX idx_backlog_items_team_product ON public.backlog_items (team_id, product_id);

CREATE TABLE IF NOT EXISTS public.backlog_item_bug_links (
  backlog_item_id uuid NOT NULL REFERENCES public.backlog_items(id) ON DELETE CASCADE,
  bug_id text NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (backlog_item_id, bug_id)
);

CREATE UNIQUE INDEX idx_backlog_item_bug_links_primary_bug
  ON public.backlog_item_bug_links (team_id, bug_id)
  WHERE is_primary;

CREATE INDEX idx_backlog_item_bug_links_item ON public.backlog_item_bug_links (backlog_item_id);

CREATE TABLE IF NOT EXISTS public.backlog_item_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  backlog_item_id uuid NOT NULL REFERENCES public.backlog_items(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  text text NOT NULL,
  author text,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backlog_item_comments_item_created ON public.backlog_item_comments (backlog_item_id, created_at);

CREATE TABLE IF NOT EXISTS public.backlog_item_attachments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  backlog_item_id uuid NOT NULL REFERENCES public.backlog_items(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text,
  url text,
  type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backlog_item_attachments_item_created ON public.backlog_item_attachments (backlog_item_id, created_at);

ALTER TABLE public.bugs
  ADD COLUMN IF NOT EXISTS azure_url text,
  ADD COLUMN IF NOT EXISTS backlog_item_id uuid REFERENCES public.backlog_items(id) ON DELETE SET NULL;

UPDATE public.bugs
SET azure_url = backlog_url
WHERE azure_url IS NULL AND backlog_url IS NOT NULL;

CREATE INDEX idx_bugs_backlog_item_id ON public.bugs (team_id, backlog_item_id);

ALTER TABLE public.backlog_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog_item_bug_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog_item_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team scoped backlog_columns"
  ON public.backlog_columns
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

CREATE POLICY "Team scoped backlog_milestones"
  ON public.backlog_milestones
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

CREATE POLICY "Team scoped backlog_items"
  ON public.backlog_items
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

CREATE POLICY "Team scoped backlog_item_bug_links"
  ON public.backlog_item_bug_links
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

CREATE POLICY "Team scoped backlog_item_comments"
  ON public.backlog_item_comments
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

CREATE POLICY "Team scoped backlog_item_attachments"
  ON public.backlog_item_attachments
  TO authenticated
  USING (public.is_app_owner() OR public.is_team_member(team_id))
  WITH CHECK (public.is_app_owner() OR public.is_team_member(team_id));

GRANT ALL ON TABLE public.backlog_columns TO authenticated;
GRANT ALL ON TABLE public.backlog_columns TO service_role;
GRANT ALL ON TABLE public.backlog_milestones TO authenticated;
GRANT ALL ON TABLE public.backlog_milestones TO service_role;
GRANT ALL ON TABLE public.backlog_items TO authenticated;
GRANT ALL ON TABLE public.backlog_items TO service_role;
GRANT ALL ON TABLE public.backlog_item_bug_links TO authenticated;
GRANT ALL ON TABLE public.backlog_item_bug_links TO service_role;
GRANT ALL ON TABLE public.backlog_item_comments TO authenticated;
GRANT ALL ON TABLE public.backlog_item_comments TO service_role;
GRANT ALL ON TABLE public.backlog_item_attachments TO authenticated;
GRANT ALL ON TABLE public.backlog_item_attachments TO service_role;
GRANT ALL ON SEQUENCE public.backlog_item_comments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.backlog_item_comments_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.backlog_item_attachments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.backlog_item_attachments_id_seq TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.backlog_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.backlog_milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.backlog_items;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.backlog_item_bug_links;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.backlog_item_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.backlog_item_attachments;

CREATE OR REPLACE FUNCTION public.ensure_default_backlog_columns(target_team_id uuid)
  RETURNS SETOF public.backlog_columns
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
begin
  if not (public.is_app_owner() or public.is_team_member(target_team_id)) then
    raise exception 'Not allowed to initialize backlog columns for this team';
  end if;

  if not exists (
    select 1
    from public.backlog_columns
    where team_id = target_team_id
      and is_archived = false
  ) then
    insert into public.backlog_columns (team_id, name, sort_order, is_done, created_by)
    values
      (target_team_id, 'Backlog', 1000, false, auth.uid()),
      (target_team_id, 'Ready', 2000, false, auth.uid()),
      (target_team_id, 'In Progress', 3000, false, auth.uid()),
      (target_team_id, 'Review', 4000, false, auth.uid()),
      (target_team_id, 'Done', 5000, true, auth.uid());
  end if;

  return query
    select *
    from public.backlog_columns
    where team_id = target_team_id
      and is_archived = false
    order by sort_order, name;
end;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_backlog_columns(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_backlog_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE TRIGGER trg_touch_backlog_columns_updated_at
  BEFORE UPDATE ON public.backlog_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_backlog_updated_at();

CREATE TRIGGER trg_touch_backlog_milestones_updated_at
  BEFORE UPDATE ON public.backlog_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_backlog_updated_at();

CREATE TRIGGER trg_touch_backlog_items_updated_at
  BEFORE UPDATE ON public.backlog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_backlog_updated_at();

CREATE OR REPLACE FUNCTION public.complete_linked_bugs_when_backlog_done()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  done_column boolean;
begin
  select coalesce(is_done, false) into done_column
  from public.backlog_columns
  where id = new.column_id;

  if done_column and (TG_OP = 'INSERT' or old.column_id IS DISTINCT FROM new.column_id) then
    update public.bugs
    set reviewed = true
    where team_id = new.team_id
      and id in (
        select bug_id
        from public.backlog_item_bug_links
        where backlog_item_id = new.id
      );
  end if;

  return new;
exception when others then
  raise warning 'complete_linked_bugs_when_backlog_done failed: %', sqlerrm;
  return new;
end;
$$;

CREATE TRIGGER trg_complete_linked_bugs_when_backlog_done
  AFTER INSERT OR UPDATE OF column_id ON public.backlog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.complete_linked_bugs_when_backlog_done();

CREATE OR REPLACE FUNCTION public.sync_primary_bug_backlog_item()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'INSERT' or TG_OP = 'UPDATE' then
    if new.is_primary then
      update public.bugs
      set backlog_item_id = new.backlog_item_id
      where id = new.bug_id
        and team_id = new.team_id;
    end if;
    return new;
  end if;

  if old.is_primary then
    update public.bugs
    set backlog_item_id = null
    where id = old.bug_id
      and team_id = old.team_id
      and backlog_item_id = old.backlog_item_id;
  end if;

  return old;
exception when others then
  raise warning 'sync_primary_bug_backlog_item failed: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

CREATE TRIGGER trg_sync_primary_bug_backlog_item
  AFTER INSERT OR UPDATE OR DELETE ON public.backlog_item_bug_links
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_primary_bug_backlog_item();

CREATE OR REPLACE FUNCTION public.create_backlog_assignment_notifications()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  actor_id uuid := auth.uid();
  actor_label text := notification_actor_name();
begin
  if new.assignee_user_id is null then
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.assignee_user_id IS NOT DISTINCT FROM new.assignee_user_id then
    return new;
  end if;

  if actor_id is not null and new.assignee_user_id = actor_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.team_members
    where team_id = new.team_id
      and user_id = new.assignee_user_id
      and status = 'active'
  ) then
    return new;
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
    new.assignee_user_id,
    new.team_id,
    'backlog_assigned',
    actor_id,
    coalesce(actor_label, 'Someone'),
    'backlog_item',
    new.id::text,
    format('%s assigned you to %s', coalesce(actor_label, 'Someone'), new.display_id),
    new.title,
    format('/backlog?item=%s', new.display_id)
  );

  return new;
exception when others then
  raise warning 'create_backlog_assignment_notifications failed: %', sqlerrm;
  return new;
end;
$$;

CREATE TRIGGER trg_create_backlog_assignment_notifications
  AFTER INSERT OR UPDATE OF assignee_user_id ON public.backlog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_backlog_assignment_notifications();

CREATE OR REPLACE FUNCTION public.create_backlog_comment_mention_notifications()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
declare
  mentioned_user_id uuid;
  actor_id uuid := auth.uid();
  actor_label text := notification_actor_name();
  item_display_id text;
begin
  if coalesce(array_length(new.mentioned_user_ids, 1), 0) = 0 then
    return new;
  end if;

  select display_id into item_display_id
  from public.backlog_items
  where id = new.backlog_item_id;

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
      where team_id = new.team_id
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
      new.team_id,
      'backlog_comment_mention',
      actor_id,
      coalesce(actor_label, 'Someone'),
      'backlog_item_comment',
      new.id::text,
      format('%s mentioned you on %s', coalesce(actor_label, 'Someone'), coalesce(item_display_id, 'a backlog item')),
      left(new.text, 240),
      format('/backlog?item=%s', coalesce(item_display_id, new.backlog_item_id::text))
    );
  end loop;

  return new;
exception when others then
  raise warning 'create_backlog_comment_mention_notifications failed: %', sqlerrm;
  return new;
end;
$$;

CREATE TRIGGER trg_create_backlog_comment_mention_notifications
  AFTER INSERT ON public.backlog_item_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_backlog_comment_mention_notifications();

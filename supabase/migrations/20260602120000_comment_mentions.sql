ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

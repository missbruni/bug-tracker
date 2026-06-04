INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read attachments'
  ) THEN
    CREATE POLICY "Public read attachments"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'attachments');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated upload attachments'
  ) THEN
    CREATE POLICY "Authenticated upload attachments"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'attachments');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated delete attachments'
  ) THEN
    CREATE POLICY "Authenticated delete attachments"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'attachments');
  END IF;
END;
$$;

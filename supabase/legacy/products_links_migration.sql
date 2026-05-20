-- Allow products to store multiple labelled URLs.
-- Adds a 'links' jsonb column alongside the existing single 'link' column.
-- Stores an array of {label, url} objects.
-- Migrates any existing 'link' values into the new 'links' array.

alter table if exists products
  add column if not exists links jsonb default '[]';

-- Migrate existing single link into the jsonb array
update products
  set links = jsonb_build_array(jsonb_build_object('label', '', 'url', link))
  where link is not null
    and (links is null or links = '[]'::jsonb);

-- Ensure products table supports URL-derived domain allowlist and product metadata.
-- Safe to run multiple times.

alter table if exists products
  add column if not exists description text;

alter table if exists products
  add column if not exists link text;

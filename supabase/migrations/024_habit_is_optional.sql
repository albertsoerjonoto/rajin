-- Adds an is_optional flag so habits can be marked as nice-to-have. The
-- Dashboard collapses optional items by default and surfaces a small chevron
-- to expand them. RLS inherits from existing habits policies.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT false;

-- Adds a category dimension to habits so the dashboard can group items into
-- separate sections (Habits / Supplements / Skincare) while reusing every
-- existing habit code path (toggle, streak, reorder, share, edit, delete).

CREATE TYPE habit_category AS ENUM ('habit', 'supplement', 'skincare');

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS category habit_category NOT NULL DEFAULT 'habit';

-- Existing rows backfill to 'habit' via the DEFAULT — legacy data is unaffected.

CREATE INDEX IF NOT EXISTS idx_habits_user_category_sort
  ON public.habits (user_id, category, sort_order);

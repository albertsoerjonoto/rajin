-- Adds a "product" field to habits & habit_logs for supplement / skincare items.
-- The habit's `name` is the short display label shown on Overview & Friends
-- (e.g. "Multivitamin"); `product_name` holds the full brand + specific product
-- (e.g. "Thorne Basic Nutrients 2/Day"). On every toggle, the habit's current
-- product_name is snapshotted into the habit_logs row so we keep a per-day
-- record of exactly which product was taken — useful for Chat AI context and
-- long-term personal data even if the user later swaps brands.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS product_name TEXT;

ALTER TABLE public.habit_logs
  ADD COLUMN IF NOT EXISTS product_name TEXT;

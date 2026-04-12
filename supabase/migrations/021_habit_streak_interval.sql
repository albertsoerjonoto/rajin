-- Adds a per-habit configurable streak interval.
-- streak_interval_days represents the maximum allowed gap (in days) between
-- completions without breaking the streak. Default is 1 (traditional daily
-- habit). For example, a gym habit with streak_interval_days = 3 will keep
-- the streak alive as long as the user completes it at least once every 3
-- days. Each completion resets the cooldown.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS streak_interval_days INTEGER NOT NULL DEFAULT 1
    CHECK (streak_interval_days >= 1 AND streak_interval_days <= 30);

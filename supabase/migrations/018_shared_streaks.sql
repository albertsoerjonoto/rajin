-- Add friend_habit_id to shared_habits for linking the friend's copy of the habit
ALTER TABLE shared_habits ADD COLUMN IF NOT EXISTS friend_habit_id UUID REFERENCES habits;

-- Shared streaks table: tracks consecutive days BOTH users completed their linked habit
CREATE TABLE IF NOT EXISTS shared_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_habit_id UUID REFERENCES shared_habits NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_both_completed_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shared_streaks ENABLE ROW LEVEL SECURITY;

-- Users can see shared streaks for shared_habits they're part of
CREATE POLICY "Users can view own shared streaks" ON shared_streaks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_habits sh
      WHERE sh.id = shared_streaks.shared_habit_id
      AND (sh.owner_id = auth.uid() OR sh.friend_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert shared streaks" ON shared_streaks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_habits sh
      WHERE sh.id = shared_streaks.shared_habit_id
      AND (sh.owner_id = auth.uid() OR sh.friend_id = auth.uid())
    )
  );

CREATE POLICY "Users can update shared streaks" ON shared_streaks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shared_habits sh
      WHERE sh.id = shared_streaks.shared_habit_id
      AND (sh.owner_id = auth.uid() OR sh.friend_id = auth.uid())
    )
  );

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_shared_streaks_shared_habit ON shared_streaks (shared_habit_id);

-- Update feed_events constraint to include shared_streak_milestone
ALTER TABLE feed_events DROP CONSTRAINT IF EXISTS feed_events_event_type_check;
ALTER TABLE feed_events ADD CONSTRAINT feed_events_event_type_check
  CHECK (event_type IN (
    'habit_completed', 'streak_milestone', 'friend_added',
    'shared_habit_started', 'shared_streak',
    'exercise_completed', 'calorie_goal_met', 'protein_goal_met',
    'fat_goal_met', 'carbs_goal_met', 'water_goal_met',
    'shared_streak_milestone'
  ));

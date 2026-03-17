-- Add is_private column to habits
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Shared habits table
CREATE TABLE shared_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits NOT NULL,
  owner_id UUID REFERENCES auth.users NOT NULL,
  friend_id UUID REFERENCES auth.users NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shared_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shared habits" ON shared_habits FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = friend_id);

CREATE POLICY "Owners can insert shared habits" ON shared_habits FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Friend can update shared habit status" ON shared_habits FOR UPDATE
  USING (auth.uid() = friend_id);

CREATE POLICY "Owner or friend can delete shared habits" ON shared_habits FOR DELETE
  USING (auth.uid() = owner_id OR auth.uid() = friend_id);

-- Habit streaks (cached)
CREATE TABLE habit_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  habit_id UUID REFERENCES habits NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, habit_id)
);

ALTER TABLE habit_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks" ON habit_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view friend streaks for shared habits" ON habit_streaks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_habits sh
      WHERE sh.habit_id = habit_streaks.habit_id
      AND sh.status = 'accepted'
      AND (
        (sh.owner_id = auth.uid() AND sh.friend_id = habit_streaks.user_id) OR
        (sh.friend_id = auth.uid() AND sh.owner_id = habit_streaks.user_id)
      )
    )
  );

CREATE POLICY "Users can insert own streaks" ON habit_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks" ON habit_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own streaks" ON habit_streaks FOR DELETE
  USING (auth.uid() = user_id);

-- Feed events
CREATE TABLE feed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('habit_completed', 'streak_milestone', 'friend_added', 'shared_habit_started', 'shared_streak')),
  data JSONB NOT NULL DEFAULT '{}',
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feed events" ON feed_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view friend feed events" ON feed_events FOR SELECT
  USING (
    is_private = false AND
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = feed_events.user_id) OR
        (f.addressee_id = auth.uid() AND f.requester_id = feed_events.user_id)
      )
    )
  );

CREATE POLICY "Users can insert own feed events" ON feed_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed events" ON feed_events FOR DELETE
  USING (auth.uid() = user_id);

-- Add 'blocked' to friendships status check
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
ALTER TABLE friendships ADD CONSTRAINT friendships_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'rejected', 'blocked'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_feed_events_user_created ON feed_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_events_created ON feed_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_habit_streaks_habit ON habit_streaks (habit_id);
CREATE INDEX IF NOT EXISTS idx_shared_habits_habit ON shared_habits (habit_id);
CREATE INDEX IF NOT EXISTS idx_shared_habits_friend ON shared_habits (friend_id);

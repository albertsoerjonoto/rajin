-- Rename daily_calorie_goal to daily_calorie_offset
-- offset: 0 = maintenance, negative = deficit, positive = surplus
ALTER TABLE profiles RENAME COLUMN daily_calorie_goal TO daily_calorie_offset;
ALTER TABLE profiles ALTER COLUMN daily_calorie_offset SET DEFAULT 0;

-- Migrate existing data: convert old goal to offset
-- For users with body stats, offset = old_goal - estimated TDEE
-- For simplicity, just reset everyone to 0 (maintenance) since
-- the old "goal" number has different semantics than the new "offset"
UPDATE profiles SET daily_calorie_offset = 0;

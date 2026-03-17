-- Replace single daily_calorie_offset with min/max range columns
ALTER TABLE profiles ADD COLUMN calorie_offset_min integer NOT NULL DEFAULT -200;
ALTER TABLE profiles ADD COLUMN calorie_offset_max integer NOT NULL DEFAULT 200;

-- Migrate existing data from daily_calorie_offset
UPDATE profiles SET
  calorie_offset_min = CASE
    WHEN daily_calorie_offset = 0 THEN -200
    WHEN daily_calorie_offset < 0 THEN daily_calorie_offset
    ELSE daily_calorie_offset - 250
  END,
  calorie_offset_max = CASE
    WHEN daily_calorie_offset = 0 THEN 200
    WHEN daily_calorie_offset < 0 THEN daily_calorie_offset + 250
    ELSE daily_calorie_offset
  END;

-- Drop old column
ALTER TABLE profiles DROP COLUMN daily_calorie_offset;

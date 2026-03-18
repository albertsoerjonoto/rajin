-- Backfill habit_streaks from existing habit_logs data
-- This ensures all existing users see correct streak data immediately

-- Function to calculate and populate streaks for all users/habits
DO $$
DECLARE
  r RECORD;
  streak_count INTEGER;
  max_streak INTEGER;
  last_date DATE;
  check_date DATE;
  prev_date DATE;
BEGIN
  -- For each user+habit combo with completed logs
  FOR r IN
    SELECT DISTINCT user_id, habit_id
    FROM habit_logs
    WHERE completed = true
  LOOP
    -- Get the most recent completed date
    SELECT MAX(date) INTO last_date
    FROM habit_logs
    WHERE habit_id = r.habit_id AND user_id = r.user_id AND completed = true;

    -- Calculate current streak (consecutive days ending at last_date or yesterday)
    streak_count := 0;
    check_date := last_date;

    -- Only count as current streak if last completed is today or yesterday
    IF last_date >= CURRENT_DATE - INTERVAL '1 day' THEN
      LOOP
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM habit_logs
          WHERE habit_id = r.habit_id AND user_id = r.user_id
            AND date = check_date AND completed = true
        );
        streak_count := streak_count + 1;
        check_date := check_date - INTERVAL '1 day';
      END LOOP;
    END IF;

    -- Calculate longest streak
    max_streak := 0;
    DECLARE
      cur_streak INTEGER := 0;
      log_rec RECORD;
    BEGIN
      FOR log_rec IN
        SELECT DISTINCT date FROM habit_logs
        WHERE habit_id = r.habit_id AND user_id = r.user_id AND completed = true
        ORDER BY date ASC
      LOOP
        IF prev_date IS NOT NULL AND log_rec.date = prev_date + INTERVAL '1 day' THEN
          cur_streak := cur_streak + 1;
        ELSE
          cur_streak := 1;
        END IF;
        IF cur_streak > max_streak THEN
          max_streak := cur_streak;
        END IF;
        prev_date := log_rec.date;
      END LOOP;
    END;

    -- Upsert the streak
    INSERT INTO habit_streaks (user_id, habit_id, current_streak, longest_streak, last_completed_date, updated_at)
    VALUES (r.user_id, r.habit_id, streak_count, max_streak, last_date, NOW())
    ON CONFLICT (user_id, habit_id)
    DO UPDATE SET
      current_streak = EXCLUDED.current_streak,
      longest_streak = GREATEST(habit_streaks.longest_streak, EXCLUDED.longest_streak),
      last_completed_date = EXCLUDED.last_completed_date,
      updated_at = NOW();

    prev_date := NULL;
  END LOOP;
END;
$$;

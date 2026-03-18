-- Add new feed event types for exercises and goal achievements
ALTER TABLE feed_events DROP CONSTRAINT IF EXISTS feed_events_event_type_check;
ALTER TABLE feed_events ADD CONSTRAINT feed_events_event_type_check
  CHECK (event_type IN (
    'habit_completed', 'streak_milestone', 'friend_added',
    'shared_habit_started', 'shared_streak',
    'exercise_completed', 'calorie_goal_met', 'protein_goal_met',
    'fat_goal_met', 'carbs_goal_met', 'water_goal_met'
  ));

-- Update get_friend_activity RPC to filter out private habits
CREATE OR REPLACE FUNCTION get_friend_activity(for_date DATE)
RETURNS TABLE (
  activity_type TEXT,
  friend_id UUID,
  friend_display_name TEXT,
  friend_avatar_url TEXT,
  description TEXT,
  detail TEXT,
  logged_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH friend_ids AS (
    SELECT CASE
      WHEN requester_id = auth.uid() THEN addressee_id
      ELSE requester_id
    END AS fid
    FROM friendships
    WHERE (requester_id = auth.uid() OR addressee_id = auth.uid())
    AND status = 'accepted'
  )
  -- Food logs
  SELECT 'food'::TEXT, fl.user_id, p.display_name, p.avatar_url,
    fl.meal_type::TEXT, fl.description, fl.created_at
  FROM food_logs fl
  JOIN friend_ids fi ON fl.user_id = fi.fid
  JOIN profiles p ON fl.user_id = p.id
  WHERE fl.date = for_date

  UNION ALL

  -- Exercise logs
  SELECT 'exercise'::TEXT, el.user_id, p.display_name, p.avatar_url,
    el.exercise_type, el.duration_minutes || ' min', el.created_at
  FROM exercise_logs el
  JOIN friend_ids fi ON el.user_id = fi.fid
  JOIN profiles p ON el.user_id = p.id
  WHERE el.date = for_date

  UNION ALL

  -- Drink logs
  SELECT 'drink'::TEXT, dl.user_id, p.display_name, p.avatar_url,
    dl.drink_type::TEXT, dl.description, dl.created_at
  FROM drink_logs dl
  JOIN friend_ids fi ON dl.user_id = fi.fid
  JOIN profiles p ON dl.user_id = p.id
  WHERE dl.date = for_date

  UNION ALL

  -- Habit logs (completed only, exclude private habits)
  SELECT 'habit'::TEXT, hl.user_id, p.display_name, p.avatar_url,
    h.emoji || ' ' || h.name, 'Completed', hl.created_at
  FROM habit_logs hl
  JOIN friend_ids fi ON hl.user_id = fi.fid
  JOIN profiles p ON hl.user_id = p.id
  JOIN habits h ON hl.habit_id = h.id
  WHERE hl.date = for_date AND hl.completed = true
    AND h.is_private = false

  ORDER BY logged_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

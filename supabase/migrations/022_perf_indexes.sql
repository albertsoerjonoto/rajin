-- Performance indexes for the hot paths surfaced during the perf audit.
-- All are CREATE INDEX IF NOT EXISTS so re-running is safe.

-- AppLayout fetches pending friend request count on every mount:
--   .from('friendships').eq('addressee_id', user.id).eq('status', 'pending')
-- Without this composite, Postgres scans by addressee_id and re-checks status
-- per row. Composite gives a single index probe.
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status
  ON friendships (addressee_id, status);

-- Symmetric query (requester-side listings of own outgoing requests).
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status
  ON friendships (requester_id, status);

-- Dashboard habits load: .eq('user_id', _).eq('is_active', true).order('sort_order')
-- The existing idx_habits_user_id index satisfies user_id but forces a sort.
-- This composite lets the planner stream rows in sort order.
CREATE INDEX IF NOT EXISTS idx_habits_user_active_sort
  ON habits (user_id, is_active, sort_order);

-- Share modal fetch: .from('shared_habits').or(owner_id=_, friend_id=_)
-- With status filter on accepted shares.
CREATE INDEX IF NOT EXISTS idx_shared_habits_owner_status
  ON shared_habits (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_shared_habits_friend_status
  ON shared_habits (friend_id, status);

-- Feed events delete-by-user-and-day during habit untoggle.
CREATE INDEX IF NOT EXISTS idx_feed_events_user_type_created
  ON feed_events (user_id, event_type, created_at);

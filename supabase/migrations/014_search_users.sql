-- Replace search_users_by_username with a more flexible search function
-- Supports: exact username, exact email, display name prefix autocomplete
CREATE OR REPLACE FUNCTION search_users(search_term TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id, p.username, p.display_name, p.avatar_url
  FROM profiles p
  WHERE p.id != auth.uid()
  AND (
    -- Exact username match (case-insensitive)
    p.username ILIKE search_term
    -- Exact email match (case-insensitive)
    OR p.email ILIKE search_term
    -- Display name prefix autocomplete (only if 4+ chars)
    OR (LENGTH(search_term) >= 4 AND p.display_name ILIKE search_term || '%')
    -- Partial username match
    OR p.username ILIKE '%' || search_term || '%'
  )
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

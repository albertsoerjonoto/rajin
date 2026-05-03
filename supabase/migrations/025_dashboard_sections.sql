-- Add per-user dashboard section visibility/order config.
-- NULL means "use defaults" so existing users see no behavior change.
-- Stored as a JSONB array of { id: string, visible: boolean }.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS dashboard_sections jsonb;

COMMENT ON COLUMN profiles.dashboard_sections IS
  'Ordered list of dashboard sections with visibility, e.g. [{"id":"habits","visible":true}, ...]. NULL = client-side defaults.';

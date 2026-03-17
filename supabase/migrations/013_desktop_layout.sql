-- Add desktop layout preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desktop_layout text NOT NULL DEFAULT 'expanded';

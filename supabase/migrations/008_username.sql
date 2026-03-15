-- Add username column to profiles
ALTER TABLE profiles ADD COLUMN username TEXT DEFAULT NULL;

-- Case-insensitive unique index for username lookups
CREATE UNIQUE INDEX idx_profiles_username ON profiles (LOWER(username));

-- Add locale column to profiles for multi-language support
ALTER TABLE profiles ADD COLUMN locale TEXT NOT NULL DEFAULT 'id' CHECK (locale IN ('id', 'en'));

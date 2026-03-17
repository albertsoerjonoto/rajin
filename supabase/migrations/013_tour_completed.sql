-- Add tour_completed column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_completed boolean DEFAULT false;

-- Existing users who completed onboarding don't need the tour
UPDATE profiles SET tour_completed = true WHERE onboarding_completed = true;

-- RLS: users can already read/update their own profile row via existing policies

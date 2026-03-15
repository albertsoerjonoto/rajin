-- Add onboarding flag to profiles
ALTER TABLE profiles
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing users as onboarded so they skip the wizard
UPDATE profiles SET onboarding_completed = true;

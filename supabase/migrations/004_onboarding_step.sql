-- Track which onboarding step the user is on (0-3), so they resume where they left off
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;

-- Existing users who completed onboarding should have step 4 (past final step)
UPDATE profiles SET onboarding_step = 4 WHERE onboarding_completed = true;

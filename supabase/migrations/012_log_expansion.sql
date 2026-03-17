-- 012_log_expansion.sql
-- Add logged_at timestamps to all log tables + measurement_logs table

-- Add logged_at to existing tables
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE drink_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE habit_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows
UPDATE food_logs SET logged_at = created_at WHERE logged_at IS NULL;
UPDATE exercise_logs SET logged_at = created_at WHERE logged_at IS NULL;
UPDATE drink_logs SET logged_at = created_at WHERE logged_at IS NULL;
UPDATE habit_logs SET logged_at = created_at WHERE logged_at IS NULL;

-- Create measurement_logs table
CREATE TABLE IF NOT EXISTS measurement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT now(),
  height_cm NUMERIC,
  weight_kg NUMERIC,
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'chat')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for measurement_logs
ALTER TABLE measurement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own measurement_logs"
  ON measurement_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurement_logs"
  ON measurement_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurement_logs"
  ON measurement_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurement_logs"
  ON measurement_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Add parsed_measurements and measurement_edits to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS parsed_measurements JSONB DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS measurement_edits JSONB DEFAULT NULL;

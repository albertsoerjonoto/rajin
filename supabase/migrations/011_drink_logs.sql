-- Create drink_type enum
CREATE TYPE drink_type AS ENUM ('water', 'coffee', 'tea', 'juice', 'soda', 'milk', 'other');

-- Create drink_logs table
CREATE TABLE drink_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date date NOT NULL,
  drink_type drink_type NOT NULL DEFAULT 'water',
  description text NOT NULL,
  volume_ml integer NOT NULL DEFAULT 0,
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  source log_source NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE drink_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own drink logs"
  ON drink_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drink logs"
  ON drink_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drink logs"
  ON drink_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drink logs"
  ON drink_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_drink_logs_user_date ON drink_logs (user_id, date);

-- Add water goal to profiles
ALTER TABLE profiles ADD COLUMN daily_water_goal_ml integer NOT NULL DEFAULT 2000;

-- Add drink columns to chat_messages
ALTER TABLE chat_messages ADD COLUMN parsed_drinks jsonb;
ALTER TABLE chat_messages ADD COLUMN drink_edits jsonb;

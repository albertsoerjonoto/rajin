-- Add body stats columns to profiles for caloric calculations
CREATE TYPE gender_type AS ENUM ('male', 'female');

ALTER TABLE profiles
  ADD COLUMN date_of_birth DATE,
  ADD COLUMN gender gender_type,
  ADD COLUMN height_cm NUMERIC(5,1),
  ADD COLUMN weight_kg NUMERIC(5,1);

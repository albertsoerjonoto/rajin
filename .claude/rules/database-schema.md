---
description: Database schema reference for Supabase PostgreSQL tables
globs: ["**/*.ts", "**/*.tsx", "supabase/**"]
---

# Database Schema (Supabase PostgreSQL)

## Tables

### profiles
- id (uuid, references auth.users)
- email
- display_name
- daily_calorie_goal (default 2000)
- created_at

### habits
- id (uuid), user_id, name, emoji
- frequency (daily/weekly)
- is_active (default true)
- sort_order, created_at

### habit_logs
- id (uuid), habit_id, user_id, date
- completed (boolean), created_at
- Unique constraint on (habit_id, date)

### food_logs
- id (uuid), user_id, date
- meal_type (breakfast/lunch/dinner/snack)
- description, calories, protein_g, carbs_g, fat_g
- source (manual/chat), created_at

### exercise_logs
- id (uuid), user_id, date
- exercise_type, duration_minutes, calories_burned
- notes, source (manual/chat), created_at

All tables use RLS so users only access their own data.

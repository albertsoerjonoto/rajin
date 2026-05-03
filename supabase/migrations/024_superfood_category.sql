-- Add 'superfood' to habit_category enum so the dashboard can render a
-- fourth section (Superfoods) for items like EVOO, berries, eggs, nuts, green tea.
ALTER TYPE habit_category ADD VALUE IF NOT EXISTS 'superfood';

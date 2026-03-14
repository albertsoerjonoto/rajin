# Rajin — Daily Habit, Food & Exercise Tracker

## Project Overview
Mobile-first PWA for tracking daily habits, food intake, and exercise. Built for a solo founder. Indonesian food knowledge is a key feature via Gemini AI chat.

## Tech Stack
- **Framework**: Next.js 14+ (App Router), TypeScript
- **Styling**: Tailwind CSS
- **Backend/Auth**: Supabase (email/password auth, PostgreSQL, real-time)
- **AI**: Google Gemini 2.5 Flash API for natural language food/exercise parsing
- **PWA**: Installable via Add to Home Screen (iOS/Android)
- **Deploy**: Vercel

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `GEMINI_API_KEY` — Google Gemini API key

## Database Schema (Supabase PostgreSQL)

### Tables
- **profiles**: id (uuid, refs auth.users), email, display_name, daily_calorie_goal (default 2000), created_at
- **habits**: id (uuid), user_id, name, emoji, frequency (daily/weekly), is_active (default true), sort_order, created_at
- **habit_logs**: id (uuid), habit_id, user_id, date, completed (boolean), created_at. Unique constraint on (habit_id, date)
- **food_logs**: id (uuid), user_id, date, meal_type (breakfast/lunch/dinner/snack), description, calories, protein_g, carbs_g, fat_g, source (manual/chat), created_at
- **exercise_logs**: id (uuid), user_id, date, exercise_type, duration_minutes, calories_burned, notes, source (manual/chat), created_at

All tables use RLS so users only access their own data.

## Pages (Bottom Tab Nav)
1. **Dashboard** — Today's habits (tap to toggle), food summary (calories vs goal progress bar), exercise summary, date navigator
2. **Log** — Food and exercise entry lists with + button, forms for manual entry
3. **Chat** — Natural language input → Gemini parses food/exercise → confirm/edit cards → save
4. **Profile** — Display name, calorie goal, sign out

## Design
- Mobile-first (375px base)
- White background, soft rounded cards, subtle shadows
- Accent: emerald green (#10b981)
- Aesthetic: Apple Health meets Notion
- Smooth animations on interactions
- Calm and encouraging tone

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — Lint code

## Project Structure
```
src/
  app/
    (auth)/login/page.tsx    — Login page
    (auth)/signup/page.tsx   — Signup page
    (app)/dashboard/page.tsx — Dashboard
    (app)/log/page.tsx       — Log entries
    (app)/chat/page.tsx      — AI chat
    (app)/profile/page.tsx   — Profile settings
    (app)/layout.tsx         — App layout with bottom nav
    api/parse/route.ts       — Gemini API endpoint
    layout.tsx               — Root layout
  components/                — Reusable UI components
  lib/
    supabase/               — Supabase client setup
    types.ts                — TypeScript types
  hooks/                    — Custom React hooks
supabase/
  migrations/               — SQL migration files
public/
  icons/                    — PWA icons
  manifest.json             — PWA manifest
```

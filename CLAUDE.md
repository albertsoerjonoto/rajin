# Rajin — Daily Habit, Food & Exercise Tracker

## Project Overview
Mobile-first PWA for tracking daily habits, food intake, and exercise. Built for a solo founder. Indonesian food knowledge is a key feature via Gemini AI chat.

## Tech Stack
- **Framework**: Next.js 14+ (App Router), TypeScript
- **Styling**: Tailwind CSS v4
- **Backend/Auth**: Supabase (email/password auth, PostgreSQL, real-time)
- **AI**: Google Gemini 2.5 Flash API for natural language food/exercise parsing
- **PWA**: Installable via Add to Home Screen (iOS/Android)
- **Deploy**: Vercel

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `GEMINI_API_KEY` — Google Gemini API key

## Commands
- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npm run lint` — Lint code

## Pages (Bottom Tab Nav)
1. **Dashboard** — Today's habits (tap to toggle), food summary (calories vs goal), exercise summary, date navigator
2. **Log** — Food and exercise entry lists with + button, manual entry forms
3. **Chat** — Natural language input → Gemini parses food/exercise → confirm/edit → save
4. **Profile** — Display name, calorie goal, sign out

## Conventions
- Use `'use client'` only when component needs browser APIs or hooks
- Prefer Supabase server client in Server Components, browser client in Client Components
- All database queries go through RLS — never use service_role key in client code
- Tailwind only — no inline styles, no CSS modules
- Mobile-first: design for 375px base, then scale up
- Use `dvh` not `vh` for full-height layouts (iOS Safari fix)
- Toast component at `@/components/Toast` for user feedback
- Date navigation component at `@/components/DateNavigator` for date selection

## Design
- White background, soft rounded cards, subtle shadows
- Accent: emerald green (#10b981)
- Aesthetic: Apple Health meets Notion
- Smooth animations, calm and encouraging tone

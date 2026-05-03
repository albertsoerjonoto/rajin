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

## Per-PR Workflow (REQUIRED — do not skip)

Every code-change PR must go through this loop end-to-end before being handed to the user for merge. Do NOT mark a PR "ready" or ask for merge until every applicable step has run clean.

1. Edit + `npm run build` — TypeScript + lint must pass
2. Local verification via `preview_*` tools — exercise the changed feature in the dev server, check console + network for regressions (skip only if the change isn't observable in a browser, e.g. types-only)
3. Commit + `git push` to a feature branch (never to `main`)
4. `gh pr create` — open the PR
5. `/review` — runs structural diff review (SQL safety, auth, side effects, trust boundaries). Fix anything it flags, push, re-run until clean.
6. Wait for the Vercel preview deploy to be live (`gh pr checks` or watch for the preview URL comment on the PR)
7. `/browse` against the preview URL — smoke-test the changed feature (golden path + edge cases) and look for regressions in unrelated tabs
8. `/qa` against the preview URL — broad regression sweep across all top-level routes. /qa will commit fixes atomically; re-run until it reports clean.
9. Hand the PR to the user for merge — never `gh pr merge` yourself unless explicitly asked
10. After user merges + prod deploys, re-verify on production (for perf PRs: re-measure against the baseline; for feature PRs: smoke-test the live URL), THEN start the next PR

If a step doesn't apply (e.g. `/browse` on a pure types-only PR, or `/qa` on a backend-only migration), say so explicitly in the PR body or your end-of-turn summary — don't silently skip.

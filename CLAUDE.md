# Rajin — Daily Habit, Food & Exercise Tracker

Mobile-first PWA for tracking habits, food, and exercise. Built for a solo founder. Indonesian food parsing via Gemini chat.

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack), TypeScript, React 19
- **Styling**: Tailwind CSS v4
- **Backend/Auth**: Supabase (email/password, PostgreSQL with RLS, real-time)
- **AI**: Google Gemini 2.5 Flash (server-only, in `/api/parse` and `/api/transcribe`)
- **PWA**: stale-while-revalidate service worker, installable
- **Deploy**: Vercel (push-to-deploy from `main`)

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`
- Server/CI only: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`. **NEVER reference these from client code.**

## Commands
- `npm run dev` — dev server (port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck
- `npm run test` — Vitest (unit, when wired)
- `npm run test:e2e` — Playwright (smoke flows, when wired)
- `npx lhci autorun` — Lighthouse CI against budgets

## Pages
1. **Dashboard** (`/dashboard`) — habits grid, day/week/month/year analytics, food + exercise summaries
2. **Log** (`/log`) — manual entry forms for food/exercise/drinks/measurements
3. **Chat** (`/chat`) — Gemini-parsed natural-language entry
4. **Friends** (`/friends`) — shared habits + streaks
5. **Profile** (`/profile`) — settings, body stats, sign out

---

<important>

## Workflow Doctrine

These rules apply to every session, even when the user gives a terse prompt.

- **Plan-mode first** for non-trivial work. Use AskUserQuestion to disambiguate. ExitPlanMode to start. (Karpathy: think before coding.)
- **Surgical changes**: every diff line must trace to the request. No drive-by refactors. (Karpathy.)
- **Boil the lake**: when the delta is small, prefer the complete fix over the 90% shortcut. No half-implementations. (gstack.)
- **Search before building**: grep for existing utils, hooks, helpers before writing new ones. Reuse > write.
- **Squash-merge**, PRs ≤ 150 lines, commit hourly.
- **New task = new session**. Manual `/compact` near 40% context.
- **Default to no comments**. Only document the *why* when non-obvious.
- **Never** `--no-verify`, `--no-gpg-sign`, `git push --force` to `main`, or `git reset --hard` on shared refs.

## Autonomous Loop Protocol

If the working tree is clean and there is no active user request, run this loop until you get stuck or the queue is empty:

```
1. Read .claude/queue.md. If empty, run /retro to find the next gap.
2. Pop the top task. Plan-mode it. ExitPlanMode.
3. Implement on a fresh branch (never on main).
4. Verify locally:
     npm run lint
     npx tsc --noEmit
     npm run test
     npm run build
   All four must pass before pushing.
5. Commit (Conventional Commits style). Push.
6. gh pr create — include before/after Lighthouse if perf-relevant.
7. Wait on `gh pr checks --watch`. If green, run /review against the diff.
8. If /review reports zero blockers AND CI green AND no Hard-Stop trigger:
     gh pr merge --squash --auto --delete-branch
   Otherwise post a comment summarizing blockers and stop.
9. After merge: pull main, kick the nightly-perf workflow, watch result.
   If perf regressed vs last-known-good, prepend a follow-up task to the queue.
10. Loop. If 3 consecutive iterations fail to make progress, post status
    on the latest PR and stop — do not thrash.
```

**Hard-Stop triggers** (loop pauses; ask user before merging):
- Touches `auth`, `middleware`, RLS policies, or `service_role` references
- Schema migration that DROPs a column/table or changes a primary key
- Env var rotation, new third-party integration, billing-touching code
- `/review` returns severity ≥ "high"

</important>

## Performance Budgets

Every PR that changes any code under `src/app/**` or `src/components/**` must clear:

| Gate | Target | How measured |
|---|---|---|
| Lighthouse Performance | ≥ 95 mobile | `@lhci/cli` in CI |
| LCP | < 1500 ms | Lighthouse |
| TBT | < 200 ms | Lighthouse |
| First-load JS per route | < 200 KB gz | `next build` parsed by `scripts/check-bundle.mjs` |
| Lint + typecheck | 0 errors | `eslint` + `tsc --noEmit` |
| Unit tests | 100% pass | Vitest |
| E2E smoke | 100% pass | Playwright |

A regression on any gate blocks merge. If the gate isn't yet wired in CI, run it locally before opening the PR and paste the numbers in the description.

## Verification Workflow (gstack)

For UI changes: `preview_start` → reload → `preview_console_logs` (errors) → `preview_snapshot` (content) → `preview_click`/`preview_fill` to exercise → `preview_screenshot` for the PR description. Never ask the user to verify manually — verify and ship proof.

## Conventions

- `'use client'` only when needed (browser APIs, hooks).
- Server Components → `@/lib/supabase/server` `createClient()`. Client → `@/lib/supabase/client` `createClient()` (singleton).
- All DB access via RLS — never service_role from the client.
- Tailwind only — no inline styles, no CSS modules.
- Mobile-first (375px base). `dvh` not `vh`. Use the existing scroll container; never `overflow:hidden` on `<body>`.
- Dynamic-import any component over ~30KB or behind a conditional view.
- Auth state via `useAuth()` (reads from `AuthContext`). Never call `supabase.auth.getUser()` in component code — that's a network round-trip.
- Toasts via `@/components/Toast`. Date nav via `@/components/DateNavigator`.

## Design

- White surface, rounded cards, soft shadows. Accent: emerald (#10b981).
- Aesthetic: Apple Health × Notion. Calm, encouraging tone.
- Animations subtle and snappy — never block input.

## Where to look

- Detailed rules: `.claude/rules/*.md` (auto-loaded when paths match — see frontmatter).
- The autonomous queue: `.claude/queue.md`.
- The portable prompt for cloning this workflow elsewhere: `.claude/PORTABLE-PROMPT.md`.
- iOS PWA gotchas: `.claude/rules/ios-pwa-gotchas.md`.
- DB schema reference: `.claude/rules/database-schema.md`.
- Supabase patterns: `.claude/rules/supabase-patterns.md`.

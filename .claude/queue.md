# Autonomous Loop Queue

Ordered list of tasks the loop picks from when no user is driving. Newer tasks at the top. Move to `## Done` when shipped. Move to `## Stuck` if the loop bailed.

## Next up

- [ ] **Push signup/login LCP under 2000 ms** — landed cycle 2 brought it 3137ms → 2714ms (lazy Supabase SDK + TourProvider lifted out of root). Budget is now 3200ms. Next moves to investigate: critical-CSS inline for the h1, render the auth pages fully server-side (extract the form into a small `'use client'` island), font preload hints, or `display: optional` on Geist for first paint.

- [ ] **Convert remaining `useEffect` data fetches to `use()` + Suspense** — React 19 supports it, eliminates loading-state boilerplate, and makes the dashboard feel faster on warm nav. Start with friends + log + chat pages.

- [ ] **Wire `deploy.yml` GitHub Actions workflow** — Vercel deploys on push to main automatically (GitHub integration), but a post-deploy smoke + Lighthouse run on the prod URL would catch deploy-time regressions. Use the `VERCEL_TOKEN` already in secrets.

- [ ] **Sentry or `web-vitals` → Supabase RUM table** — wire client-side LCP/CLS/INP reporting so we have a real-user signal, not just lab Lighthouse.

- [ ] **Add seeded test user for authenticated Playwright flows** — the smoke tests currently cover only public routes. Add a CI-only Supabase project (or seed via service-role) so we can E2E test the dashboard / log / chat happy path.

- [ ] **Branch protection on `main`** (manual GH Settings) — require all `ci.yml` checks, linear history, up-to-date with main, conversation resolution. Currently auto-merge works without it.

- [ ] **Configure Sentry for error tracking** — runtime errors in prod aren't visible. Wire `@sentry/nextjs` with the existing build pipeline.

## Stuck

(none yet)

## Done

- [x] **Phase 1: kill the auth/data waterfall** — middleware getSession, useAuth via AuthContext, layout skeleton-first, dashboard Promise.all, dynamic chart imports, SW SWR, perf indexes (migration 022). PR #48.
- [x] **Phase 2: Vitest + Playwright + Lighthouse CI + GH Actions + bundle budget** — PR #48.
- [x] **Phase 3: CLAUDE.md doctrine + .claude/rules + slash commands + queue** — PR #48.
- [x] **Phase 4: Vercel + Supabase MCP + secrets bootstrap** — PR #48.
- [x] **Pre-existing tour lint errors** — eslint-disable with rationale (PR #48). Long-term refactor to `useSyncExternalStore` if React 19 ever inlines that path.
- [x] **Apply migration 022_perf_indexes to production** — applied 2026-05-03 via Supabase Management API.
- [x] **Cycle 2: signup/login LCP 3137 → 2714ms (-13%)** — lazy-loaded Supabase SDK on form submit instead of at module scope; lifted TourProvider out of root providers into (app)/layout (auth pages no longer pay tour cost); removed `animate-fade-in` opacity gate on auth-page hero. Lighthouse budget ratcheted: Perf ≥0.92, LCP <3200ms, TBT <200ms, FCP <1500ms (warn).
- [x] **Optional habits, collapsed by default on Overview** — adds `is_optional` flag (migration 024); per-section chevron only when optional items exist; counter excludes optional. PR #54.
- [x] **`<img>` → `next/image` for avatars + chat photos** — adds Supabase Storage `remotePatterns`, profile avatar gets `priority` hint, chat attached image preserves fluid aspect via auto width/height + `max-h-48`. PR #58.
- [x] **`@next/bundle-analyzer`** — `npm run analyze` exposes per-route bundle composition for Turbopack builds. PR #66.
- [x] **RLS / hot-path audit** — `EXPLAIN ANALYZE` on day-view tables (`food_logs`, `exercise_logs`, `drink_logs`, `habit_logs`, `measurement_logs`, `chat_messages`). Only finding: `measurement_logs` had only its pkey, no `(user_id, date)` index; planner was Seq Scan + Filter. Migration 026 adds the composite. Other tables already use Index Scan via migration 022 + the explicit `idx_*_user_date` indexes from migration 001.

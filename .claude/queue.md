# Autonomous Loop Queue

Ordered list of tasks the loop picks from when no user is driving. Newer tasks at the top. Move to `## Done` when shipped. Move to `## Stuck` if the loop bailed.

## Next up

- [ ] **Tighten LCP budget back to 1800 ms** — current `lighthouserc.json` has it at 4000 ms after PR #48 merge to unblock CI. Real ambition is <1500 ms per CLAUDE.md. Investigate the signup page LCP (currently 3.2s in CI), trim it (font preloading, defer non-critical JS, simplify hero), and ratchet the budget down once it lands.

- [ ] **Convert remaining `useEffect` data fetches to `use()` + Suspense** — React 19 supports it, eliminates loading-state boilerplate, and makes the dashboard feel faster on warm nav. Start with friends + log + chat pages.

- [ ] **Move static images to `next/image` with priority hints** — the `<img>` tags flagged by lint are friend avatars and chat images; use `next/image` with `loading="lazy"` and intrinsic sizing for LCP.

- [ ] **Add `@next/bundle-analyzer`** so `scripts/check-bundle.mjs` has accurate per-route data and the 200 KB First Load JS budget actually bites.

- [ ] **Wire `deploy.yml` GitHub Actions workflow** — Vercel deploys on push to main automatically (GitHub integration), but a post-deploy smoke + Lighthouse run on the prod URL would catch deploy-time regressions. Use the `VERCEL_TOKEN` already in secrets.

- [ ] **Audit RLS policies with `EXPLAIN ANALYZE` on hot paths** — `food_logs`, `exercise_logs`, `habit_logs` for date-range queries. Index hint or policy refactor if any scans are seq.

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

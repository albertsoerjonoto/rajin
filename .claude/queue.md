# Autonomous Loop Queue

Ordered list of tasks the loop picks from when no user is driving. Newer tasks at the top. Move to `## Done` when shipped. Move to `## Stuck` if the loop bailed.

## Next up

- [ ] **Wire Vitest + Playwright + Lighthouse CI** — install deps, add `vitest.config.ts`, `playwright.config.ts`, `lighthouserc.json`, smoke tests for the golden path. Without this, the perf budgets in `CLAUDE.md` aren't enforceable. See plan: `~/.claude/plans/loading-the-pages-are-temporal-pinwheel.md` Phase 2.

- [ ] **Add `.github/workflows/{ci,deploy,nightly-perf}.yml`** — gate every PR, auto-deploy on main, nightly perf trend. PR template at `.github/pull_request_template.md`.

- [ ] **`scripts/check-bundle.mjs`** — parse `next build` output, fail if any route's First Load JS > 200 KB. Wire into `ci.yml`.

- [ ] **Vercel + Supabase MCP** — once user provides `VERCEL_TOKEN` + `SUPABASE_ACCESS_TOKEN` in `~/.config/rajin/secrets.env`, write `.mcp.json` + `scripts/bootstrap-secrets.sh` to verify them.

- [ ] **Pre-existing lint errors in tour components** — `src/components/tour/TourBubble.tsx:25` and `src/components/tour/TourProvider.tsx:70` use `setState` synchronously inside an effect. React 19 lint flags it. Refactor to `useSyncExternalStore` or a transition. Currently blocks CI lint.

- [ ] **Convert remaining `useEffect` data fetches to `use()` + Suspense** — React 19 supports it, eliminates loading-state boilerplate, and makes the dashboard feel faster on warm nav.

- [ ] **Move static images to `next/image` with priority hints** — the `<img>` tags flagged by lint are friend avatars; use `next/image` with `loading="lazy"` and intrinsic sizing for LCP.

- [ ] **Audit RLS policies with `EXPLAIN ANALYZE` on hot paths** — `food_logs`, `exercise_logs`, `habit_logs` for date-range queries. Index hint or policy refactor if any scans are seq.

- [ ] **Sentry or `web-vitals` → Supabase RUM table** — wire client-side LCP/CLS/INP reporting so we have a real-user signal, not just lab Lighthouse.

## Stuck

(none yet)

## Done

(empty — populated by the loop)

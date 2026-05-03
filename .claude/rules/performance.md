---
paths: "src/app/**, src/components/**, next.config.*, public/sw.js"
---

# Performance Rules

Every change in these paths is gated by the Performance Budgets in `CLAUDE.md`. Follow these patterns so the gate stays green.

## Data fetching

- **Batch with `Promise.all`** when fetches are independent. Serial `await` chains are the #1 cause of the slow-page bug we already fixed.
- **Lift invariants out of effects** — fetch a profile/config once per user, not on every date flip.
- **Auth state via `useAuth()`** — never `supabase.auth.getUser()` in components (network round-trip). Use `getSession()` for cookie reads if you must.

## Bundle size

- **Dynamic-import** any component over ~30KB or hidden behind a tab/conditional. Use `next/dynamic` with `ssr: false` and a skeleton `loading`.
- **Server-only deps stay server-only.** Anything in `src/app/api/**` cannot leak into client bundles. Don't `import` AI SDKs or DB drivers from a client component.
- **Tree-shake**: prefer named imports over default-everything. Confirm with the route bundle table from `next build`.
- `experimental.optimizePackageImports` in `next.config.ts` covers the heavy libs we already use (recharts, dnd-kit). Add new heavy libs there too.

## Caching

- Hashed `_next/static/*` assets get `Cache-Control: public, max-age=31536000, immutable` (already configured).
- Service worker uses stale-while-revalidate. Bump `CACHE_VERSION` in `public/sw.js` when the shell changes shape.
- Page-level `revalidate = N` only for genuinely stale-OK content (not user data).

## Database

- Every hot query needs an index that covers all `.eq()` predicates AND the `.order()` column.
- Composite (col_a, col_b, col_c) indexes serve queries on (col_a), (col_a, col_b), (col_a, col_b, col_c) — not (col_b) alone. Order matters.
- Run `EXPLAIN ANALYZE` on any new query that scans > 1000 rows in prod.
- New migration → add the index in the same file as the schema change.

## Verification before merge

For any UI change, paste in the PR description:
- Lighthouse run output (perf, LCP, TBT) before vs after.
- `next build` route table snippet showing First Load JS for the touched route, before vs after.
- Screenshot of the touched UI before vs after.

If a number got worse, the PR doesn't merge until you fix it or justify it.

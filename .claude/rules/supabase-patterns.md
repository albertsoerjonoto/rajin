---
description: Supabase usage patterns, RLS rules, and migration conventions
globs: ["**/supabase/**", "**/lib/supabase/**", "**/*.sql"]
---

# Supabase Patterns

## Client Usage
- Server Components / Route Handlers → use `createClient()` from `@/lib/supabase/server`
- Client Components → use `createBrowserClient()` from `@/lib/supabase/client`
- Never use the service_role key in client-side code

## RLS (Row Level Security)
- Every table has RLS enabled
- All policies filter by `auth.uid() = user_id`
- When creating new tables, always add RLS policies before inserting data

## Migrations
- SQL migrations live in `supabase/migrations/`
- Name format: `YYYYMMDDHHMMSS_description.sql`
- Always include both the schema change and the RLS policy in the same migration
- Test migrations against the existing schema before applying

## Auth
- Email/password auth only (no OAuth providers)
- Auth state managed via `@/hooks/useAuth`
- Middleware at `src/middleware.ts` protects (app)/* routes
